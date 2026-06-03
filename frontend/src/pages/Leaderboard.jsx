import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api, { baseURL } from '../utils/axios';
import {
  Trophy, Medal, Search,
  Star, Award, ChevronRight, Calendar, BarChart2
} from 'lucide-react';

const MONTHS = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec'
];
const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear - 1 + i);

// ─── Podium (top 3) ───────────────────────────────────────────────────────────
function Podium({ topThree, pointsKey }) {
  const imgSrc = (pic) => pic ? `${baseURL}${pic}` : null;

  const Card = ({ emp, rank, height, borderColor, bgGradient, medalIcon }) => (
    <div className={`flex flex-col items-center group ${rank === 1 ? '-translate-y-6' : ''}`}>
      <div className="relative mb-4">
        <div className={`${rank === 1 ? 'w-32 h-32' : 'w-24 h-24'} rounded-[2rem] border-4 ${borderColor} flex items-center justify-center font-black shadow-xl overflow-hidden group-hover:scale-105 transition-transform duration-500 bg-slate-100 text-slate-400`}>
          {imgSrc(emp.profilePic)
            ? <img src={imgSrc(emp.profilePic)} alt={emp.name} className="w-full h-full object-cover" />
            : <span className={rank === 1 ? 'text-4xl' : 'text-3xl'}>{emp.name?.charAt(0)}</span>}
        </div>
        {rank === 1 && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2">
            <Trophy size={48} className="text-amber-400 drop-shadow-lg animate-bounce" />
          </div>
        )}
        <div className={`absolute -bottom-2 -right-2 p-2 rounded-xl shadow-lg border-2 border-white ${rank === 1 ? 'bg-amber-500 text-white p-2.5 rounded-2xl' : rank === 2 ? 'bg-slate-300 text-white' : 'bg-orange-400 text-white'}`}>
          {medalIcon}
        </div>
      </div>
      <div className="text-center mb-4">
        <p className={`font-black text-slate-800 ${rank === 1 ? 'text-2xl' : 'text-lg'}`}>{emp.name}</p>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{emp.department || emp.role}</p>
        {emp.averageKpi != null && (
          <p className="text-[10px] text-slate-400 font-bold mt-0.5">avg {emp.averageKpi} pts/day</p>
        )}
      </div>
      <div className={`w-full ${height} rounded-t-[3rem] shadow-2xl ${bgGradient} p-6 flex flex-col items-center justify-center gap-2`}>
        <span className={`font-black opacity-40 ${rank === 1 ? 'text-5xl text-white' : 'text-4xl text-slate-400'}`}>#{rank}</span>
        <span className={`font-black ${rank === 1 ? 'text-4xl text-white drop-shadow-md' : 'text-2xl text-slate-800'}`}>
          {parseFloat(emp[pointsKey] || emp.totalKpi || 0).toFixed(1)}
        </span>
        <span className={`text-[10px] font-black uppercase tracking-widest ${rank === 1 ? 'text-white/80 bg-white/20 px-3 py-1 rounded-full' : 'text-slate-400'}`}>pts</span>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end max-w-5xl mx-auto pt-10">
      {topThree[1] && <Card emp={topThree[1]} rank={2} height="h-44" borderColor="border-slate-200" bgGradient="bg-white border-x border-t border-slate-100" medalIcon={<Medal size={18} />} />}
      {topThree[0] && <Card emp={topThree[0]} rank={1} height="h-60" borderColor="border-amber-300" bgGradient="bg-gradient-to-b from-amber-400 to-amber-600" medalIcon={<Star size={22} fill="currentColor" />} />}
      {topThree[2] && <Card emp={topThree[2]} rank={3} height="h-32" borderColor="border-orange-200" bgGradient="bg-white border-x border-t border-slate-100" medalIcon={<Award size={18} />} />}
    </div>
  );
}

