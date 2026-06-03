import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/axios';
import { 
  Users, 
  Calendar as CalendarIcon, 
  Search, 
  ArrowRight, 
  Download, 
  UserCheck, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  User,
  X,
  AlertCircle,
  TrendingUp,
  UserX,
  MapPin,
  Save,
  Settings
} from 'lucide-react';

export default function AttendanceManagement() {
  const { user } = useContext(AuthContext);
  const [view, setView] = useState('daily'); // 'daily' or 'monthly'
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [attendanceData, setAttendanceData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Calendar View States
  const [selectedEmp, setSelectedEmp] = useState(null); // { _id, name }
  const [empMonthlyData, setEmpMonthlyData] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [statusModal, setStatusModal] = useState({ show: false, date: '', status: 'Present', note: '' });

  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [officeSettings, setOfficeSettings] = useState({ latitude: '', longitude: '', radius: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/settings');
      if (data && data.officeLocation) {
        setOfficeSettings({
          latitude: data.officeLocation.latitude || '',
          longitude: data.officeLocation.longitude || '',
          radius: data.officeLocation.radius || ''
        });
      }
    } catch (err) {
      console.error('Failed to fetch settings', err);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await api.put('/settings', { officeLocation: officeSettings });
      setShowSettingsModal(false);
      alert('Office Location updated successfully!');
    } catch (err) {
      alert('Failed to update settings: ' + (err.response?.data?.message || err.message));
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [view, date, month, year]);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      if (view === 'daily') {
        const { data } = await api.get(`/attendance/all?date=${date}`);
        setAttendanceData(data);
      } else {
        const { data } = await api.get('/employees');
        const employees = data;
        
        const monthlyStats = await Promise.all(employees.map(async (emp) => {
          const res = await api.get(`/attendance/monthly/${year}/${month}?userId=${emp._id}`);
          const records = res.data;
          
          let present = 0, late = 0, halfDay = 0, totalHours = 0;
          records.forEach(r => {
            if (r.status === 'Present') present++;
            else if (r.status === 'Late') { present++; late++; }
            else if (r.status === 'Half-day') { halfDay++; }
            totalHours += (r.totalHours || 0);
          });

          return {
            ...emp,
            present,
            late,
            halfDay,
            totalHours: totalHours.toFixed(1)
          };
        }));
        setAttendanceData(monthlyStats);
      }
    } catch (err) {
      console.error('Failed to fetch attendance', err);
    } finally {
      setLoading(false);
    }
  };

  const openEmpCalendar = async (emp) => {
    try {
      setLoading(true);
      setSelectedEmp(emp);
      const [attRes, holRes] = await Promise.all([
        api.get(`/attendance/monthly/${year}/${month}?userId=${emp._id}`),
        api.get('/holidays')
      ]);
      setEmpMonthlyData(attRes.data);
      setHolidays(holRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    try {
      await api.patch('/attendance/status', {
        userId: selectedEmp._id,
        date: statusModal.date,
        status: statusModal.status,
        note: statusModal.note
      });
      // Refresh calendar
      const { data } = await api.get(`/attendance/monthly/${year}/${month}?userId=${selectedEmp._id}`);
      setEmpMonthlyData(data);
      setStatusModal({ show: false, date: '', status: 'Present', note: '' });
    } catch (err) {
      alert('Failed to update: ' + (err.response?.data?.message || err.message));
    }
  };

  const filteredData = attendanceData.filter(item => {
    const name = item.user?.name || item.name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Check if user can manually mark attendance
  const canMarkAttendance = ['Admin', 'AGM', 'SuperAdmin'].includes(user?.role);

  const stats = {
    present: view === 'daily' ? attendanceData.length : attendanceData.reduce((acc, curr) => acc + curr.present, 0),
    late: view === 'daily' ? attendanceData.filter(r => r.status === 'Late').length : attendanceData.reduce((acc, curr) => acc + curr.late, 0),
    avgHours: view === 'daily' ? (attendanceData.reduce((acc, curr) => acc + (curr.totalHours || 0), 0) / (attendanceData.length || 1)).toFixed(1) : 0
  };

  // Calendar Helpers
  const daysInMonth = new Date(year, month, 0).getDate();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear - 1 + i);

  if (selectedEmp) {
    return (
      <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
        <button 
          onClick={() => setSelectedEmp(null)}
          className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold transition-all"
        >
          <ChevronLeft size={20} /> Back to Attendance List
        </button>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">{selectedEmp.name}</h1>
            <p className="text-sm sm:text-base text-slate-500 font-medium">Monthly Attendance Calendar — {new Date(year, month - 1).toLocaleString('default', { month: 'long' })} {year}</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <select 
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none"
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
            <select 
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-3 sm:gap-4">
          {calendarDays.map(day => {
            const dStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const isSunday = new Date(year, month - 1, day).getDay() === 0;
            const holiday = holidays.find(h => h.date === dStr);
            const record = empMonthlyData.find(r => r.date === dStr);

            return (
              <div 
                key={day}
                onClick={() => canMarkAttendance && setStatusModal({ show: true, date: dStr, status: record?.status || 'Present', note: record?.note || '' })}
                className={`relative h-28 sm:h-32 p-3 sm:p-4 rounded-2xl sm:rounded-3xl border transition-all flex flex-col justify-between ${
                  canMarkAttendance ? 'cursor-pointer group hover:shadow-lg active:scale-95' : 'cursor-not-allowed opacity-75'
                } ${
                  isSunday ? 'bg-slate-50 border-slate-200' :
                  holiday ? 'bg-amber-50 border-amber-200' :
                  'bg-white border-slate-100 hover:border-blue-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-lg font-black ${isSunday ? 'text-slate-400' : 'text-slate-800'}`}>{day}</span>
                  {record && (
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${
                      record.status === 'Present' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      record.status === 'Half-day' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                      record.status === 'Unpaid Leave' || record.status === 'Absent' ? 'bg-red-50 text-red-600 border-red-100' :
                      'bg-blue-50 text-blue-600 border-blue-100'
                    }`}>
                      {record.status}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {isSunday && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sunday</p>}
                  {holiday && <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest truncate" title={holiday.name}>{holiday.name}</p>}
                  {record?.totalHours > 0 && <p className="text-xs font-black text-slate-500">{record.totalHours} hrs worked</p>}
                </div>

                <div className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-5 rounded-3xl transition-opacity" />
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 sm:gap-6 p-4 sm:p-6 bg-slate-50 rounded-2xl sm:rounded-[2.5rem] border border-slate-100">
           <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-lg bg-white border border-slate-200" />
              <span className="text-xs font-bold text-slate-500">Working Day</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-lg bg-slate-100 border border-slate-200" />
              <span className="text-xs font-bold text-slate-500">Sunday</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-lg bg-amber-50 border border-amber-200" />
              <span className="text-xs font-bold text-slate-500">Holiday</span>
           </div>
           <div className="flex items-center gap-2 ml-auto">
              <AlertCircle size={14} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-400">
                {canMarkAttendance ? 'Click a day to manually mark leave (Paid/Unpaid/Half-day)' : 'Manual attendance marking requires Admin/AGM/SuperAdmin privileges'}
              </span>
           </div>
        </div>

        {/* Management Modal */}
        {statusModal.show && (
           <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                 <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <div>
                       <h2 className="text-xl font-black text-slate-800">Mark Attendance</h2>
                       <p className="text-xs font-bold text-slate-400 mt-0.5">{statusModal.date}</p>
                    </div>
                    <button onClick={() => setStatusModal({ ...statusModal, show: false })} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={20} /></button>
                 </div>
                 <div className="p-8 space-y-6">
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Choose Status</label>
                       <div className="grid grid-cols-2 gap-3">
                          {['Present', 'Half-day', 'Paid Leave', 'Unpaid Leave'].map(st => (
                             <button 
                                key={st}
                                onClick={() => setStatusModal({ ...statusModal, status: st })}
                                className={`py-3 px-4 rounded-2xl text-xs font-black transition-all border ${
                                   statusModal.status === st ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30 active:scale-95' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-300'
                                }`}
                             >
                                {st}
                             </button>
                          ))}
                       </div>
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Remarks / Note</label>
                       <textarea 
                          className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/10 transition-all outline-none resize-none"
                          rows="3"
                          placeholder="Why is this status being manually set?"
                          value={statusModal.note}
                          onChange={(e) => setStatusModal({...statusModal, note: e.target.value})}
                       />
                    </div>
                    <button 
                       onClick={handleUpdateStatus}
                       className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-slate-900/20 active:scale-[0.98]"
                    >
                       Apply Status
                    </button>
                 </div>
              </div>
           </div>
        )}
      </div>
    );
  }

  return (
      <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Team Attendance</h1>
          <p className="text-sm sm:text-base text-slate-500 font-medium">Monitor real-time shifts and monthly performance reports</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center w-full lg:w-auto">
          <button 
            onClick={() => setShowSettingsModal(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-black transition-all"
          >
            <Settings size={18} /> Location Config
          </button>
          
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner w-full sm:w-auto">
          <button 
            onClick={() => setView('daily')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${view === 'daily' ? 'bg-white text-blue-600 shadow-md transform scale-105' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Daily View
          </button>
          <button 
            onClick={() => setView('monthly')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${view === 'monthly' ? 'bg-white text-blue-600 shadow-md transform scale-105' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Monthly Report
          </button>
        </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <UserCheck size={28} />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Present</p>
            <h3 className="text-2xl font-black text-slate-800">{stats.present}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock size={28} />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Late Arrivals</p>
            <h3 className="text-2xl font-black text-slate-800">{stats.late}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp size={28} />
          </div>
          <div>
             <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{view === 'daily' ? 'Avg. Session' : 'Reporting Rate'}</p>
             <h3 className="text-2xl font-black text-slate-800">{view === 'daily' ? `${stats.avgHours}h` : '98%'}</h3>
          </div>
        </div>
      </div>

      {/* Filters Area */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 sm:gap-6">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search by employee name..."
              className="w-full bg-slate-50 border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
            {view === 'daily' ? (
              <div className="flex items-center bg-slate-50 rounded-2xl px-4 py-2 border border-slate-100 w-full md:w-auto">
                <CalendarIcon size={18} className="text-slate-400 mr-3" />
                <input 
                  type="date"
                  className="bg-transparent border-none text-sm font-bold outline-none cursor-pointer"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            ) : (
              <div className="flex gap-2 w-full md:w-auto">
                <select 
                  className="bg-slate-50 border-none rounded-2xl py-2 px-4 text-sm font-bold outline-none ring-2 ring-transparent focus:ring-blue-500/10 transition-all"
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>
                  ))}
                </select>
                <select 
                  className="bg-slate-50 border-none rounded-2xl py-2 px-4 text-sm font-bold outline-none ring-2 ring-transparent focus:ring-blue-500/10 transition-all"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                >
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}
            <button className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 hover:text-slate-600 transition-all border border-slate-100">
               <Download size={20} />
            </button>
          </div>
        </div>

        {/* Dynamic Table */}
        <div className="overflow-x-auto rounded-2xl sm:rounded-3xl border border-slate-50 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">
                <th className="px-6 py-5">Employee Info</th>
                {view === 'daily' ? (
                  <>
                    <th className="px-6 py-5">Check In</th>
                    <th className="px-6 py-5">Check Out</th>
                    <th className="px-6 py-5">Duration</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-5">Present</th>
                    <th className="px-6 py-5">Late</th>
                    <th className="px-6 py-5">Total Hours</th>
                  </>
                )}
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5 text-right">Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                   <td colSpan="6" className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                         <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                         <p className="text-sm font-bold text-slate-400 animate-pulse">Analyzing logs...</p>
                      </div>
                   </td>
                </tr>
              ) : filteredData.length > 0 ? filteredData.map((item, idx) => {
                const emp = view === 'daily' ? item.user : item;
                return (
                  <tr key={idx} className="group hover:bg-blue-50/30 transition-all cursor-default">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs border border-slate-100 group-hover:bg-white group-hover:text-blue-600 transition-all uppercase">
                          {(emp?.name || 'U').charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-sm">{emp?.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 tracking-tight uppercase">{emp?.role || 'Team Member'}</p>
                        </div>
                      </div>
                    </td>
                    
                    {view === 'daily' ? (
                      <>
                        <td className="px-6 py-4 font-mono text-xs font-bold text-slate-600">
                          {item.checkIn ? new Date(item.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-bold text-slate-600">
                          {item.checkOut ? new Date(item.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-black text-slate-700">{item.totalHours || 0}h</span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4">
                          <p className="text-sm font-black text-slate-700">{item.present} <span className="text-[9px] text-slate-400 uppercase font-bold">days</span></p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-black text-amber-600">{item.late} <span className="text-[9px] text-slate-400 uppercase font-bold">times</span></p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-black text-blue-600">{item.totalHours} <span className="text-[9px] text-slate-400 uppercase font-bold">hrs</span></p>
                        </td>
                      </>
                    )}

                    <td className="px-6 py-4">
                      {view === 'daily' ? (
                        <span className={`px-3 py-1 flex items-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-tight border w-fit ${
                          item.status === 'Present' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          item.status === 'Late' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                          item.status === 'Half-day' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                          'bg-slate-50 text-slate-500 border-slate-100'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'Present' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                          {item.status}
                        </span>
                      ) : (
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden max-w-[80px]">
                          <div 
                            className="bg-blue-600 h-full rounded-full" 
                            style={{ width: `${Math.min(100, (item.present / 22) * 100)}%` }} 
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => openEmpCalendar(emp)}
                        className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                      >
                        <ArrowRight size={18} />
                      </button>
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                   <td colSpan="6" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 opacity-30">
                         <UserX size={40} className="text-slate-400" />
                         <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No matching logs found</p>
                      </div>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
         <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
               <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                        <MapPin size={24} />
                     </div>
                     <div>
                        <h2 className="text-xl font-black text-slate-800">Office Location</h2>
                        <p className="text-xs font-bold text-slate-400 mt-0.5">Restrict check-ins to this area</p>
                     </div>
                  </div>
                  <button onClick={() => setShowSettingsModal(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={20} /></button>
               </div>
               <div className="p-8 space-y-6">
                  <div className="space-y-4">
                     <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Latitude</label>
                        <input 
                           type="number"
                           className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                           placeholder="e.g. 28.6139"
                           value={officeSettings.latitude}
                           onChange={(e) => setOfficeSettings({...officeSettings, latitude: parseFloat(e.target.value) || ''})}
                        />
                     </div>
                     <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Longitude</label>
                        <input 
                           type="number"
                           className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                           placeholder="e.g. 77.2090"
                           value={officeSettings.longitude}
                           onChange={(e) => setOfficeSettings({...officeSettings, longitude: parseFloat(e.target.value) || ''})}
                        />
                     </div>
                     <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Radius (meters)</label>
                        <input 
                           type="number"
                           className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                           placeholder="e.g. 50"
                           value={officeSettings.radius}
                           onChange={(e) => setOfficeSettings({...officeSettings, radius: parseInt(e.target.value) || 0})}
                        />
                        <p className="text-[10px] font-bold text-slate-400 mt-2">Set radius to 0 to disable location restrictions.</p>
                     </div>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-100">
                     <button 
                        onClick={handleSaveSettings}
                        className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98]"
                     >
                        <Save size={18} /> Save Settings
                     </button>
                  </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
