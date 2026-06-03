const Task = require('../models/Task');
const User = require('../models/User');
const { sendEmail } = require('../utils/emailService');

// @desc    Create a new task
// @route   POST /api/tasks
// @access  Private (Admin/HR/Manager/AGM)
const createTask = async (req, res) => {
  try {
    const { title, description, assignedTo, assignTeam, priority, deadline } = req.body;

    if (!['Admin', 'HR', 'Manager', 'AGM', 'SuperAdmin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only management roles can assign tasks' });
    }

    // Manager: can only assign to their own department
    if (req.user.role === 'Manager') {
      if (assignTeam) {
        // bulk assign — validate all members belong to manager's department
        const members = await User.find({ _id: { $in: assignTeam }, isActive: 'Active' });
        const outsider = members.find(m => m.department !== req.user.department);
        if (outsider) {
          return res.status(403).json({ message: 'You can only assign tasks to members of your own team.' });
        }
      } else {
        const assignee = await User.findById(assignedTo);
        if (!assignee || assignee.department !== req.user.department) {
          return res.status(403).json({ message: 'You can only assign tasks to members of your own team.' });
        }
      }
    }

    // Bulk team assignment
    if (assignTeam && Array.isArray(assignTeam) && assignTeam.length > 0) {
      const tasks = await Task.insertMany(
        assignTeam.map(memberId => ({
          title, description, priority, deadline,
          assignedTo: memberId,
          assignedBy: req.user._id
        }))
      );
      // Notify each assignee
      const members = await User.find({ _id: { $in: assignTeam } }).select('name email');
      for (const member of members) {
        if (member.email) {
          const emailText = `Hello ${member.name},\n\nA new task has been assigned to you by ${req.user.name}.\n\nTask Details:\nTitle: ${title}\nDescription: ${description || 'N/A'}\nPriority: ${priority}\nDeadline: ${deadline ? new Date(deadline).toLocaleString() : 'No Deadline'}\nAssigned Date: ${new Date().toLocaleString()}\n\nPlease log in to the HRMS portal to manage this task.`;
          await sendEmail({
            to: member.email,
            subject: `New Task Assigned: ${title}`,
            html: `<pre style="font-family:sans-serif">${emailText}</pre>`
          }).catch(err => console.error('Failed to send bulk task email:', err));
        }
      }
      return res.status(201).json(tasks);
    }

    const task = await Task.create({
      title, description, assignedTo, assignedBy: req.user._id, priority, deadline
    });

    const assignee = await User.findById(assignedTo);
    if (assignee?.email) {
      const emailText = `Hello ${assignee.name},\n\nA new task has been assigned to you by ${req.user.name}.\n\nTask Details:\nTitle: ${title}\nDescription: ${description || 'N/A'}\nPriority: ${priority}\nDeadline: ${deadline ? new Date(deadline).toLocaleString() : 'No Deadline'}\nAssigned Date: ${new Date().toLocaleString()}\n\nPlease log in to the HRMS portal to manage this task.`;
      await sendEmail({
        to: assignee.email,
        subject: `New Task Assigned: ${title}`,
        html: `<pre style="font-family:sans-serif">${emailText}</pre>`
      }).catch(err => console.error('Failed to send task assignment email:', err));
    }

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all tasks (filtered by user or role)
// @route   GET /api/tasks
// @access  Private
const getTasks = async (req, res) => {
  try {
    let query = {};

    // Standard Visibility:
    // Employees: see only their assigned tasks
    // Managers/AGM: see tasks they assigned OR tasks assigned to them
    // Admin/HR: see everything

    if (req.user.role === 'Employee') {
      query.assignedTo = req.user._id;
    } else if (req.user.role === 'Manager' || req.user.role === 'AGM') {
      query = {
        $or: [
          { assignedBy: req.user._id },
          { assignedTo: req.user._id }
        ]
      };
    } else if (req.user.role === 'HR' || req.user.role === 'Admin' || req.user.role === 'SuperAdmin') {
       query = {};
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name email role')
      .populate('assignedBy', 'name role')
      .populate('history.updatedBy', 'name role')
      .sort({ createdAt: -1 });

    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @desc    Update task status/progress
// @route   PATCH /api/tasks/:id
// @access  Private
const updateTask = async (req, res) => {
  try {
    const { status, comment } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check permissions: only assignee can update status, or assigner
    if (task.assignedTo.toString() !== req.user._id.toString() &&
        task.assignedBy.toString() !== req.user._id.toString() &&
        !['Admin', 'HR', 'AGM', 'SuperAdmin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized to update this task' });
    }

    const PRIVILEGED = ['Manager', 'Admin', 'HR', 'AGM', 'SuperAdmin'];

    // Employees can only move to 'In Progress' or 'Review' — not Pending or Completed
    if (status && req.user.role === 'Employee' && !['In Progress', 'Review'].includes(status)) {
      return res.status(403).json({ message: 'Employees can only move a task to \'In Progress\' or \'In Review\' status.' });
    }

    // Only privileged roles can mark Completed
    if (status === 'Completed' && !PRIVILEGED.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to mark this task as Completed.' });
    }

    // Enforce remarks for status change
    if (status && status !== task.status && !comment) {
      return res.status(400).json({ message: 'Remarks are required when changing task status' });
    }

    // Capture old status BEFORE mutating — used for email notification below
    const oldStatus = task.status;

    if (status) {
      task.status = status;
      if (status === 'Completed') task.completedAt = new Date();
    }

    task.history.push({
      status: status || task.status,
      comment: comment || 'No remarks provided',
      updatedBy: req.user._id
    });

    await task.save();

    // Send email only when status actually changed
    // BUG FIX: compare against oldStatus (captured before mutation), not task.status
    if (status && status !== oldStatus) {
      const taskPopulated = await Task.findById(task._id)
        .populate('assignedBy', 'name email role')
        .populate('assignedTo', 'name email');

      const changedAt = new Date().toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });

      // Notify the MANAGER (assignedBy) — only if they are not the one making the change
      if (
        taskPopulated.assignedBy?.email &&
        taskPopulated.assignedBy._id.toString() !== req.user._id.toString()
      ) {
        const toManager = [
          `Hello ${taskPopulated.assignedBy.name},`,
          ``,
          `A task you assigned has been updated by ${req.user.name}.`,
          ``,
          `─────────────────────────────`,
          `Task Title  : ${taskPopulated.title}`,
          `Assigned To : ${taskPopulated.assignedTo?.name || 'N/A'}`,
          `Old Status  : ${oldStatus}`,
          `New Status  : ${status}`,
          `Updated By  : ${req.user.name}`,
          `Updated At  : ${changedAt}`,
          `Remarks     : ${comment || 'No remarks provided'}`,
          `─────────────────────────────`,
          ``,
          `Please log in to the HRMS portal to review the task.`,
        ].join('\n');

        await sendEmail({
          to: taskPopulated.assignedBy.email,
          subject: `[Task Update] "${taskPopulated.title}" — ${oldStatus} → ${status}`,
          html: `<pre style="font-family:sans-serif">${toManager}</pre>`
        }).catch(err => console.error('Failed to send status update email to manager:', err));
      }

      // Notify the ASSIGNEE — only if they are not the one making the change
      if (
        taskPopulated.assignedTo?.email &&
        taskPopulated.assignedTo._id.toString() !== req.user._id.toString()
      ) {
        const toAssignee = [
          `Hello ${taskPopulated.assignedTo.name},`,
          ``,
          `The status of your task has been updated by ${req.user.name}.`,
          ``,
          `─────────────────────────────`,
          `Task Title  : ${taskPopulated.title}`,
          `Old Status  : ${oldStatus}`,
          `New Status  : ${status}`,
          `Updated At  : ${changedAt}`,
          `Remarks     : ${comment || 'No remarks provided'}`,
          `─────────────────────────────`,
          ``,
          `Please log in to the HRMS portal to view more details.`,
        ].join('\n');

        await sendEmail({
          to: taskPopulated.assignedTo.email,
          subject: `[Task Update] "${taskPopulated.title}" — ${oldStatus} → ${status}`,
          html: `<pre style="font-family:sans-serif">${toAssignee}</pre>`
        }).catch(err => console.error('Failed to send status update email to assignee:', err));
      }
    }

    res.status(200).json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private (Admin/HR/Assigner)
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (
      task.assignedBy.toString() !== req.user._id.toString() &&
      !['Admin', 'HR', 'AGM', 'SuperAdmin'].includes(req.user.role)
    ) {
      return res.status(403).json({ message: 'Not authorized to delete this task' });
    }

    await task.deleteOne();
    res.status(200).json({ message: 'Task removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createTask, getTasks, updateTask, deleteTask };

