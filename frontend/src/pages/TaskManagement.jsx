import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/axios';
import { Plus, CheckSquare, Clock, AlertTriangle, MessageSquare, Trash2 } from 'lucide-react';

export default function TaskManagement() {
  const { user } = useContext(AuthContext);
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [assignMode, setAssignMode] = useState('individual'); // 'individual' | 'team'
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignedTo: '',
    priority: 'Medium',
    deadline: ''
  });

  const PRIVILEGED = ['Manager', 'Admin', 'HR', 'AGM', 'SuperAdmin'];
  const CAN_COMPLETE = ['Manager', 'Admin', 'HR', 'AGM', 'SuperAdmin'];
  const isManager = user.role === 'Manager';
  const isPrivileged = PRIVILEGED.includes(user.role);
  // Official company teams
  const COMPANY_TEAMS = ['Marketing', 'Admission', 'Accounts', 'Counselling', 'Management'];

  useEffect(() => {
    fetchTasks();
    if (['Admin', 'HR', 'Manager', 'AGM', 'SuperAdmin'].includes(user.role)) {
      fetchEmployees();
    }
  }, []);

  const fetchTasks = async () => {
    try {
      const { data } = await api.get('/tasks');
      setTasks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      // For Manager: fetch only their own department members
      const url = isManager && user.department
        ? `/employees?department=${encodeURIComponent(user.department)}`
        : '/employees';
      const { data } = await api.get(url);
      setEmployees(data);
      // If manager and selectedTeam not yet set, set it now
      if (isManager && user.department) {
        setSelectedTeam(user.department);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // For Manager: locked to their own department. For others: use the 5 official teams.
  const teams = isManager
    ? (user.department ? [user.department] : [])
    : COMPANY_TEAMS;

  // Only show active employees in the assignment dropdown
  const filteredEmployees = selectedTeam
    ? employees.filter((emp) => emp.department === selectedTeam && emp.isActive === 'Active')
    : [];

  const createTask = async (e) => {
    e.preventDefault();
    if (!selectedTeam) return alert('Please select a team first.');
    if (assignMode === 'individual' && !newTask.assignedTo) return alert('Please select an employee.');
    setSubmitting(true);
    try {
      const payload = {
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        deadline: newTask.deadline
      };
      if (assignMode === 'team') {
        payload.assignTeam = filteredEmployees.map(e => e._id);
      } else {
        payload.assignedTo = newTask.assignedTo;
      }
      await api.post('/tasks', payload);
      setShowModal(false);
      setSelectedTeam('');
      setAssignMode('individual');
      setNewTask({ title: '', description: '', assignedTo: '', priority: 'Medium', deadline: '' });
      fetchTasks();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id, status) => {
    const comment = window.prompt('Please enter remarks for this status update:');
    if (comment === null) return;
    if (!comment.trim()) return alert('Remarks are required to update task status');
    try {
      await api.patch(`/tasks/${id}`, { status, comment });
      fetchTasks();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  // Status options per role
  // Employees can only move to 'In Progress' or 'Review' — NOT Pending (backend blocks it anyway)
  const statusOptions = () => {
    if (user.role === 'Employee') return ['In Progress', 'Review'];
    return ['Pending', 'In Progress', 'Review', 'Completed'];
  };

  const deleteTask = async (id) => {
    if (!window.confirm('Are you sure?')) return;
    try {
      await api.delete(`/tasks/${id}`);
      fetchTasks();
    } catch (err) {
      alert('Delete failed');
    }
  };

  if (loading) return <div className="p-8">Loading tasks...</div>;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Task Management</h1>
          <p className="text-sm sm:text-base text-slate-500">Track and manage employee activities</p>
        </div>
        {['Admin', 'HR', 'Manager', 'AGM', 'SuperAdmin'].includes(user.role) && (
          <button 
            onClick={() => {
              setShowModal(true);
              if (isManager && user.department) setSelectedTeam(user.department);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-100"
          >
            <Plus size={20} /> Create Task
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {['Pending', 'In Progress', 'Review', 'Completed'].map(columnStatus => (
          <div key={columnStatus} className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-bold flex items-center gap-2 text-slate-600">
                <span className={`w-2 h-2 rounded-full ${
                  columnStatus === 'Pending' ? 'bg-amber-400' :
                  columnStatus === 'In Progress' ? 'bg-blue-400' :
                  columnStatus === 'Review' ? 'bg-purple-400' : 'bg-emerald-400'
                }`} />
                {columnStatus}
              </h3>
              <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded-lg">
                {tasks.filter(t => t.status === columnStatus).length}
              </span>
            </div>

            <div className="space-y-4">
              {tasks.filter(t => t.status === columnStatus).map(task => (
                <div key={task._id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      task.priority === 'High' ? 'bg-red-50 text-red-600' :
                      task.priority === 'Medium' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-600'
                    }`}>
                      {task.priority}
                    </span>
                    {['Admin', 'HR', 'SuperAdmin'].includes(user.role) && (
                      <button onClick={() => deleteTask(task._id)} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  
                  <h4 className="font-bold text-slate-800 mb-1">{task.title}</h4>
                  <p className="text-sm text-slate-500 line-clamp-2 mb-4">{task.description}</p>
                  
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">
                      {task.assignedTo?.name.charAt(0)}
                    </div>
                    <span className="text-xs text-slate-600 font-medium">{task.assignedTo?.name}</span>
                  </div>

                  {task.history && task.history.length > 0 && (
                     <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
                        <p className="text-xs font-bold text-slate-500 flex items-center gap-1"><MessageSquare size={12}/> History</p>
                        {task.history.slice(-3).reverse().map((h, i) => (
                           <div key={i} className="bg-slate-50 p-2 rounded-lg text-xs">
                              <p className="font-bold text-slate-700">{h.status} <span className="text-slate-400 font-normal ml-1">• {h.updatedBy?.name || 'Unknown'} • {new Date(h.updatedAt).toLocaleDateString()}</span></p>
                              <p className="text-slate-600 mt-1">{h.comment}</p>
                           </div>
                        ))}
                     </div>
                  )}

                  <div className="flex items-center justify-between border-t border-slate-50 pt-4 mt-4">
                    <div className="flex flex-col gap-1 text-slate-400 text-xs">
                      <div className="flex items-center gap-1">
                         <Clock size={12} />
                         <span>Due: {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No deadline'}</span>
                      </div>
                      {task.status === 'Completed' && task.completedAt && ['Admin', 'HR', 'Manager', 'AGM', 'SuperAdmin'].includes(user.role) && (
                         <div className="flex items-center gap-1 text-emerald-500 font-bold mt-1">
                             <CheckSquare size={12} />
                             <span>Done: {new Date(task.completedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                         </div>
                      )}
                    </div>
                    
                    <select 
                      value={task.status}
                      onChange={(e) => updateStatus(task._id, e.target.value)}
                      className="text-xs font-bold bg-slate-50 border-none rounded-lg p-1.5 focus:ring-0 cursor-pointer"
                    >
                      {statusOptions().map(s => (
                        <option key={s} value={s}>{s === 'Review' ? 'In Review' : s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              {tasks.filter(t => t.status === columnStatus).length === 0 && (
                <div className="border-2 border-dashed border-slate-100 rounded-2xl p-8 text-center text-slate-300 text-sm">
                  No tasks in {columnStatus}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Task Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold">Assign New Task</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={createTask} className="p-8 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Title</label>
                <input 
                  type="text" required
                  className="w-full rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 p-3"
                  value={newTask.title}
                  onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                  placeholder="E.g. Finalize Q1 Report"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Select Team</label>
                {isManager ? (
                  <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-600">
                    {user.department || 'Your Department'}
                  </div>
                ) : (
                  <select
                    required
                    className="w-full rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 p-3"
                    value={selectedTeam}
                    onChange={(e) => {
                      setSelectedTeam(e.target.value);
                      setNewTask({ ...newTask, assignedTo: '' });
                    }}
                  >
                    <option value="">Select Team</option>
                    {teams.map((team) => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Assign Mode toggle — only for non-Manager privileged roles */}
              {!isManager && (
                <div className="flex gap-3">
                  <button type="button"
                    onClick={() => { setAssignMode('individual'); setNewTask({...newTask, assignedTo: ''}); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-black border transition ${
                      assignMode === 'individual' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}
                  >Individual</button>
                  <button type="button"
                    onClick={() => { setAssignMode('team'); setNewTask({...newTask, assignedTo: ''}); }}
                    disabled={!selectedTeam}
                    className={`flex-1 py-2 rounded-xl text-xs font-black border transition disabled:opacity-40 ${
                      assignMode === 'team' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}
                  >Entire Team</button>
                </div>
              )}

              {(assignMode === 'individual' || isManager) && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Assign To</label>
                  <select 
                    required
                    disabled={!selectedTeam && !isManager}
                    className="w-full rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 p-3"
                    value={newTask.assignedTo}
                    onChange={(e) => setNewTask({...newTask, assignedTo: e.target.value})}
                  >
                    <option value="">{(selectedTeam || isManager) ? 'Select Employee' : 'Select Team First'}</option>
                    {filteredEmployees.map(emp => (
                      <option key={emp._id} value={emp._id}>{emp.name} ({emp.department})</option>
                    ))}
                  </select>
                </div>
              )}

              {assignMode === 'team' && selectedTeam && (
                <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 font-semibold">
                  Task will be assigned to all <span className="font-black text-slate-800">{filteredEmployees.length}</span> members of <span className="font-black text-slate-800">{selectedTeam}</span>.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Priority</label>
                  <select 
                    className="w-full rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 p-3"
                    value={newTask.priority}
                    onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Deadline</label>
                  <input 
                    type="date"
                    className="w-full rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 p-3"
                    value={newTask.deadline}
                    onChange={(e) => setNewTask({...newTask, deadline: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                <textarea 
                  className="w-full rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 p-3"
                  rows="3"
                  value={newTask.description}
                  onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 mt-4 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Assigning...</>
                ) : 'Assign Task'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
