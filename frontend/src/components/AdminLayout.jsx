import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useContext, useEffect, useState, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/axios';
import ScreenTimeTracker from './ScreenTimeTracker';
import {
  LayoutDashboard,
  UserPlus,
  Users,
  LogOut,
  Clock,
  ListTodo,
  FileText,
  Award,
  Calendar,
  Cake,
  Settings,
  ShieldCheck,
  MapPin,
  Home,
  Monitor,
  ScrollText,
  Menu,
  X,
  Building2,
  Phone,
  Package,
  History,
  KeyRound,
  FileBarChart2
} from 'lucide-react';

const menuGroups = [
  {
    label: 'Personal Space',
    items: [
      { name: 'Dashboard', path: null, icon: <LayoutDashboard size={18} />, roles: ['Admin', 'HR', 'Manager', 'Employee', 'AGM', 'SuperAdmin'], dynamicPath: (role) => role === 'Employee' ? '/employee' : '/admin' },
      { name: 'My Profile', path: '/admin/profile', icon: <Users size={18} />, roles: ['Admin', 'HR', 'Manager', 'Employee', 'AGM', 'SuperAdmin'] },
      { name: 'Attendance History', path: '/admin/attendance', icon: <Clock size={18} />, roles: ['Admin', 'HR', 'Manager', 'Employee', 'AGM', 'SuperAdmin'] },
      { name: 'My Tasks', path: '/admin/tasks', icon: <ListTodo size={18} />, roles: ['Admin', 'HR', 'Manager', 'Employee', 'AGM', 'SuperAdmin'] },
      { name: 'Salary Slips', path: '/admin/my-payroll', icon: <FileText size={18} />, roles: ['Admin', 'HR', 'Manager', 'Employee', 'AGM', 'SuperAdmin'] },
      { name: 'KPI Leaderboard', path: '/admin/leaderboard', icon: <Award size={18} />, roles: ['Admin', 'HR', 'Manager', 'Employee', 'AGM', 'SuperAdmin'] },
      { name: 'My KPI Dashboard', path: '/admin/kpi-dashboard', icon: <Award size={18} />, roles: ['Admin', 'HR', 'Manager', 'Employee', 'AGM', 'SuperAdmin'] },
      { name: 'WFH Request',       path: '/admin/wfh-request',   icon: <Home size={18} />,          roles: ['Admin', 'HR', 'Manager', 'Employee', 'AGM', 'SuperAdmin'] },
      { name: 'My Assets',         path: '/admin/my-assets',       icon: <Package  size={18} />, roles: ['Employee', 'Manager'] },
      { name: 'My Credentials',   path: '/admin/my-credentials',  icon: <KeyRound size={18} />, roles: ['Admin', 'HR', 'Manager', 'Employee', 'AGM', 'SuperAdmin'] },
      { name: 'Screen Time',       path: '/admin/screen-time',   icon: <Monitor size={18} />,        roles: ['SuperAdmin'] },
      { name: 'Call Logs', path: '/counselling', icon: <Phone size={18} />, roles: ['Counselling Team'] },
    ]
  },
  {
    label: 'Management',
    roles: ['Admin', 'HR', 'Manager', 'AGM', 'SuperAdmin'],
    items: [
      { name: 'Task Management', path: '/admin/tasks', icon: <ListTodo size={18} />, roles: ['Admin', 'HR', 'Manager', 'AGM', 'SuperAdmin'] },
      { name: 'Employee Directory', path: '/admin/employees', icon: <Users size={18} />, roles: ['Admin', 'HR', 'AGM', 'SuperAdmin'] },
      { name: 'Team Attendance', path: '/admin/manage-attendance', icon: <Clock size={18} />, roles: ['Admin', 'HR', 'AGM', 'SuperAdmin'] },
      { name: 'Attendance Dashboard', path: '/admin/team-attendance', icon: <Calendar size={18} />, roles: ['HR', 'Admin', 'AGM', 'SuperAdmin'] },
      { name: 'Payroll Records', path: '/admin/payroll', icon: <FileText size={18} />, roles: ['Admin', 'HR', 'AGM', 'SuperAdmin'] },
      { name: 'KPI Management', path: '/admin/kpi-management', icon: <Award size={18} />, roles: ['Admin', 'HR', 'AGM', 'SuperAdmin'] },
      { name: 'Holiday Calendar', path: '/admin/holidays', icon: <Calendar size={18} />, roles: ['Admin', 'HR', 'AGM', 'SuperAdmin'] },
      { name: 'Onboard Staff', path: '/admin/add-employee', icon: <UserPlus size={18} />, roles: ['Admin', 'HR', 'SuperAdmin'] },
      { name: 'Verification Queue', path: '/admin/verification-queue', icon: <ShieldCheck size={18} />, roles: ['Admin', 'HR', 'AGM', 'SuperAdmin'] },
      { name: 'Geofences', path: '/admin/geofences', icon: <MapPin size={18} />, roles: ['Admin', 'AGM', 'SuperAdmin'] },
      { name: 'WFH Approvals', path: '/admin/wfh-approvals', icon: <Home size={18} />, roles: ['Admin', 'AGM', 'SuperAdmin'] },
      { name: 'Asset Inventory',   path: '/admin/assets',            icon: <Package      size={18} />, roles: ['Admin', 'HR', 'AGM', 'Manager', 'SuperAdmin'] },
      { name: 'Asset Assignments', path: '/admin/asset-assignments', icon: <UserPlus     size={18} />, roles: ['Admin', 'HR', 'AGM', 'Manager', 'SuperAdmin'] },
      { name: 'Asset History',     path: '/admin/asset-history',     icon: <History      size={18} />, roles: ['Admin', 'HR', 'AGM', 'Manager', 'SuperAdmin'] },
      { name: 'Asset Reports',     path: '/admin/asset-reports',     icon: <FileBarChart2 size={18} />, roles: ['Admin', 'HR', 'AGM', 'Manager', 'SuperAdmin'] },
      { name: 'Credential Audit',  path: '/admin/credential-audit',  icon: <KeyRound     size={18} />, roles: ['SuperAdmin', 'Admin', 'HR'] },
      { name: 'Company Management', path: '/admin/companies', icon: <Building2 size={18} />, roles: ['SuperAdmin'] },
      { name: 'Audit Logs', path: '/admin/audit-logs', icon: <ScrollText size={18} />, roles: ['SuperAdmin'] },
      { name: 'Screen Time Monitor', path: '/admin/screen-time', icon: <Monitor size={18} />, roles: ['SuperAdmin'] },
      { name: 'Counselling Logs', path: '/admin/counselling', icon: <Phone size={18} />, roles: ['SuperAdmin'] },
    ]
  }
];

