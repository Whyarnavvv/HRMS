import { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/axios';
import { AuthContext } from '../context/AuthContext';
import {
  ShieldCheck, Search, SlidersHorizontal, X, ChevronLeft, ChevronRight,
  Plus, Pencil, Eye, Trash2, Calendar, KeyRound, Users, AlertTriangle
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const ALLOWED_ROLES = ['SuperAdmin', 'Admin', 'HR'];

const ACTIONS = ['CREATED', 'UPDATED', 'FIELD_REVEALED', 'DELETED'];

const ACTION_META = {
  CREATED:        { label: 'Created',     color: 'bg-emerald-100 text-emerald-700', icon: Plus },
  UPDATED:        { label: 'Updated',     color: 'bg-blue-100 text-blue-700',       icon: Pencil },
  FIELD_REVEALED: { label: 'Viewed',      color: 'bg-amber-100 text-amber-700',     icon: Eye },
  DELETED:        { label: 'Deleted',     color: 'bg-red-100 text-red-700',         icon: Trash2 },
};

// Human-readable field names shown in the audit log
const FIELD_LABELS = {
  email1:          'Email 1 Address',
  email1Password:  'Email 1 Password',
  email2:          'Email 2 Address',
  email2Password:  'Email 2 Password',
  crmUserId:       'CRM User ID',
  crmPassword:     'CRM Password',
  laptopUsername:  'Laptop Username',
  laptopPassword:  'Laptop Password',
  desktopUsername: 'Desktop Username',
  desktopPassword: 'Desktop Password',
  phonePassword:   'Phone Password/PIN',
  simNumber:       'SIM Number',
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CredentialAuditPage() {
  const { user }     = useContext(AuthContext);
  const navigate     = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── All hooks must run unconditionally (Rules of Hooks) ──
  const actionFilter = searchParams.get('action')   || '';
  const dateFrom     = searchParams.get('dateFrom') || '';
  const dateTo       = searchParams.get('dateTo')   || '';
  const page         = Number(searchParams.get('page') || 1);

  const [logs, setLogs]               = useState([]);
  const [total, setTotal]             = useState(0);
  const [totalPages, setTotalPages]   = useState(1);
  const [loading, setLoading]         = useState(true);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats]             = useState({});

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

  const fetchLogs = useCallback(async () => {
    if (!ALLOWED_ROLES.includes(user.role)) return;
    setLoading(true);
    try {
      const search = searchParams.get('search') || '';
      const { data } = await api.get('/credentials/audit-log', {
        params: { action: actionFilter, search, dateFrom, dateTo, page, limit: 20 }
      });
      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, dateFrom, dateTo, page, searchParams, user.role]);

  const fetchStats = useCallback(async () => {
    if (!ALLOWED_ROLES.includes(user.role)) return;
    try {
      const counts = {};
      await Promise.all(
        ACTIONS.map(async (a) => {
          const { data } = await api.get('/credentials/audit-log', { params: { action: a, limit: 1 } });
          counts[a] = data.total;
        })
      );
      setStats(counts);
    } catch { /* non-critical */ }
  }, [user.role]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ── Access gate — AFTER all hooks ──
  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-slate-400">
        <ShieldCheck size={48} className="opacity-20" />
        <p className="text-sm font-black uppercase tracking-widest">Access Restricted</p>
        <p className="text-xs font-medium">Only Super Admin, Admin, and HR may view credential audit logs.</p>
      </div>
    );
  }
  const resetFilters = () => {
    setSearchInput('');
    setSearchParams({});
  };

  const hasActiveFilters = actionFilter || dateFrom || dateTo || searchParams.get('search');

  const fmt = (d) => d
    ? new Date(d).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : '—';

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 rounded-2xl">
              <KeyRound size={20} className="text-blue-400" />
            </div>
            Credential Audit Log
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5 ml-14">
            Every credential view, create, update, and delete is recorded here
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-2xl w-fit">
          <ShieldCheck size={14} className="text-emerald-600" />
          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Read-Only · Tamper-Proof</span>
        </div>
      </div>

      {/* ── Stats — clickable action filters ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { key: 'CREATED',        label: 'Created',     color: 'text-emerald-600' },
          { key: 'UPDATED',        label: 'Updated',     color: 'text-blue-600' },
          { key: 'FIELD_REVEALED', label: 'Viewed',      color: 'text-amber-600' },
          { key: 'DELETED',        label: 'Deleted',     color: 'text-red-600' },
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setParam({ action: actionFilter === key ? '' : key, page: '1' })}
            className={`bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-1 text-left transition-all hover:shadow-md ${
              actionFilter === key ? 'border-blue-400 ring-2 ring-blue-200' : 'border-slate-100'
            }`}
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className={`text-3xl font-black ${color}`}>{stats[key] ?? '—'}</p>
          </button>
        ))}
      </div>

      {/* ── Security notice ── */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
        <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs font-medium text-amber-700 leading-relaxed">
          This log captures every time a credential was <strong>created, updated, viewed, or deleted</strong>.
          The <strong>Viewed</strong> entries include which specific field was revealed (e.g. "laptopPassword").
          Logs are immutable — records cannot be edited or removed.
        </p>
      </div>

      {/* ── Toolbar ── */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by employee name, ID, or field name..."
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
                {['Event', 'Employee', 'Dept', 'Performed By', 'Role', 'Affected Fields', 'Timestamp', 'IP Address'].map(col => (
                  <th key={col} className="px-4 py-3.5 text-[11px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
                : logs.map((log) => (
                  <tr
                    key={log._id}
                    className={`border-t border-slate-100 hover:bg-slate-50/60 transition-colors ${
                      log.action === 'FIELD_REVEALED' ? 'bg-amber-50/20' :
                      log.action === 'DELETED'        ? 'bg-red-50/20'   : ''
                    }`}
                  >
                    {/* Event */}
                    <td className="px-4 py-3.5">
                      <ActionBadge action={log.action} />
                    </td>

                    {/* Target Employee */}
                    <td className="px-4 py-3.5">
                      {log.targetEmployee ? (
                        <button
                          onClick={() => navigate(`/admin/employee/${log.targetEmployee._id}`)}
                          className="text-left group"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-600 flex-shrink-0">
                              {log.targetEmployee.name?.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors whitespace-nowrap">
                                {log.targetEmployee.name}
                              </p>
                              {log.targetEmployee.employeeId && (
                                <p className="text-[10px] text-slate-400 font-bold">{log.targetEmployee.employeeId}</p>
                              )}
                            </div>
                          </div>
                        </button>
                      ) : <span className="text-slate-300">—</span>}
                    </td>

                    {/* Department */}
                    <td className="px-4 py-3.5 text-sm text-slate-600 font-medium whitespace-nowrap">
                      {log.targetEmployee?.department || <span className="text-slate-300">—</span>}
                    </td>

                    {/* Performed By (actor) */}
                    <td className="px-4 py-3.5">
                      {log.actorUserId ? (
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-[10px] font-black text-blue-600 flex-shrink-0">
                            {log.actorUserId.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800 whitespace-nowrap">{log.actorUserId.name}</p>
                            {log.actorUserId.employeeId && (
                              <p className="text-[10px] text-slate-400 font-bold">{log.actorUserId.employeeId}</p>
                            )}
                          </div>
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>

                    {/* Actor Role */}
                    <td className="px-4 py-3.5">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg whitespace-nowrap">
                        {log.actorRole || '—'}
                      </span>
                    </td>

                    {/* Affected Fields */}
                    <td className="px-4 py-3.5">
                      {log.affectedFields?.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {log.affectedFields.map(field => (
                            <span key={field} className={`text-[10px] font-bold px-2 py-0.5 rounded-lg whitespace-nowrap ${
                              log.action === 'FIELD_REVEALED'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {FIELD_LABELS[field] || field}
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>

                    {/* Timestamp */}
                    <td className="px-4 py-3.5 text-xs text-slate-500 font-medium whitespace-nowrap">
                      {fmt(log.createdAt)}
                    </td>

                    {/* IP */}
                    <td className="px-4 py-3.5 text-xs text-slate-400 font-mono whitespace-nowrap">
                      {log.ipAddress || '—'}
                    </td>
                  </tr>
                ))}

              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <ShieldCheck size={40} className="opacity-20" />
                      <p className="font-black text-sm uppercase tracking-widest">No audit records found</p>
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
              Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total} records
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
        <ShieldCheck size={11} />
        Audit records are immutable — they cannot be edited or deleted.
      </p>
    </div>
  );
}
