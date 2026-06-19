import { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/axios';
import { AuthContext } from '../context/AuthContext';
import {
  History, Search, SlidersHorizontal, X, ChevronLeft, ChevronRight,
  Package, Plus, Pencil, UserPlus, RotateCcw, Wrench, AlertOctagon,
  Trash2, RefreshCw, ShieldAlert, Eye, Calendar, User, ArrowUpDown
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const ACTIONS = [
  'CREATED', 'UPDATED', 'ASSIGNED', 'RETURNED',
  'DAMAGED', 'LOST', 'STATUS_CHANGED', 'RETIRED', 'DELETED'
];

const ACTION_META = {
  CREATED:        { label: 'Created',        color: 'bg-emerald-100 text-emerald-700', icon: Plus },
  UPDATED:        { label: 'Updated',        color: 'bg-blue-100 text-blue-700',       icon: Pencil },
  ASSIGNED:       { label: 'Assigned',       color: 'bg-indigo-100 text-indigo-700',   icon: UserPlus },
  RETURNED:       { label: 'Returned',       color: 'bg-teal-100 text-teal-700',       icon: RotateCcw },
  DAMAGED:        { label: 'Damaged',        color: 'bg-amber-100 text-amber-700',     icon: Wrench },
  LOST:           { label: 'Lost',           color: 'bg-red-100 text-red-700',         icon: AlertOctagon },
  STATUS_CHANGED: { label: 'Status Changed', color: 'bg-orange-100 text-orange-700',   icon: RefreshCw },
  RETIRED:        { label: 'Retired',        color: 'bg-slate-100 text-slate-600',     icon: ShieldAlert },
  DELETED:        { label: 'Deleted',        color: 'bg-red-200 text-red-800',         icon: Trash2 },
};

// ─── Shared sub-components ────────────────────────────────────────────────────
function ActionBadge({ action }) {
  const meta = ACTION_META[action] || { label: action, color: 'bg-slate-100 text-slate-600', icon: Eye };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black uppercase tracking-wide whitespace-nowrap ${meta.color}`}>
      <Icon size={10} />
      {meta.label}
    </span>
  );
}

function SkeletonRow({ cols }) {
  return (
    <tr className="border-t border-slate-100 animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-3 bg-slate-100 rounded-full w-3/4" />
        </td>
      ))}
    </tr>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-1">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-3xl font-black ${color}`}>{value ?? '—'}</p>
    </div>
  );
}

