import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axios';
import { AuthContext } from '../context/AuthContext';
import KpiCelebrationPopup from '../components/KpiCelebrationPopup';
import {
  Clock, Calendar as CalendarIcon, CheckCircle, Award, ListTodo,
  FileText, LogOut, Trophy, TrendingUp, Users, CheckCheck, AlertCircle
} from 'lucide-react';

const STATUS_COLOR = {
  'Present':  'bg-emerald-100 text-emerald-700',
  'Late':     'bg-amber-100 text-amber-700',
  'Half-day': 'bg-orange-100 text-orange-700',
  'Absent':   'bg-red-100 text-red-600',
};

const TASK_STATUS_COLOR = {
  'Pending':     'bg-slate-100 text-slate-600',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Review':      'bg-purple-100 text-purple-700',
  'Completed':   'bg-emerald-100 text-emerald-700',
};

export default function ManagerDashboard() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [personalStats, setPersonalStats]     = useState({ presentDays: 0, totalHours: 0 });
  const [tasks, setTasks]                     = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [monthlyLeaderboard, setMonthlyLeaderboard] = useState([]);
  const [kpiLogs, setKpiLogs]                 = useState([]);
  const [teamAttendance, setTeamAttendance]   = useState([]);
  const [teamTasks, setTeamTasks]             = useState([]);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [kpiCelebration, setKpiCelebration]   = useState(null);
  const [isCheckingOut, setIsCheckingOut]     = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const month = new Date().getMonth() + 1;
      const year  = new Date().getFullYear();

      const [attRes, taskRes, todayRes, lbRes, logsRes, teamAttRes, teamTaskRes] = await Promise.all([
        api.get(`/attendance/monthly/${year}/${month}`).catch(() => ({ data: [] })),
        api.get('/tasks').catch(() => ({ data: [] })),
        api.get('/attendance/today').catch(() => ({ data: [] })),
        api.get('/kpi/monthly-leaderboard').catch(() => ({ data: [] })),
        api.get(`/kpi/history/${user._id}`).catch(() => ({ data: [] })),
        api.get('/attendance/team-today').catch(() => ({ data: [] })),
        api.get('/tasks').catch(() => ({ data: [] })),
      ]);

      setTasks(taskRes.data);
      setMonthlyLeaderboard(lbRes.data || []);
      setKpiLogs(logsRes.data || []);
      setTeamAttendance(teamAttRes.data || []);

      // Team tasks = tasks assigned BY this manager
      setTeamTasks((teamTaskRes.data || []).filter(t => t.assignedBy?._id === user._id || t.assignedBy === user._id));

      if (todayRes?.data?.length > 0) setTodayAttendance(todayRes.data[0]);
      else setTodayAttendance(null);

      const monthlyAtt = attRes.data;
      const hours = monthlyAtt.reduce((acc, curr) => acc + (curr.totalHours || 0), 0);
      setPersonalStats({ presentDays: monthlyAtt.length, totalHours: parseFloat(hours.toFixed(1)) });
    } catch {}
  };

  const handleCheckIn = async () => {
    if (!navigator.geolocation) return alert('Geolocation not supported');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api.post('/attendance/check-in', {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
          alert('Checked in successfully!');
          fetchAll();
        } catch (err) { alert(err.response?.data?.message || 'Check-in failed'); }
      },
      () => alert('Enable location permissions.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleCheckOut = async () => {
    if (isCheckingOut) return;           // block re-entry
    if (!navigator.geolocation) return alert('Geolocation not supported');
    setIsCheckingOut(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { data } = await api.post('/attendance/check-out', {
            latitude:  pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          setShowCheckOutModal(false);
          fetchAll();
          if (data.kpiAwarded && data.kpiAwarded.length > 0) {
            setKpiCelebration(data.kpiAwarded);
          }
        } catch (err) {
          setShowCheckOutModal(false);
          alert(err.response?.data?.message || 'Check-out failed');
        } finally {
          setIsCheckingOut(false);
        }
      },
      () => {
        alert('Enable location permissions.');
        setIsCheckingOut(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Team task summary
  const taskSummary = teamTasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
    <div className="min-h-screen bg-slate-50">
      {/* Top Navbar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-100">
            <Users size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-none">Manager Portal</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Study Palace Hub HRMS</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-bold text-slate-800">{user?.name}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase">{user?.role} • {user?.department}</p>
          </div>
          <button onClick={logout} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">

        {/* Welcome & Check-In */}
        <div className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-gradient-to-br from-white to-slate-50">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-slate-800">Hello, {user?.name.split(' ')[0]}! 👋</h2>
            <p className="text-slate-500 max-w-md">You've worked <span className="text-blue-600 font-bold">{personalStats.totalHours} hours</span> this month.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {!todayAttendance?.checkIn ? (
              <button onClick={handleCheckIn} className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition shadow-xl shadow-blue-100">
                Check In Now
              </button>
            ) : !todayAttendance?.checkOut ? (
              <button onClick={() => setShowCheckOutModal(true)} className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition shadow-xl shadow-slate-200">
                Check Out
              </button>
            ) : (
              <div className="px-6 sm:px-8 py-3 sm:py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-bold border border-emerald-100 flex items-center gap-2">
                <CheckCircle size={20} /> Today's Shift Complete
              </div>
            )}
            {todayAttendance?.checkIn && (
              <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="w-3 h-3 rounded-full animate-pulse bg-green-500" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Since</span>
                  <span className="text-xs font-bold text-slate-700">
                    {new Date(todayAttendance.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Personal Stats + My Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg w-fit mb-4"><CheckCircle size={20} /></div>
                <p className="text-2xl font-bold text-slate-800">{personalStats.presentDays}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Days Present</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg w-fit mb-4"><Award size={20} /></div>
                <p className="text-2xl font-bold text-slate-800">{user?.totalKpi || 0}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">KPI Points</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                <CalendarIcon size={18} className="text-blue-600" /> Attendance History
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">View your full attendance calendar in the attendance module.</p>
              <button onClick={() => navigate('/admin/attendance')} className="w-full py-3 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold hover:bg-blue-50 hover:text-blue-600 transition">
                Open Calendar
              </button>
            </div>

            {/* Quick Links */}
            <div className="bg-blue-600 rounded-3xl p-6 text-white">
              <h3 className="font-bold mb-4">Quick Links</h3>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => navigate('/admin/tasks')} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl text-xs font-bold transition">Task Board</button>
                <button onClick={() => navigate('/admin/my-payroll')} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl text-xs font-bold transition">Salary Slips</button>
                <button onClick={() => navigate('/admin/leaderboard')} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl text-xs font-bold transition">Leaderboard</button>
                <button onClick={() => navigate('/admin/attendance')} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl text-xs font-bold transition">Attendance</button>
              </div>
            </div>
          </div>

          {/* My Tasks */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <ListTodo size={20} className="text-blue-600" /> My Tasks
                </h3>
                <button onClick={() => navigate('/admin/tasks')} className="text-xs font-bold text-blue-600">View All</button>
              </div>
              <div className="p-4 space-y-3">
                {tasks.filter(t => t.status !== 'Completed' && t.assignedTo?._id === user._id).slice(0, 5).map(task => (
                  <div key={task._id} className="p-5 bg-slate-50 rounded-2xl border border-transparent hover:border-blue-100 hover:bg-white transition-all group">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{task.title}</h4>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <Clock size={12} /> Due: {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No deadline'}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${task.priority === 'High' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        {task.priority}
                      </span>
                    </div>
                  </div>
                ))}
                {tasks.filter(t => t.assignedTo?._id === user._id).length === 0 && (
                  <div className="py-20 text-center text-slate-300">
                    <ListTodo size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No active tasks assigned to you</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group cursor-pointer" onClick={() => navigate('/admin/my-payroll')}>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all"><FileText size={20} /></div>
                  <div>
                    <p className="font-bold text-slate-800">Salary Slips</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Download Monthly</p>
                  </div>
                </div>
                <div className="text-slate-300 group-hover:text-slate-600 transition-all">→</div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group cursor-pointer" onClick={() => navigate('/admin/leaderboard')}>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl group-hover:bg-amber-600 group-hover:text-white transition-all"><Award size={20} /></div>
                  <div>
                    <p className="font-bold text-slate-800">Leaderboard</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">View Rankings</p>
                  </div>
                </div>
                <div className="text-slate-300 group-hover:text-slate-600 transition-all">→</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── TEAM SECTION ── */}

        {/* Team Check-In Status */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-blue-500" />
              <h3 className="font-bold text-slate-800">Team Check-In Today</h3>
              <span className="ml-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCheck size={14} />
                {teamAttendance.filter(r => r.checkIn).length} In
              </span>
              <span className="flex items-center gap-1 text-red-500">
                <AlertCircle size={14} />
                {teamAttendance.filter(r => !r.checkIn).length} Absent
              </span>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {teamAttendance.length === 0 && (
              <p className="px-6 py-8 text-sm text-slate-400 text-center">No team members found</p>
            )}
            {teamAttendance.map((record, i) => {
              const member = record.user;
              const checkedIn = !!record.checkIn;
              const checkedOut = !!record.checkOut;
              const status = record.status || (checkedIn ? 'Present' : 'Absent');
              return (
                <div key={member?._id || i} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {member?.name?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{member?.name || '—'}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{member?.designation || member?.department || '—'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {checkedIn ? (
                      <p className="text-xs font-bold text-slate-700">
                        {new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {checkedOut && (
                          <span className="text-slate-400 font-normal">
                            {' → '}{new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 font-medium">Not checked in</p>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_COLOR[status] || 'bg-slate-100 text-slate-500'}`}>
                    {status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team Task Report */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <ListTodo size={18} className="text-purple-500" />
              <h3 className="font-bold text-slate-800">Team Task Report</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(taskSummary).map(([status, count]) => (
                <span key={status} className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${TASK_STATUS_COLOR[status] || 'bg-slate-100 text-slate-500'}`}>
                  {status}: {count}
                </span>
              ))}
              {teamTasks.length === 0 && <span className="text-xs text-slate-400">No tasks assigned yet</span>}
            </div>
          </div>
          <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
            {teamTasks.length === 0 && (
              <p className="px-6 py-8 text-sm text-slate-400 text-center">No tasks assigned to your team yet</p>
            )}
            {teamTasks.map(task => (
              <div key={task._id} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{task.title}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                    Assigned to: {task.assignedTo?.name || '—'}
                    {task.deadline && (` • Due: ${new Date(task.deadline).toLocaleDateString()}`)}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${task.priority === 'High' ? 'bg-red-100 text-red-600' : task.priority === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                  {task.priority}
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${TASK_STATUS_COLOR[task.status] || 'bg-slate-100 text-slate-500'}`}>
                  {task.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* KPI Leaderboard */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center gap-2">
            <Trophy size={18} className="text-amber-500" />
            <h3 className="font-bold text-slate-800">Monthly KPI Leaderboard</h3>
            <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {new Date().toLocaleString('default', { month: 'long' })} {new Date().getFullYear()}
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {monthlyLeaderboard.slice(0, 10).map((emp, i) => (
              <div key={emp._id} className={`flex items-center gap-4 px-6 py-3 ${emp._id === user?._id ? 'bg-blue-50' : ''}`}>
                <span className={`w-6 text-xs font-black ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-400' : 'text-slate-300'}`}>{i + 1}</span>
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{emp.name?.charAt(0)}</div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800">
                    {emp.name} {emp._id === user?._id && <span className="text-blue-600 text-[10px]">(You)</span>}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{emp.role}</p>
                </div>
                <span className="text-sm font-black text-emerald-600">{emp.monthlyPoints} pts</span>
              </div>
            ))}
            {monthlyLeaderboard.length === 0 && (
              <p className="px-6 py-8 text-sm text-slate-400 text-center">No KPI data for this month yet</p>
            )}
          </div>
        </div>

        {/* KPI Logs */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-500" />
            <h3 className="font-bold text-slate-800">My KPI Logs</h3>
          </div>
          <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
            {kpiLogs.slice(0, 30).map(log => (
              <div key={log._id} className="flex items-center gap-4 px-6 py-3">
                <div className="text-center min-w-[48px]">
                  <p className="text-xs font-black text-slate-700">{new Date(log.date).toLocaleDateString([], { day: '2-digit', month: 'short' })}</p>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-700">{log.reason}</p>
                </div>
                <span className={`text-sm font-black ${log.points >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {log.points >= 0 ? '+' : ''}{log.points}
                </span>
              </div>
            ))}
            {kpiLogs.length === 0 && <p className="px-6 py-8 text-sm text-slate-400 text-center">No KPI records yet</p>}
          </div>
        </div>
      </div>

      <footer className="py-12 text-center border-t border-slate-100">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Powered by Study Palace Hub Advanced HRMS 2.0</p>
      </footer>

      {/* Check Out Modal */}
      {showCheckOutModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-500 rounded-2xl"><Clock size={22} /></div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Check Out</h2>
                <p className="text-xs text-slate-400 font-semibold">End your shift for today</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 font-semibold">Are you sure you want to check out?</p>
              {todayAttendance?.checkIn && (
                <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Checked in at</span>
                  <span className="text-sm font-black text-slate-700">
                    {new Date(todayAttendance.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowCheckOutModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition">Cancel</button>
                <button onClick={handleCheckOut} disabled={isCheckingOut} className="flex-1 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition shadow-lg disabled:opacity-60 disabled:cursor-not-allowed">
                  {isCheckingOut ? 'Checking out…' : 'Yes, Check Out'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

    <KpiCelebrationPopup
      kpiAwarded={kpiCelebration}
      onClose={() => setKpiCelebration(null)}
    />
    </>
  );
}
