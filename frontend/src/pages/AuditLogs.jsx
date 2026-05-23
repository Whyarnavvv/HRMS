import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/axios';
import {
  Calendar, ChevronRight, X, RefreshCw, Users, Building2,
  Filter, Clock, Search, ChevronLeft, ChevronDown
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────
const PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'Custom', value: 'custom' },
];

const ACTION_COLORS = {
  CREATE: 'bg-emerald-100 text-emerald-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  LOGIN:  'bg-purple-100 text-purple-700',
  LOGOUT: 'bg-slate-100 text-slate-600',
};

const PAGE_SIZE = 20;

function getPresetDates(preset) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  if (preset === 'today') return { from: today, to: today };
  if (preset === '7d') {
    const d = new Date(now); d.setDate(d.getDate() - 6);
    return { from: d.toISOString().split('T')[0], to: today };
  }
  if (preset === '30d') {
    const d = new Date(now); d.setDate(d.getDate() - 29);
    return { from: d.toISOString().split('T')[0], to: today };
  }
  return { from: '', to: '' };
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="border-t animate-pulse">
      {[1,2,3,4,5,6].map(i => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-slate-200 rounded-full w-3/4" />
        </td>
      ))}
    </tr>
  );
}

// ─── Action badge ─────────────────────────────────────────────────────────────
function ActionBadge({ action }) {
  const key = Object.keys(ACTION_COLORS).find(k => action?.toUpperCase().includes(k));
  const cls = key ? ACTION_COLORS[key] : 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${cls}`}>
      {action}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AuditLogs() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Selection state (from URL)
  const selectedDept   = searchParams.get('dept') || '';
  const selectedUserId = searchParams.get('userId') || '';
  const preset         = searchParams.get('preset') || '7d';
  const customFrom     = searchParams.get('from') || '';
  const customTo       = searchParams.get('to') || '';
  const currentPage    = Number(searchParams.get('page') || 1);
  const moduleFilter   = searchParams.get('module') || '';
  const actionFilter   = searchParams.get('action') || '';

  // Data state
  const [departments, setDepartments]   = useState([]);
  const [users, setUsers]               = useState([]);
  const [logs, setLogs]                 = useState([]);
  const [totalPages, setTotalPages]     = useState(1);
  const [totalLogs, setTotalLogs]       = useState(0);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingLogs, setLoadingLogs]   = useState(false);

  // Mobile stepper
  const [mobileStep, setMobileStep] = useState(selectedUserId ? 3 : selectedDept ? 2 : 1);

  // Custom date picker visibility
  const [showCustom, setShowCustom] = useState(preset === 'custom');

  const abortRef = useRef(null);

  // ── Derived date range ──────────────────────────────────────────────────────
  const dateRange = preset === 'custom'
    ? { from: customFrom, to: customTo }
    : getPresetDates(preset);

  // ── URL helpers ─────────────────────────────────────────────────────────────
  const setParam = (updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v === '' || v === null || v === undefined) next.delete(k);
      else next.set(k, v);
    });
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  // ── Load departments ────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingDepts(true);
    api.get('/audit-logs/departments')
      .then(({ data }) => setDepartments(data))
      .catch(() => {})
      .finally(() => setLoadingDepts(false));
  }, []);

  // ── Load users when dept changes ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedDept) { setUsers([]); return; }
    setLoadingUsers(true);
    api.get('/audit-logs/users-by-department', { params: { department: selectedDept } })
      .then(({ data }) => setUsers(data))
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, [selectedDept]);

  // ── Load logs ───────────────────────────────────────────────────────────────
  const loadLogs = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoadingLogs(true);
    const params = {
      page: currentPage,
      limit: PAGE_SIZE,
      ...(selectedUserId && { userId: selectedUserId }),
      ...(selectedDept && !selectedUserId && { department: selectedDept }),
      ...(dateRange.from && { fromDate: dateRange.from }),
      ...(dateRange.to && { toDate: dateRange.to }),
      ...(moduleFilter && { module: moduleFilter }),
      ...(actionFilter && { action: actionFilter }),
    };

    api.get('/audit-logs', { params, signal: controller.signal })
      .then(({ data }) => {
        setLogs(data.records || []);
        setTotalPages(data.pages || 1);
        setTotalLogs(data.total || 0);
      })
      .catch((err) => { if (err.name !== 'CanceledError') setLogs([]); })
      .finally(() => setLoadingLogs(false));
  }, [selectedDept, selectedUserId, dateRange.from, dateRange.to, currentPage, moduleFilter, actionFilter]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const selectDept = (dept) => {
    setParam({ dept, userId: '', page: '1' });
    setMobileStep(2);
  };

  const selectUser = (uid) => {
    setParam({ userId: uid, page: '1' });
    setMobileStep(3);
  };

  const selectPreset = (p) => {
    setShowCustom(p === 'custom');
    if (p !== 'custom') setParam({ preset: p, from: '', to: '' });
    else setParam({ preset: p });
  };

  const reset = () => {
    setSearchParams({});
    setMobileStep(1);
    setShowCustom(false);
  };

  const selectedUser = users.find(u => u._id === selectedUserId);

  // ── Breadcrumb ───────────────────────────────────────────────────────────────
  const Breadcrumb = () => (
    <nav className="flex items-center gap-1.5 text-sm flex-wrap">
      <button
        onClick={() => { setParam({ dept: '', userId: '' }); setMobileStep(1); }}
        className="text-blue-600 font-semibold hover:underline"
      >All Teams</button>
      {selectedDept && (
        <>
          <ChevronRight size={14} className="text-slate-400" />
          <button
            onClick={() => { setParam({ userId: '' }); setMobileStep(2); }}
            className="text-blue-600 font-semibold hover:underline"
          >{selectedDept}</button>
        </>
      )}
      {selectedUser && (
        <>
          <ChevronRight size={14} className="text-slate-400" />
          <span className="text-slate-700 font-semibold">{selectedUser.name}</span>
        </>
      )}
      <ChevronRight size={14} className="text-slate-400" />
      <span className="text-slate-400 font-medium">Logs</span>
    </nav>
  );

  // ── Date filter bar ──────────────────────────────────────────────────────────
  const DateFilterBar = () => (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
        <Calendar size={15} className="text-blue-500" /> Date Range
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button
            key={p.value}
            onClick={() => selectPreset(p.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              preset === p.value
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >{p.label}</button>
        ))}
      </div>
      {(preset === 'custom' || showCustom) && (
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">From</label>
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={e => setParam({ from: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">To</label>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={e => setParam({ to: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      )}
      {/* Active filter pill */}
      {(dateRange.from || dateRange.to) && (
        <div className="flex items-center gap-2 pt-1">
          <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full border border-blue-100">
            <Clock size={11} />
            {dateRange.from && dateRange.to
              ? `${dateRange.from} → ${dateRange.to}`
              : dateRange.from ? `From ${dateRange.from}` : `Until ${dateRange.to}`}
          </span>
        </div>
      )}
    </div>
  );

  // ── Department list ──────────────────────────────────────────────────────────
  const DeptList = () => (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Building2 size={15} className="text-slate-500" />
        <span className="text-sm font-bold text-slate-700">Teams / Departments</span>
      </div>
      {loadingDepts ? (
        <div className="p-4 space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="h-9 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="p-2 space-y-1 max-h-72 overflow-y-auto">
          <button
            onClick={() => selectDept('')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              !selectedDept ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            <span className="flex items-center gap-2"><Users size={14} /> All Teams</span>
          </button>
          {departments.map(dept => (
            <button
              key={dept}
              onClick={() => selectDept(dept)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                selectedDept === dept ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <span className="flex items-center gap-2"><Building2 size={14} /> {dept}</span>
              {selectedDept === dept && <ChevronRight size={14} />}
            </button>
          ))}
          {departments.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">No departments found</p>
          )}
        </div>
      )}
    </div>
  );

  // ── User list ────────────────────────────────────────────────────────────────
  const UserList = () => (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Users size={15} className="text-slate-500" />
        <span className="text-sm font-bold text-slate-700">
          {selectedDept ? `${selectedDept} Members` : 'All Users'}
        </span>
      </div>
      {loadingUsers ? (
        <div className="p-4 space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-9 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="p-2 space-y-1 max-h-72 overflow-y-auto">
          <button
            onClick={() => selectUser('')}
            className={`w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              !selectedUserId ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-700'
            }`}
          >All Users in {selectedDept || 'System'}</button>
          {users.map(u => (
            <button
              key={u._id}
              onClick={() => selectUser(u._id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all ${
                selectedUserId === u._id ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                  selectedUserId === u._id ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                }`}>
                  {u.name.charAt(0)}
                </div>
                <div className="min-w-0 text-left">
                  <p className="font-semibold truncate text-xs">{u.name}</p>
                  <p className={`text-[10px] truncate ${selectedUserId === u._id ? 'text-blue-100' : 'text-slate-400'}`}>
                    {u.role}{u.employeeId ? ` · ${u.employeeId}` : ''}
                  </p>
                </div>
              </div>
              {selectedUserId === u._id && <ChevronRight size={14} className="flex-shrink-0" />}
            </button>
          ))}
          {users.length === 0 && !loadingUsers && (
            <p className="text-xs text-slate-400 text-center py-4">Select a team first</p>
          )}
        </div>
      )}
    </div>
  );

  // ── Logs table ───────────────────────────────────────────────────────────────
  const LogsTable = () => (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Table toolbar */}
      <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Filter size={14} className="text-slate-400" />
          <span className="text-sm font-bold text-slate-700">
            {totalLogs.toLocaleString()} log{totalLogs !== 1 ? 's' : ''}
          </span>
          {(selectedDept || selectedUserId) && (
            <span className="text-xs text-slate-400">
              {selectedUser ? `for ${selectedUser.name}` : selectedDept ? `in ${selectedDept}` : ''}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Module..."
              value={moduleFilter}
              onChange={e => setParam({ module: e.target.value })}
              className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl w-28 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Action..."
              value={actionFilter}
              onChange={e => setParam({ action: e.target.value })}
              className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl w-28 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            onClick={loadLogs}
            className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-all"
            title="Refresh"
          >
            <RefreshCw size={14} className={loadingLogs ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3 font-bold">Time</th>
              <th className="px-4 py-3 font-bold">User</th>
              <th className="px-4 py-3 font-bold">Role</th>
              <th className="px-4 py-3 font-bold">Module</th>
              <th className="px-4 py-3 font-bold">Action</th>
              <th className="px-4 py-3 font-bold">Target</th>
            </tr>
          </thead>
          <tbody>
            {loadingLogs
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              : logs.map(log => (
                <tr key={log._id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString([], {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-black flex-shrink-0">
                        {log.actorUserId?.name?.charAt(0) || 'S'}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-xs">{log.actorUserId?.name || 'System'}</p>
                        {log.actorUserId?.employeeId && (
                          <p className="text-[10px] text-slate-400">{log.actorUserId.employeeId}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{log.actorRole || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">
                      {log.module}
                    </span>
                  </td>
                  <td className="px-4 py-3"><ActionBadge action={log.action} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {log.targetEntity ? `${log.targetEntity}${log.targetId ? ` #${log.targetId.slice(-6)}` : ''}` : '—'}
                  </td>
                </tr>
              ))
            }
            {!loadingLogs && logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Filter size={28} className="opacity-30" />
                    <p className="font-semibold text-sm">No logs found</p>
                    <p className="text-xs">Try adjusting your filters or date range</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Page {currentPage} of {totalPages} · {totalLogs.toLocaleString()} total
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setParam({ page: String(currentPage - 1) })}
              className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-all"
            ><ChevronLeft size={14} /></button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i;
              return (
                <button
                  key={p}
                  onClick={() => setParam({ page: String(p) })}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                    p === currentPage ? 'bg-blue-600 text-white' : 'border border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >{p}</button>
              );
            })}
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setParam({ page: String(currentPage + 1) })}
              className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-all"
            ><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );

  // ── Mobile stepper ───────────────────────────────────────────────────────────
  const MobileStepper = () => (
    <div className="lg:hidden">
      <div className="flex items-center gap-1 mb-4">
        {['Teams', 'Users', 'Logs'].map((label, i) => (
          <div key={i} className="flex items-center gap-1 flex-1">
            <button
              onClick={() => {
                if (i === 0) { setParam({ dept: '', userId: '' }); setMobileStep(1); }
                if (i === 1 && selectedDept) { setParam({ userId: '' }); setMobileStep(2); }
                if (i === 2) setMobileStep(3);
              }}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs font-bold transition-all flex-1 justify-center ${
                mobileStep === i + 1
                  ? 'bg-blue-600 text-white'
                  : mobileStep > i + 1
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                mobileStep > i + 1 ? 'bg-blue-600 text-white' : ''
              }`}>{i + 1}</span>
              {label}
            </button>
            {i < 2 && <ChevronRight size={12} className="text-slate-300 flex-shrink-0" />}
          </div>
        ))}
      </div>
      {mobileStep === 1 && <DeptList />}
      {mobileStep === 2 && <UserList />}
      {mobileStep === 3 && <LogsTable />}
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800">Audit Logs</h1>
          <div className="mt-1.5"><Breadcrumb /></div>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all"
        >
          <X size={14} /> Reset
        </button>
      </div>

      {/* Date filter — always visible */}
      <DateFilterBar />

      {/* Desktop: 3-column layout */}
      <div className="hidden lg:grid lg:grid-cols-[220px_220px_1fr] gap-4 items-start">
        <DeptList />
        <UserList />
        <LogsTable />
      </div>

      {/* Mobile: stepper */}
      <MobileStepper />
    </div>
  );
}