function SidebarContent({ user, navigate, location, logout, birthdays }) {
  const navRef = useRef(null);

  return (
    <>
      <div className="flex items-center gap-3 mb-8 px-2 group cursor-pointer" onClick={() => navigate('/admin')}>
        <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
          <ShieldCheck size={22} />
        </div>
        <div>
          <h2 className="text-white font-black text-lg leading-none tracking-tight">Study Palace</h2>
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mt-1">Advanced HRMS</p>
        </div>
      </div>

      <div className="bg-slate-800/40 rounded-2xl p-4 mb-6 border border-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-400 font-bold text-sm">
            {user?.name?.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <p className="text-white font-bold text-sm truncate">{user?.name}</p>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400/80">{user?.role}</p>
              {user?.employeeId && (
                <>
                  <span className="text-slate-600 text-[8px]">•</span>
                  <span className="text-[9px] font-bold text-slate-500 tracking-tighter">{user.employeeId}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <nav ref={navRef} className="flex-1 space-y-8 overflow-y-auto no-scrollbar pr-1">
        {menuGroups.map((group, idx) => {
          const hasAccess = !group.roles || group.roles.includes(user?.role);
          if (!hasAccess) return null;

          return (
            <div key={idx} className="space-y-3">
              <p className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item, i) => {
                  if (!item.roles.includes(user?.role)) return null;
                  const resolvedPath = item.dynamicPath ? item.dynamicPath(user?.role) : item.path;
                  const isActive = location.pathname === resolvedPath;

                  return (
                    <button
                      key={i}
                      onClick={() => navigate(resolvedPath)}
                      className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all font-bold text-sm ${
                        isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'hover:bg-white/5 hover:text-slate-200'
                      }`}
                    >
                      {item.icon}
                      <span>{item.name}</span>
                      {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-sm" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="pt-4">
          <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-3xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                <Cake size={14} /> Celebrations
              </p>
              {birthdays.length > 0 && <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />}
            </div>
            <div className="space-y-3">
              {birthdays.length > 0 ? birthdays.slice(0, 2).map((b, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center font-bold text-xs text-indigo-300">
                    {b.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-300 truncate">{b.name}</p>
                    <p className="text-[9px] text-indigo-400/80 font-bold uppercase">{new Date(b.birthDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
                  </div>
                </div>
              )) : (
                <p className="text-[10px] text-slate-500 font-medium italic">No upcoming birthdays</p>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-6 mt-6 border-t border-slate-800 space-y-1">
        <button onClick={() => navigate('/admin/geofences')} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl hover:bg-white/5 transition-all text-sm font-bold">
          <Settings size={18} /> Settings
        </button>
        <button onClick={logout} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl hover:bg-red-500/10 hover:text-red-400 transition-all text-sm font-bold">
          <LogOut size={18} /> Sign Out
        </button>
      </div>
    </>
  );
}

export default function AdminLayout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [birthdays, setBirthdays] = useState([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const fetchBirthdays = async () => {
      try {
        if (!['Admin', 'HR', 'Manager', 'AGM', 'SuperAdmin', 'Employee'].includes(user?.role)) return;
        const { data } = await api.get('/employees/stats');
        setBirthdays(data.upcomingBirthdays || []);
      } catch (err) {
        console.error('Failed to fetch birthdays for sidebar');
      }
    };
    fetchBirthdays();
  }, []);

  useEffect(() => {
    setIsDrawerOpen(false);
  }, [location.pathname]);

  const sidebarProps = { user, navigate, location, logout, birthdays };

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <ScreenTimeTracker />
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-white px-4 py-3 border-b border-slate-200 lg:hidden">
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="p-2 rounded-xl border border-slate-200 text-slate-700"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-blue-600" />
          <p className="font-bold text-slate-800 text-sm">Study Palace HRMS</p>
        </div>
        <button onClick={logout} className="p-2 rounded-xl border border-slate-200 text-slate-700" aria-label="Sign out">
          <LogOut size={18} />
        </button>
      </header>

      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[86%] max-w-[320px] bg-slate-900 text-slate-400 p-5 flex flex-col border-r border-slate-800 shadow-2xl">
            <div className="mb-3 flex justify-end">
              <button onClick={() => setIsDrawerOpen(false)} className="p-2 rounded-lg bg-white/10 text-white">
                <X size={18} />
              </button>
            </div>
            <SidebarContent {...sidebarProps} />
          </aside>
        </div>
      )}

      <aside className="hidden lg:flex lg:w-[280px] bg-slate-900 text-slate-400 p-6 flex-col h-screen sticky top-0 border-r border-slate-800 shadow-2xl z-40">
        <SidebarContent {...sidebarProps} />
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-3 sm:p-4 lg:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl lg:rounded-[2.5rem] min-h-[calc(100vh-1.5rem)] p-4 sm:p-6 lg:p-8 shadow-sm border border-slate-200/50 overflow-x-hidden">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