// ─── List (rank 4+) ───────────────────────────────────────────────────────────
function LeaderList({ data, pointsKey, currentUserId }) {
  // data is already filtered by the parent; slice off top 3 since they appear on the podium
  const rest = data.slice(3);

  if (rest.length === 0) return (
    <div className="p-16 text-center text-slate-300 italic font-medium">No further rankings</div>
  );

  return (
    <div className="divide-y divide-slate-50">
      {rest.map((u, idx) => (
        <div
          key={u._id}
          className={`p-4 sm:p-5 flex items-center gap-4 hover:bg-slate-50/50 transition-colors ${
            u._id?.toString() === currentUserId ? 'bg-blue-50/60' : ''
          }`}
        >
          <div className="w-8 text-sm font-black text-slate-300">{(idx + 4).toString().padStart(2, '0')}</div>
          <div className="w-11 h-11 rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center text-slate-400 font-bold flex-shrink-0">
            {u.profilePic
              ? <img src={`${baseURL}${u.profilePic}`} alt="" className="w-full h-full object-cover" />
              : u.name?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-slate-800 truncate">
              {u.name}
              {u._id?.toString() === currentUserId && (
                <span className="ml-1 text-[10px] text-blue-600">(You)</span>
              )}
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase truncate">
              {u.department || u.role}{u.designation ? ` · ${u.designation}` : ''}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-black text-slate-800">
              {parseFloat(u[pointsKey] ?? u.totalKpi ?? 0).toFixed(1)}
            </p>
            <p className="text-[10px] text-slate-400">pts</p>
          </div>
          {u.averageKpi != null && (
            <div className="text-right flex-shrink-0 hidden sm:block w-16">
              <p className="font-black text-slate-500 text-sm">{u.averageKpi}</p>
              <p className="text-[10px] text-slate-400">avg</p>
            </div>
          )}
          <ChevronRight size={16} className="text-slate-200 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Leaderboard() {
  const { user } = useContext(AuthContext);
  const [tab, setTab] = useState('monthly'); // 'alltime' | 'monthly' | 'yearly'
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchData(); }, [tab, month, year]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      let res;
      if (tab === 'alltime') {
        res = await api.get('/kpi/leaderboard');
        setData(res.data || []);
      } else if (tab === 'monthly') {
        res = await api.get('/kpi/monthly-leaderboard', { params: { month, year } });
        setData(res.data || []);
      } else {
        res = await api.get('/kpi/yearly-leaderboard', { params: { year } });
        setData(res.data?.employees || []);
      }
    } catch (err) {
      setError('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  // Which field holds the displayed points for each tab
  const pointsKey = tab === 'monthly' ? 'monthlyPoints' : tab === 'yearly' ? 'yearlyPoints' : 'totalKpi';

  const filtered = data.filter(u => u.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const topThree = filtered.slice(0, 3);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-amber-50 text-amber-500 rounded-2xl"><Trophy size={28} /></div>
            Performance Leaderboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {tab === 'alltime' ? 'All-time cumulative KPI standings' :
             tab === 'monthly' ? `${MONTHS[month-1]} ${year} — Monthly KPI rankings` :
             `${year} — Yearly KPI rankings`}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Find an achiever..."
            className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-11 pr-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-blue-500/10 outline-none"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tab Switcher + Period Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Tabs */}
        <div className="flex gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
          {[
            { key: 'monthly',  label: 'Monthly' },
            { key: 'yearly',   label: 'Yearly'  },
            { key: 'alltime',  label: 'All‑Time' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                tab === t.key ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Period selectors */}
        {tab !== 'alltime' && (
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm">
            <Calendar size={14} className="text-slate-400" />
            {tab === 'monthly' && (
              <select
                value={month}
                onChange={e => setMonth(Number(e.target.value))}
                className="bg-transparent border-none text-sm font-bold outline-none cursor-pointer"
              >
                {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            )}
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="bg-transparent border-none text-sm font-bold outline-none cursor-pointer"
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-bold">{error}</div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Ranking the Champions...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-300">
          <BarChart2 size={48} className="opacity-30" />
          <p className="font-bold uppercase tracking-widest text-sm">No KPI data for this period</p>
        </div>
      ) : (
        <>
          {/* Podium */}
          {topThree.length > 0 && (
            <Podium topThree={topThree} pointsKey={pointsKey} />
          )}

          {/* Ranked list */}
          <div className="max-w-4xl mx-auto bg-white rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            {/* Table header */}
            <div className="px-5 py-4 border-b border-slate-50 grid grid-cols-12 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span className="col-span-1">#</span>
              <span className="col-span-5">Employee</span>
              <span className="col-span-3 text-right">Total KPI</span>
              <span className="col-span-3 text-right hidden sm:block">Avg / Entry</span>
            </div>

            <LeaderList
              data={filtered}
              pointsKey={pointsKey}
              currentUserId={user?._id?.toString()}
            />
          </div>
        </>
      )}
    </div>
  );
}
