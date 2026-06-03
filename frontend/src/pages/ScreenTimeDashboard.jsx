import { useContext, useEffect, useState } from 'react';
import api from '../utils/axios';
import { AuthContext } from '../context/AuthContext';
import { Monitor, Camera, ChevronDown, ChevronUp } from 'lucide-react';

const toHours = (s = 0) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const fmt = (d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

export default function ScreenTimeDashboard() {
  const { user } = useContext(AuthContext);

  // Only SuperAdmin may access this page
  if (user?.role !== 'SuperAdmin') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
        <Monitor size={40} className="opacity-30" />
        <p className="font-bold text-sm uppercase tracking-widest">Access Restricted</p>
        <p className="text-xs">Screen time data is visible to SuperAdmin only.</p>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const [rows, setRows]               = useState([]);
  const [fromDate, setFromDate]       = useState(today);
  const [toDate, setToDate]           = useState(today);
  const [loading, setLoading]         = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [ssConfig, setSsConfig]       = useState(0);
  const [savingConfig, setSavingConfig] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/screen-time/admin', {
        params: { fromDate, toDate }
      });
      setRows(data || []);
    } catch { setRows([]); } finally { setLoading(false); }
  };

  const loadConfig = async () => {
    try {
      const { data } = await api.get('/screen-time/screenshot-config');
      setSsConfig(data?.screenshotsPerDay || 0);
    } catch {}
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      await api.put('/screen-time/screenshot-config', { screenshotsPerDay: ssConfig });
      alert('Screenshot config saved.');
    } catch { alert('Failed to save.'); } finally { setSavingConfig(false); }
  };

  useEffect(() => { load(); loadConfig(); }, []);

  // Derive backend base URL safely — strips only the /api path suffix, not any /api in the hostname
  const BACKEND = (() => {
    const raw = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';
    if (!raw) return `http://${window.location.hostname}:5000`;
    try {
      const url = new URL(raw);
      // Remove trailing /api or /api/ from pathname only
      url.pathname = url.pathname.replace(/\/api\/?$/, '');
      return url.origin + (url.pathname === '/' ? '' : url.pathname);
    } catch {
      return raw.replace(/\/api\/?$/, '');
    }
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Screen Time Monitor</h1>
          <p className="text-sm text-slate-500 mt-1">SuperAdmin view — all employees</p>
        </div>

        {/* Screenshot config */}
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
          <Camera size={16} className="text-slate-400" />
          <span className="text-xs font-black uppercase text-slate-400">Screenshots/day</span>
          <input
            type="number" min="0" max="20"
            value={ssConfig}
            onChange={e => setSsConfig(Number(e.target.value))}
            className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold text-center"
          />
          <button
            onClick={saveConfig} disabled={savingConfig}
            className="bg-slate-900 text-white text-xs font-black px-3 py-1.5 rounded-lg hover:bg-black transition disabled:opacity-50"
          >Save</button>
        </div>
      </div>

      {/* Date filter */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase text-slate-400">From</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase text-slate-400">To</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold" />
        </div>
        <button onClick={load}
          className="bg-blue-600 text-white text-xs font-black px-5 py-2.5 rounded-xl hover:bg-blue-700 transition">
          Apply
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-200">
              <tr>
                <th className="px-5 py-4">Employee</th>
                <th className="px-5 py-4">Date</th>
                <th className="px-5 py-4">Login</th>
                <th className="px-5 py-4">Last Active</th>
                <th className="px-5 py-4">Active</th>
                <th className="px-5 py-4">Idle</th>
                <th className="px-5 py-4">Productivity</th>
                <th className="px-5 py-4">Screenshots</th>
                <th className="px-5 py-4">Idle Events</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-slate-400">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-slate-400 italic">No records for selected range</td></tr>
              )}
              {!loading && rows.map((r) => {
                const active = r.activeSeconds || 0;
                const total  = r.totalWorkingSeconds || 0;
                const pct    = total > 0 ? Math.round((active / total) * 100) : 0;
                const isOpen = expandedRow === r._id;

                return (
                  <>
                    <tr key={r._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {r.user?.profilePic
                            ? <img src={`${BACKEND}${r.user.profilePic}`} className="w-7 h-7 rounded-lg object-cover" alt="" />
                            : <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black">{r.user?.name?.charAt(0)}</div>
                          }
                          <div>
                            <p className="font-bold text-slate-800">{r.user?.name || '—'}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{r.user?.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-600">{r.date}</td>
                      <td className="px-5 py-4 text-slate-500">{fmt(r.sessionStart)}</td>
                      <td className="px-5 py-4 text-slate-500">{fmt(r.sessionEnd)}</td>
                      <td className="px-5 py-4 font-bold text-emerald-600">{toHours(active)}</td>
                      <td className="px-5 py-4 font-bold text-amber-500">{toHours(r.idleSeconds)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-black text-slate-600">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-black text-slate-700">{r.screenshots?.length || 0}</span>
                        {r.screenshots?.length > 0 && (
                          <button onClick={() => setExpandedRow(isOpen ? null : r._id)}
                            className="ml-2 text-blue-500 hover:text-blue-700 transition">
                            {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs font-bold text-slate-500">
                        {r.idleEvents?.length || 0}
                        {r.idleEvents?.length > 0 && (
                          <span className="ml-1 text-[10px] text-amber-500">
                            ({r.idleEvents.filter(e => e.reason === 'tab_closed').length} tab close)
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Screenshot gallery row */}
                    {isOpen && r.screenshots?.length > 0 && (
                      <tr key={`${r._id}-ss`} className="bg-slate-50">
                        <td colSpan={9} className="px-5 py-4">
                          <p className="text-[10px] font-black uppercase text-slate-400 mb-3">Captured Screenshots</p>
                          <div className="flex flex-wrap gap-3">
                            {r.screenshots.map((ss, i) => (
                              <div key={i} className="flex flex-col items-center gap-1">
                                <a href={`${BACKEND}/uploads/screenshots/${ss.filename}`} target="_blank" rel="noreferrer">
                                  <img
                                    src={`${BACKEND}/uploads/screenshots/${ss.filename}`}
                                    alt={`Screenshot ${i + 1}`}
                                    className="w-40 h-24 object-cover rounded-xl border border-slate-200 hover:scale-105 transition-transform shadow-sm"
                                  />
                                </a>
                                <span className="text-[9px] text-slate-400 font-bold">
                                  {new Date(ss.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
