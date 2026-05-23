const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { 
    type: String, 
    enum: ['Pending', 'In Progress', 'Completed', 'Review'],
    default: 'Pending' 
  },
  priority: { 
    type: String, 
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium' 
  },
  deadline: { type: Date },
  completedAt: { type: Date },
  history: [{
    status: { type: String },
    comment: { type: String },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
