import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axios';
import { AuthContext } from '../context/AuthContext';
import { Users, Activity, Search, Clock, Cake, CheckCircle } from 'lucide-react';
import AssetDashboardWidgets from '../components/AssetDashboardWidgets';
import KpiCelebrationPopup from '../components/KpiCelebrationPopup';

export default function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({ totalEmployees: 0, netKpi: 0, totalActions: 0 });
  const [attendanceStats, setAttendanceStats] = useState({ presentToday: 0 });
  const [upcomingBirthdays, setUpcomingBirthdays] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [kpiCelebration, setKpiCelebration] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [empRes, statsRes, attRes, todayRes] = await Promise.all([
        api.get('/employees'),
        api.get('/employees/stats'),
        api.get(`/attendance/all?date=${new Date().toISOString().split('T')[0]}`),
        api.get('/attendance/today').catch(() => ({ data: [] }))
      ]);
      setEmployees(empRes.data);
      setStats(statsRes.data);
      setUpcomingBirthdays(statsRes.data.upcomingBirthdays || []);
      setAttendanceStats({ presentToday: attRes.data.length });
      
      // Update today's attendance state
      if (todayRes && todayRes.data && todayRes.data.length > 0) {
        setTodayAttendance(todayRes.data[0]);
      } else if (todayRes && todayRes.data) {
        setTodayAttendance(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckIn = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await api.post('/attendance/check-in', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
          alert('Checked in successfully!');
          fetchData();
        } catch (err) {
          alert(err.response?.data?.message || 'Check-in failed');
        }
      },
      () => {
        alert('Unable to retrieve your location. Please enable location permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleCheckOut = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { data } = await api.post('/attendance/check-out', {
            latitude:  position.coords.latitude,
            longitude: position.coords.longitude,
          });
          fetchData();
          if (data.kpiAwarded && data.kpiAwarded.length > 0) {
            setKpiCelebration(data.kpiAwarded);
          }
        } catch (err) {
          alert(err.response?.data?.message || 'Check-out failed');
        }
      },
      () => {
        alert('Unable to retrieve your location. Please enable location permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (emp.employeeId && emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <>
    <div className="animate-fade-in max-w-7xl mx-auto space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
           <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Executive Overview</h1>
              <p className="text-sm sm:text-base text-slate-500">Welcome back! Here's what's happening today.</p>
           </div>
           
           {/* Check-In/Check-Out Button */}
           <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
              {!todayAttendance?.checkIn ? (
                 <button 
                   onClick={handleCheckIn}
                   className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition shadow-xl shadow-blue-100"
                 >
                   Check In
                 </button>
              ) : !todayAttendance?.checkOut ? (
                 <button 
                   onClick={handleCheckOut}
                   className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition shadow-xl shadow-slate-200"
                 >
                   Check Out
                 </button>
              ) : (
                 <div className="px-6 sm:px-8 py-3 sm:py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-bold border border-emerald-100 flex items-center gap-2">
                    <CheckCircle size={20} /> Attendance Marked
                 </div>
              )}

              {todayAttendance?.checkIn && (
                 <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full animate-pulse ${todayAttendance?.checkIn ? 'bg-green-500' : 'bg-slate-300'}`} />
                    <div className="flex flex-col">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Since</span>
                       <span className="text-xs font-bold text-slate-700">
                          {new Date(todayAttendance.checkIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                       </span>
                    </div>
                 </div>
              )}
           </div>
        </div>

         {/* Top Metric Cards */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
               <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users size={20} /></div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Staff</span>
               </div>
               <div className="text-3xl font-bold text-slate-900">{stats.totalEmployees}</div>
               <div className="text-sm text-slate-500 mt-1">Total Employees</div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group" onClick={() => navigate('/admin/verification-queue')}>
               <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Clock size={20} /></div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Verification Queue</span>
               </div>
               <div className="text-3xl font-bold text-slate-900">{employees.filter(e => e.kycStatus === 'Pending').length}</div>
               <div className="text-sm text-slate-500 mt-1">Pending Approval</div>
               <div className="mt-3 text-xs font-black text-amber-600 group-hover:text-amber-700 transition">View All →</div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
               <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle size={20} /></div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Attendance</span>
               </div>
               <div className="text-3xl font-bold text-slate-900">{attendanceStats.presentToday}</div>
               <div className="text-sm text-slate-500 mt-1">Present Today</div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
               <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Activity size={20} /></div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">KPI</span>
               </div>
               <div className="text-3xl font-bold text-slate-900">
                 {employees.reduce((sum, emp) => sum + (emp.totalKpi || 0), 0)}
               </div>
               <div className="text-sm text-slate-500 mt-1">Total KPI Points</div>
            </div>
         </div>

         {/* ── Company Assets widgets ── */}
         <AssetDashboardWidgets />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-800">Top Performing Employees</h3>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Quick search..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-full sm:w-64"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredEmployees.slice(0, 6).map(emp => (
                  <div key={emp._id} onClick={() => navigate(`/admin/employee/${emp._id}`)} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all cursor-pointer flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-blue-600">
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-800">
                           {emp.name} {emp.employeeId ? <span className="text-slate-400 font-normal ml-1">({emp.employeeId})</span> : ''}
                        </p>
                        <p className="text-[10px] text-slate-400">{emp.designation || 'Staff'}</p>
                      </div>
                    </div>
                    <div className="bg-blue-50 text-blue-700 font-bold text-xs px-2 py-1 rounded">
                      {emp.totalKpi} pts
                    </div>
                  </div>
                ))}
              </div>
           </div>

           <div className="space-y-6">
              <div className="bg-slate-900 rounded-3xl p-6 text-white overflow-hidden relative">
                 <div className="relative z-10">
                   <h3 className="font-bold flex items-center gap-2 mb-6">
                      <Cake size={20} className="text-amber-400" />
                      Celebrations
                   </h3>
                   <div className="space-y-4">
                      {upcomingBirthdays.slice(0, 3).map(b => (
                        <div key={b.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs">
                                {b.name.charAt(0)}
                             </div>
                             <div>
                                <p className="text-sm font-bold">{b.name}</p>
                                <p className="text-[10px] opacity-60">Birthday This Month</p>
                             </div>
                          </div>
                          <div className="text-amber-400 text-xs font-bold">
                             {new Date(b.birthDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      ))}
                      {upcomingBirthdays.length === 0 && (
                        <p className="text-xs opacity-50 italic">No upcoming birthdays</p>
                      )}
                   </div>
                 </div>
                 <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
              </div>

              <div className="bg-blue-600 rounded-3xl p-6 text-white">
                 <h3 className="font-bold mb-4">Quick Links</h3>
                 <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => navigate('/admin/attendance')} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl text-xs font-bold transition">Attendance</button>
                    <button onClick={() => navigate('/admin/tasks')} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl text-xs font-bold transition">Task Board</button>
                    <button onClick={() => navigate('/admin/payroll')} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl text-xs font-bold transition">Payroll</button>
                    <button onClick={() => navigate('/admin/employees')} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl text-xs font-bold transition">Directory</button>
                 </div>
              </div>
           </div>
        </div>
    </div>

      <KpiCelebrationPopup
        kpiAwarded={kpiCelebration}
        onClose={() => setKpiCelebration(null)}
      />
    </>
  )
}