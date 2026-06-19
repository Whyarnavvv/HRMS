import { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/axios';
import { AuthContext } from '../context/AuthContext';
import ReturnAssetModal from '../components/ReturnAssetModal';
import {
  UserPlus, Search, SlidersHorizontal, ChevronLeft, ChevronRight,
  X, Eye, RotateCcw, Package,
  AlertTriangle, CheckCircle, Wrench, AlertOctagon
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const ASSIGNMENT_STATUS_STYLES = {
  Active:   'bg-emerald-50 text-emerald-700 border border-emerald-100',
  Returned: 'bg-slate-100 text-slate-500 border border-slate-200',
  Overdue:  'bg-red-50 text-red-600 border border-red-100',
};

const ASSIGNMENT_STATUS_ICONS = {
  Active:   <CheckCircle size={11} />,
  Returned: <RotateCcw   size={11} />,
  Overdue:  <AlertTriangle size={11} />,
};

const CONDITION_STYLES = {
  Good:    'bg-emerald-50 text-emerald-700',
  Damaged: 'bg-amber-50 text-amber-700',
  Lost:    'bg-red-50 text-red-600',
};

const CONDITION_ICONS = {
  Good:    <CheckCircle size={11} />,
  Damaged: <Wrench size={11} />,
  Lost:    <AlertOctagon size={11} />,
};

// ─── Shared sub-components ────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-1">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-3xl font-black ${color}`}>{value ?? '—'}</p>
    </div>
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AssetAssignments() {
  const { user }     = useContext(AuthContext);
  const navigate     = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // canWrite: only HR/Admin/SuperAdmin can process returns
  // Manager and AGM are read-only on this page
  const canWrite = ['Admin', 'HR', 'SuperAdmin'].includes(user.role);

  // URL-driven state
  const statusFilter = searchParams.get('status')     || '';
  const page         = Number(searchParams.get('page') || 1);

  // Local state
  const [assignments, setAssignments] = useState([]);
  const [total, setTotal]             = useState(0);
  const [totalPages, setTotalPages]   = useState(1);
  const [stats, setStats]             = useState({ active: 0, overdue: 0, returned: 0 });
  const [loading, setLoading]         = useState(true);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [returning, setReturning]     = useState(null); // assignment being returned

  // Debounce search → URL
  useEffect(() => {
    const t = setTimeout(() => {
      setParam({ search: searchInput, page: '1' });
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const setParam = (updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (!v) next.delete(k); else next.set(k, v);
    });
    setSearchParams(next, { replace: true });
  };

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const search = searchParams.get('search') || '';
      const { data } = await api.get('/assets/assignments', {
        params: { status: statusFilter, search, page, limit: 15 }
      });
      setAssignments(data.assignments);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, searchParams]);

  // Fetch summary stats (separate lightweight calls)
  const fetchStats = useCallback(async () => {
    try {
      const [active, overdue, returned] = await Promise.all([
        api.get('/assets/assignments', { params: { status: 'Active',   limit: 1 } }),
        api.get('/assets/assignments', { params: { status: 'Overdue',  limit: 1 } }),
        api.get('/assets/assignments', { params: { status: 'Returned', limit: 1 } }),
      ]);
      setStats({
        active:   active.data.total,
        overdue:  overdue.data.total,
        returned: returned.data.total,
      });
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);
  useEffect(() => { fetchStats(); }, []);

  const refresh = () => { fetchAssignments(); fetchStats(); };

  const hasActiveFilters = statusFilter || searchParams.get('search');

  const resetFilters = () => {
    setSearchInput('');
    setSearchParams({});
  };

  const fmt = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : <span className="text-slate-300">—</span>;

  return (
    <>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Asset Assignments</h1>
            <p className="text-sm text-slate-500 font-medium mt-0.5">Track all asset assignments across employees</p>
          </div>
          <button
            onClick={() => navigate('/admin/assets')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 transition active:scale-95 w-full sm:w-auto justify-center"
          >
            <Package size={16} /> Asset Inventory
          </button>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Assignments" value={total}         color="text-slate-800" />
          <StatCard label="Active"            value={stats.active}  color="text-emerald-600" />
          <StatCard label="Overdue"           value={stats.overdue} color="text-red-600" />
          <StatCard label="Returned"          value={stats.returned}color="text-slate-500" />
        </div>

        {/* ── Toolbar ── */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by employee, employee ID, asset name..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(p => !p)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition border ${
                showFilters || hasActiveFilters
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal size={15} />
              Filters
              {hasActiveFilters && (
                <span className="bg-white text-blue-600 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {[statusFilter, searchParams.get('search')].filter(Boolean).length}
                </span>
              )}
            </button>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-red-500 border border-slate-200 hover:border-red-100 transition"
              >
                <X size={14} /> Reset
              </button>
            )}
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="pt-1 border-t border-slate-100">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Status
                </label>
                <div className="flex flex-wrap gap-2">
                  {['', 'Active', 'Overdue', 'Returned'].map(s => (
                    <button
                      key={s}
                      onClick={() => setParam({ status: s, page: '1' })}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition border ${
                        statusFilter === s
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {s || 'All Statuses'}
                    </button>
                  ))}
                </div>
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
                  {[
                    'Employee',
                    'Employee ID',
                    'Department',
                    'Asset',
                    'Asset No.',
                    'Model',
                    'Qty',
                    'Assigned Date',
                    'Expected Return',
                    'Status',
                    'Condition',
                    'Actions'
                  ].map(col => (
                    <th
                      key={col}
                      className="px-4 py-3.5 text-[11px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={11} />)
                  : assignments.map(a => {
                    const isOverdue = a.status === 'Overdue';
                    return (
                      <tr
                        key={a._id}
                        className={`border-t border-slate-100 transition-colors group ${
                          isOverdue ? 'bg-red-50/30 hover:bg-red-50/50' : 'hover:bg-slate-50/60'
                        }`}
                      >
                        {/* Employee */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-xs font-black text-blue-600 flex-shrink-0">
                              {a.employee?.name?.charAt(0) || '?'}
                            </div>
                            <p className="font-bold text-slate-800 text-sm whitespace-nowrap">
                              {a.employee?.name || '—'}
                            </p>
                          </div>
                        </td>

                        {/* Employee ID */}
                        <td className="px-4 py-4 text-xs font-black text-slate-500 tracking-wider">
                          {a.employee?.employeeId || <span className="text-slate-300 font-normal">—</span>}
                        </td>

                        {/* Department */}
                        <td className="px-4 py-4 text-sm text-slate-600 font-medium whitespace-nowrap">
                          {a.employee?.department || <span className="text-slate-300">—</span>}
                        </td>

                        {/* Asset */}
                        <td className="px-4 py-4">
                          <button
                            onClick={() => navigate(`/admin/assets/${a.asset?._id}`)}
                            className="font-bold text-slate-800 text-sm hover:text-blue-600 transition-colors text-left whitespace-nowrap"
                          >
                            {a.asset?.assetName || '—'}
                          </button>
                        </td>

                        {/* Asset No. */}
                        <td className="px-4 py-4">
                          <span className="font-black text-slate-600 text-xs tracking-wider bg-slate-100 px-2 py-1 rounded-lg whitespace-nowrap">
                            {a.asset?.assetNumber || '—'}
                          </span>
                        </td>

                        {/* Model */}
                        <td className="px-4 py-4 text-sm text-slate-600 font-medium whitespace-nowrap">
                          {a.asset?.modelName || <span className="text-slate-300">—</span>}
                        </td>

                        {/* Quantity */}
                        <td className="px-4 py-4">
                          <span className="font-black text-slate-800">{a.quantity}</span>
                        </td>

                        {/* Assigned Date */}
                        <td className="px-4 py-4 text-sm text-slate-600 font-medium whitespace-nowrap">
                          {fmt(a.assignedDate)}
                        </td>

                        {/* Expected Return */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {a.expectedReturnDate ? (
                            <span className={`text-sm font-bold ${isOverdue ? 'text-red-600' : 'text-slate-600'}`}>
                              {fmt(a.expectedReturnDate)}
                              {isOverdue && <AlertTriangle size={11} className="inline ml-1 mb-0.5" />}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-sm">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap ${ASSIGNMENT_STATUS_STYLES[a.status] || 'bg-slate-100 text-slate-600'}`}>
                            {ASSIGNMENT_STATUS_ICONS[a.status]}
                            {a.status}
                          </span>
                        </td>

                        {/* Condition (shown only on returned assignments) */}
                        <td className="px-4 py-4">
                          {a.returnCondition ? (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap ${CONDITION_STYLES[a.returnCondition] || 'bg-slate-100 text-slate-600'}`}>
                              {CONDITION_ICONS[a.returnCondition]}
                              {a.returnCondition}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-sm">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                            {/* View asset */}
                            <button
                              onClick={() => navigate(`/admin/assets/${a.asset?._id}`)}
                              title="View Asset"
                              className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                            >
                              <Eye size={15} />
                            </button>

                            {/* Return */}
                            {canWrite && (a.status === 'Active' || a.status === 'Overdue') && (
                              <button
                                onClick={() => setReturning(a)}
                                title="Return Asset"
                                className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 bg-slate-50 hover:bg-emerald-50 px-3 py-1.5 rounded-xl transition-all border border-transparent hover:border-emerald-100"
                              >
                                <RotateCcw size={12} /> Return
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {!loading && assignments.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <UserPlus size={40} className="opacity-20" />
                        <p className="font-black text-sm uppercase tracking-widest">No assignments found</p>
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
                Showing {((page - 1) * 15) + 1}–{Math.min(page * 15, total)} of {total} assignments
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
                        p === page
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'border border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {p}
                    </button>
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
      </div>

      {/* ── Return Modal ── */}
      {returning && (
        <ReturnAssetModal
          assignment={returning}
          assetId={returning.asset?._id}
          onClose={() => setReturning(null)}
          onReturned={refresh}
        />
      )}
    </>
  );
}