// ─── Changes diff inline display ──────────────────────────────────────────────
function ChangesDiff({ changes }) {
  if (!changes || Object.keys(changes).length === 0) return null;
  return (
    <div className="mt-1.5 space-y-0.5">
      {Object.entries(changes).map(([field, diff]) => (
        <p key={field} className="text-[10px] font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg inline-block mr-1">
          <span className="font-black text-slate-600">{field}:</span>{' '}
          {diff.from != null && <span className="text-red-400 line-through">{String(diff.from)}</span>}
          {diff.from != null && diff.to != null && ' → '}
          {diff.to != null && <span className="text-emerald-600">{String(diff.to)}</span>}
        </p>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AssetHistoryPage() {
  const { user }     = useContext(AuthContext);
  const navigate     = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Employees don't have access to the global history page — redirect them
  const READ_ROLES = ['Admin', 'HR', 'AGM', 'Manager', 'SuperAdmin'];
  if (!READ_ROLES.includes(user.role)) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-slate-400">
        <History size={48} className="opacity-20" />
        <p className="text-sm font-black uppercase tracking-widest">Access Restricted</p>
        <p className="text-xs font-medium">You don't have permission to view asset history.</p>
        <button onClick={() => navigate('/admin/my-assets')} className="text-xs font-bold text-blue-600 hover:underline mt-2">
          View My Assets →
        </button>
      </div>
    );
  }

  // URL-driven state
  const actionFilter = searchParams.get('action')   || '';
  const dateFrom     = searchParams.get('dateFrom') || '';
  const dateTo       = searchParams.get('dateTo')   || '';
  const page         = Number(searchParams.get('page') || 1);

  // Local state
  const [history, setHistory]     = useState([]);
  const [total, setTotal]         = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]     = useState(true);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats]         = useState({});

  const setParam = useCallback((updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (!v) next.delete(k); else next.set(k, v);
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Debounce search → URL
  useEffect(() => {
    const t = setTimeout(() => setParam({ search: searchInput, page: '1' }), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const search = searchParams.get('search') || '';
      const { data } = await api.get('/assets/history', {
        params: { action: actionFilter, search, dateFrom, dateTo, page, limit: 20 }
      });
      setHistory(data.history);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, dateFrom, dateTo, page, searchParams]);

  // Lightweight stats by action
  const fetchStats = useCallback(async () => {
    try {
      const counts = {};
      await Promise.all(
        ['CREATED', 'ASSIGNED', 'RETURNED', 'DAMAGED', 'LOST', 'DELETED'].map(async (a) => {
          const { data } = await api.get('/assets/history', { params: { action: a, limit: 1 } });
          counts[a] = data.total;
        })
      );
      setStats(counts);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);
  useEffect(() => { fetchStats(); }, []);

  const resetFilters = () => {
    setSearchInput('');
    setSearchParams({});
  };

  const hasActiveFilters = actionFilter || dateFrom || dateTo || searchParams.get('search');

  const fmt = (d) => d
    ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Asset History</h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5">
            Immutable audit trail of every asset event
          </p>
        </div>
        <button
          onClick={() => navigate('/admin/assets')}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-2xl font-bold text-sm transition active:scale-95 w-full sm:w-auto justify-center"
        >
          <Package size={16} /> Asset Inventory
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { key: 'CREATED',  label: 'Created',  color: 'text-emerald-600' },
          { key: 'ASSIGNED', label: 'Assigned', color: 'text-indigo-600' },
          { key: 'RETURNED', label: 'Returned', color: 'text-teal-600' },
          { key: 'DAMAGED',  label: 'Damaged',  color: 'text-amber-600' },
          { key: 'LOST',     label: 'Lost',     color: 'text-red-600' },
          { key: 'DELETED',  label: 'Deleted',  color: 'text-slate-500' },
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setParam({ action: actionFilter === key ? '' : key, page: '1' })}
            className={`bg-white rounded-2xl border shadow-sm p-4 flex flex-col gap-1 text-left transition-all hover:shadow-md ${
              actionFilter === key ? 'border-blue-400 ring-2 ring-blue-200' : 'border-slate-100'
            }`}
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className={`text-2xl font-black ${color}`}>{stats[key] ?? '—'}</p>
          </button>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by asset name, number, or user..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {searchInput && (
              <button onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(p => !p)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition border ${
              showFilters || hasActiveFilters
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <SlidersHorizontal size={15} /> Filters
            {hasActiveFilters && (
              <span className="bg-white text-blue-600 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {[actionFilter, dateFrom, dateTo, searchParams.get('search')].filter(Boolean).length}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button onClick={resetFilters} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-red-500 border border-slate-200 hover:border-red-100 transition">
              <X size={14} /> Reset
            </button>
          )}
        </div>

        {showFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Action filter */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Event Type</label>
              <select
                value={actionFilter}
                onChange={e => setParam({ action: e.target.value, page: '1' })}
                className="w-full bg-slate-50 border-none rounded-xl py-2.5 px-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">All Events</option>
                {ACTIONS.map(a => (
                  <option key={a} value={a}>{ACTION_META[a]?.label || a}</option>
                ))}
              </select>
            </div>

            {/* Date from */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                <span className="flex items-center gap-1"><Calendar size={10} /> From Date</span>
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setParam({ dateFrom: e.target.value, page: '1' })}
                className="w-full bg-slate-50 border-none rounded-xl py-2.5 px-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Date to */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                <span className="flex items-center gap-1"><Calendar size={10} /> To Date</span>
              </label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={e => setParam({ dateTo: e.target.value, page: '1' })}
                className="w-full bg-slate-50 border-none rounded-xl py-2.5 px-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Event', 'Asset', 'Asset No.', 'Category', 'Performed By', 'Role', 'Timestamp', 'Remarks'].map(col => (
                  <th key={col} className="px-4 py-3.5 text-[11px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
                : history.map((entry) => (
                  <tr
                    key={entry._id}
                    className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors group"
                  >
                    {/* Event */}
                    <td className="px-4 py-3.5">
                      <ActionBadge action={entry.action} />
                      {entry.changes && Object.keys(entry.changes).length > 0 && (
                        <ChangesDiff changes={entry.changes} />
                      )}
                    </td>

                    {/* Asset */}
                    <td className="px-4 py-3.5">
                      {entry.asset ? (
                        <button
                          onClick={() => navigate(`/admin/assets/${entry.asset._id}`)}
                          className="font-bold text-slate-800 text-sm hover:text-blue-600 transition-colors text-left whitespace-nowrap"
                        >
                          {entry.asset.assetName}
                        </button>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Asset No. */}
                    <td className="px-4 py-3.5">
                      {entry.asset?.assetNumber ? (
                        <span className="font-black text-slate-600 text-xs tracking-wider bg-slate-100 px-2 py-1 rounded-lg">
                          {entry.asset.assetNumber}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3.5 text-sm text-slate-600 font-medium whitespace-nowrap">
                      {entry.asset?.category || <span className="text-slate-300">—</span>}
                    </td>

                    {/* Performed By */}
                    <td className="px-4 py-3.5">
                      {entry.performedBy ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-[10px] font-black text-blue-600 flex-shrink-0">
                            {entry.performedBy.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800 whitespace-nowrap">{entry.performedBy.name}</p>
                            {entry.performedBy.employeeId && (
                              <p className="text-[10px] text-slate-400 font-bold">{entry.performedBy.employeeId}</p>
                            )}
                          </div>
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3.5">
                      {entry.performedBy?.role ? (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">
                          {entry.performedBy.role}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>

                    {/* Timestamp */}
                    <td className="px-4 py-3.5 text-xs text-slate-500 font-medium whitespace-nowrap">
                      {fmt(entry.createdAt)}
                    </td>

                    {/* Remarks */}
                    <td className="px-4 py-3.5 max-w-[200px]">
                      {entry.remarks ? (
                        <p className="text-xs text-slate-500 font-medium italic truncate" title={entry.remarks}>
                          "{entry.remarks}"
                        </p>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}

              {!loading && history.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <History size={40} className="opacity-20" />
                      <p className="font-black text-sm uppercase tracking-widest">No history records found</p>
                      {hasActiveFilters && (
                        <button onClick={resetFilters} className="text-xs text-blue-600 font-bold hover:underline">
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500 font-medium">
              Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total} events
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setParam({ page: String(page - 1) })}
                className="p-1.5 rounded-xl border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-all"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => setParam({ page: String(p) })}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                      p === page ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >{p}</button>
                );
              })}
              <button
                disabled={page >= totalPages}
                onClick={() => setParam({ page: String(page + 1) })}
                className="p-1.5 rounded-xl border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-all"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Read-only notice */}
      <p className="text-[11px] text-slate-400 font-medium text-center flex items-center justify-center gap-1.5">
        <History size={11} />
        History records are immutable — they cannot be edited or deleted.
      </p>
    </div>
  );
}
