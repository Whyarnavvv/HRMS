import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/axios';
import { Users, Search, Filter, Cake, Briefcase, Mail, Phone, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function EmployeeManagement() {
  const { user: currentUser } = useContext(AuthContext);
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [searchTerm, departmentFilter, statusFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [empRes, statsRes] = await Promise.all([
        api.get(`/employees?search=${searchTerm}&department=${departmentFilter}`),
        api.get('/employees/stats')
      ]);
      const filtered = statusFilter
        ? empRes.data.filter(e => e.isActive === statusFilter)
        : empRes.data;
      setEmployees(filtered);
      setStats(statsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const departments = ['Marketing', 'Admission', 'Accounts', 'Counselling', 'Management'];

  if (loading && employees.length === 0) return <div className="p-8">Loading employees...</div>;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Employee Directory</h1>
          <p className="text-sm sm:text-base text-slate-500">Manage team members and organizational structure</p>
        </div>
        <div className="flex gap-3 sm:gap-4">
           {/* Stats Cards in header */}
           <div className="bg-blue-600 text-white px-4 sm:px-6 py-3 rounded-2xl shadow-lg shadow-blue-100 flex items-center gap-3">
              <Users size={20} />
              <div>
                <p className="text-[10px] uppercase font-bold opacity-80">Total Staff</p>
                <p className="text-xl font-bold leading-tight">{stats?.totalEmployees || 0}</p>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8">
        {/* Sidebar Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="text"
                  placeholder="Name, ID or Email..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Status</label>
              <select
                className="w-full p-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive (Left)</option>
              </select>
            </div>

            <div>
              <select 
                className="w-full p-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Upcoming Birthdays widget */}
          <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
             <div className="relative z-10">
               <div className="flex items-center gap-2 mb-4">
                 <Cake size={20} />
                 <h3 className="font-bold">Upcoming Birthdays</h3>
               </div>
               <div className="space-y-4">
                  {(stats?.upcomingBirthdays || []).slice(0, 3).map(b => (
                    <div key={b.name} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-400/30 flex items-center justify-center font-bold text-xs uppercase">
                        {b.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{b.name}</p>
                        <p className="text-[10px] opacity-70 cursor-default">{new Date(b.birthDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
                      </div>
                    </div>
                  ))}
                  {(!stats?.upcomingBirthdays || stats.upcomingBirthdays.length === 0) && (
                    <p className="text-xs opacity-60">No birthdays this month</p>
                  )}
               </div>
             </div>
             <Cake className="absolute -right-4 -bottom-4 opacity-10 rotate-12" size={120} />
          </div>
        </div>

        {/* Main Grid */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {employees.map(emp => (
            <div key={emp._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-xl transition-all group">
              <div className="h-20 bg-slate-50 relative">
                 <div className="absolute -bottom-10 left-6">
                    {emp.profilePic ? (
                      <img src={emp.profilePic} className="w-20 h-20 rounded-2xl border-4 border-white object-cover shadow-sm" alt="" />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl border-4 border-white bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-2xl shadow-sm">
                        {emp.name.charAt(0)}
                      </div>
                    )}
                 </div>
                 <div className="absolute top-4 right-4 flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase py-1 px-3 rounded-full ${
                      emp.isActive === 'Inactive' ? 'bg-red-100 text-red-600' : 'bg-white/80 backdrop-blur text-slate-500'
                    }`}>
                      {emp.isActive === 'Inactive' ? 'Inactive' : emp.employeeId || 'No ID'}
                    </span>
                 </div>
              </div>
              
              <div className="pt-12 p-6">
                 <div className="mb-4">
                    <h3 className="font-bold text-lg text-slate-800">{emp.name} <span className="text-slate-400 font-normal ml-1">({emp.employeeId || 'ID Pending'})</span></h3>
                    <p className="text-sm text-blue-600 font-semibold">{emp.designation || 'Staff'}</p>
                 </div>

                 <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                       <Briefcase size={14} className="text-slate-300" />
                       {emp.department || 'General'}
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                       <Mail size={14} className="text-slate-300" />
                       {emp.email}
                    </div>
                    {emp.phoneNumber && (
                      <div className="flex items-center gap-2 text-slate-500 text-xs">
                        <Phone size={14} className="text-slate-300" />
                        {emp.phoneNumber}
                      </div>
                    )}
                 </div>

                 <div className="flex gap-2">
                    <Link 
                      to={`/admin/employee/${emp._id}`}
                      className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition"
                    >
                       View Profile <ExternalLink size={12} />
                    </Link>
                 </div>
              </div>
            </div>
          ))}
          {employees.length === 0 && (
            <div className="col-span-full py-20 text-center space-y-4">
               <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
                  <Search size={32} />
               </div>
               <p className="text-slate-400 font-medium">No employees found matching your search</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
