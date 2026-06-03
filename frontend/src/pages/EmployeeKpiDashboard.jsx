import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/axios';
import {
  Trophy, TrendingUp, Award, Calendar, ChevronDown,
  Star, BarChart2, Clock
} from 'lucide-react';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear - 1 + i);

function StatCard({ icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50   text-blue-600   border-blue-100',
    emerald:'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber:  'bg-amber-50  text-amber-600  border-amber-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    rose:   'bg-rose-50   text-rose-600   border-rose-100',
  };
  const cls = colors[color] || colors.blue;
  return (
    <div className={`bg-white rounded-2xl border p-6 shadow-sm flex flex-col gap-3 ${cls.split(' ')[2]}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cls.split(' ')[0]} ${cls.split(' ')[1]}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className={`text-3xl font-black mt-0.5 ${cls.split(' ')[1]}`}>{value ?? '—'}</p>
        {sub && <p className="text-xs text-slate-400 font-semibold mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function EmployeeKpiDashboard({ employeeId: propEmployeeId }) {
  const { user } = useContext(AuthContext);

  const isPrivileged = ['Admin', 'HR', 'AGM', 'SuperAdmin'].includes(user?.role);
  // propEmployeeId allows admin pages to render this dashboard for any employee
  const targetId = propEmployeeId || user?._id;

  const now       = new Date();
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [year,  setYear]    = useState(now.getFullYear());
  const [data,  setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // Monthly & Yearly leaderboard previews
  const [monthlyLb, setMonthlyLb] = useState([]);
  const [yearlyLb,  setYearlyLb]  = useState([]);

  useEffect(() => {
    fetchDashboard();
  }, [month, year, targetId]);

  useEffect(() => {
    fetchLeaderboards();
  }, [month, year]);

  const fetchDashboard = async () => {
    if (!targetId) return;
    setLoading(true);
    setError('');
    try {
      const params = { month, year };
      if (isPrivileged && propEmployeeId) params.employeeId = propEmployeeId;
      const { data: res } = await api.get('/kpi/my-dashboard', { params });
      setData(res);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load KPI dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboards = async () => {
    try {
      const [mlRes, ylRes] = await Promise.all([
        api.get('/kpi/monthly-leaderboard', { params: { month, year } }),
        api.get('/kpi/yearly-leaderboard',  { params: { year } })
      ]);
      setMonthlyLb((mlRes.data || []).slice(0, 10));
      setYearlyLb((ylRes.data?.employees || []).slice(0, 10));
    } catch { /* silent */ }
  };

  const monthName = (m) => MONTHS[m - 1] || '';

  const rankBadge = (rank) => {
    if (!rank) return <span className="text-slate-400 font-bold text-sm">Unranked</span>;
    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    return (
      <span className="text-2xl font-black text-slate-800">
        {medals[rank] || `#${rank}`}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-2xl"><BarChart2 size={24} /></div>
            KPI Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">Your performance summary and leaderboard rankings</p>
        </div>

        {/* Period selectors for selected month/year view */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm">
          <Calendar size={16} className="text-slate-400" />
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="bg-transparent border-none text-sm font-bold outline-none cursor-pointer"
          >
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="bg-transparent border-none text-sm font-bold outline-none cursor-pointer"
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-bold">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading KPI data...</p>
          </div>
        </div>
      ) : data && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              icon={<TrendingUp size={20} />}
              label="Current Month KPI"
              value={data.currentMonthKpi}
              sub={`${monthName(now.getMonth() + 1)} ${now.getFullYear()}`}
              color="blue"
            />
            <StatCard
              icon={<Clock size={20} />}
              label="Previous Month KPI"
              value={data.previousMonthKpi}
              sub={`${monthName(now.getMonth() === 0 ? 12 : now.getMonth())} ${now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()}`}
              color="indigo"
            />
            <StatCard
              icon={<Calendar size={20} />}
              label={`Selected Month KPI`}
              value={data.selectedMonthKpi}
              sub={`${monthName(month)} ${year}`}
              color="purple"
            />
            <StatCard
              icon={<Award size={20} />}
              label="Current Year KPI"
              value={data.currentYearKpi}
              sub={`Jan – Dec ${now.getFullYear()}`}
              color="emerald"
            />
            <StatCard
              icon={<Star size={20} />}
              label={`${year} Year KPI`}
              value={data.selectedYearKpi}
              sub={`Full year ${year}`}
              color="amber"
            />
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-rose-50 text-rose-600">
                <Trophy size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Your Rankings</p>
                <div className="flex items-center gap-6 mt-2">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Monthly</p>
                    {rankBadge(data.monthlyRank)}
                  </div>
                  <div className="w-px h-10 bg-slate-100" />
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Yearly</p>
                    {rankBadge(data.yearlyRank)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Leaderboard Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Monthly Leaderboard */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
                <Trophy size={16} className="text-amber-500" />
                <h3 className="font-black text-slate-800 text-sm">
                  Monthly Leaderboard — {monthName(month)} {year}
                </h3>
              </div>
              <div className="divide-y divide-slate-50">
                {monthlyLb.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-slate-400">No data for this period</p>
                ) : monthlyLb.map((emp, i) => (
                  <div
                    key={emp._id}
                    className={`flex items-center gap-3 px-5 py-3 ${emp._id === targetId?.toString() ? 'bg-blue-50' : 'hover:bg-slate-50/50'}`}
                  >
                    <span className={`w-6 text-xs font-black ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-400' : 'text-slate-300'}`}>
                      {i + 1}
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                      {emp.name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {emp.name}
                        {emp._id === targetId?.toString() && <span className="ml-1 text-[10px] text-blue-600">(You)</span>}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{emp.department || emp.role}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-black text-emerald-600">{emp.totalKpi} pts</p>
                      <p className="text-[10px] text-slate-400">avg {emp.averageKpi}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Yearly Leaderboard */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
                <Star size={16} className="text-indigo-500" />
                <h3 className="font-black text-slate-800 text-sm">
                  Yearly Leaderboard — {year}
                </h3>
              </div>
              <div className="divide-y divide-slate-50">
                {yearlyLb.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-slate-400">No data for this year</p>
                ) : yearlyLb.map((emp, i) => (
                  <div
                    key={emp._id}
                    className={`flex items-center gap-3 px-5 py-3 ${emp._id === targetId?.toString() ? 'bg-blue-50' : 'hover:bg-slate-50/50'}`}
                  >
                    <span className={`w-6 text-xs font-black ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-400' : 'text-slate-300'}`}>
                      {i + 1}
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                      {emp.name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {emp.name}
                        {emp._id === targetId?.toString() && <span className="ml-1 text-[10px] text-blue-600">(You)</span>}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{emp.department || emp.role}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-black text-emerald-600">{emp.totalKpi} pts</p>
                      <p className="text-[10px] text-slate-400">avg {emp.averageKpi}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
