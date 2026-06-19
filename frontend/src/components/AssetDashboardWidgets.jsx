import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axios';
import {
  Package, UserPlus, RotateCcw, KeyRound,
  CheckCircle, Wrench, AlertOctagon, ShieldOff,
  Boxes, ChevronRight, Clock, AlertTriangle
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const fmtTime = (d) => d
  ? new Date(d).toLocaleString('en-IN', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit'
    })
  : '—';

// ─── Summary cards config ────────────────────────────────────────────────────
const SUMMARY_CARDS = [
  {
    key: 'total',
    label: 'Total Assets',
    icon: Boxes,
    iconBg:   'bg-slate-100',
    iconColor:'text-slate-600',
    valColor: 'text-slate-900',
    link:     '/admin/assets',
  },
  {
    key: 'available',
    label: 'Available',
    icon: CheckCircle,
    iconBg:   'bg-emerald-50',
    iconColor:'text-emerald-600',
    valColor: 'text-emerald-700',
    link:     '/admin/assets?status=Available',
  },
  {
    key: 'assigned',
    label: 'Assigned',
    icon: UserPlus,
    iconBg:   'bg-blue-50',
    iconColor:'text-blue-600',
    valColor: 'text-blue-700',
    link:     '/admin/asset-assignments?status=Active',
  },
  {
    key: 'damaged',
    label: 'Damaged',
    icon: Wrench,
    iconBg:   'bg-amber-50',
    iconColor:'text-amber-600',
    valColor: 'text-amber-700',
    link:     '/admin/assets?status=Under+Repair',
  },
  {
    key: 'lost',
    label: 'Lost',
    icon: AlertOctagon,
    iconBg:   'bg-red-50',
    iconColor:'text-red-600',
    valColor: 'text-red-700',
    link:     '/admin/asset-history?action=LOST',
  },
  {
    key: 'underRepair',
    label: 'Under Repair',
    icon: ShieldOff,
    iconBg:   'bg-orange-50',
    iconColor:'text-orange-600',
    valColor: 'text-orange-700',
    link:     '/admin/assets?status=Under+Repair',
  },
];

// ─── Credential action labels ─────────────────────────────────────────────────
const CRED_ACTION_META = {
  CREATED:        { label: 'Created',  color: 'bg-emerald-100 text-emerald-700' },
  UPDATED:        { label: 'Updated',  color: 'bg-blue-100 text-blue-700' },
  FIELD_REVEALED: { label: 'Viewed',   color: 'bg-amber-100 text-amber-700' },
  DELETED:        { label: 'Deleted',  color: 'bg-red-100 text-red-700' },
};

const FIELD_LABELS = {
  email1Password: 'Email 1 Password', email2Password: 'Email 2 Password',
  crmPassword: 'CRM Password', laptopPassword: 'Laptop Password',
  desktopPassword: 'Desktop Password', phonePassword: 'Phone PIN',
  email1: 'Email 1', email2: 'Email 2', crmUserId: 'CRM User ID',
  laptopUsername: 'Laptop User', desktopUsername: 'Desktop User', simNumber: 'SIM No.',
};

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-pulse">
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 bg-slate-100 rounded-xl" />
        <div className="w-16 h-3 bg-slate-100 rounded-full" />
      </div>
      <div className="w-12 h-8 bg-slate-100 rounded-lg mb-1" />
      <div className="w-20 h-3 bg-slate-100 rounded-full" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-50 animate-pulse">
      <div className="w-8 h-8 bg-slate-100 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-slate-100 rounded-full w-2/3" />
        <div className="h-2.5 bg-slate-100 rounded-full w-1/2" />
      </div>
      <div className="w-16 h-3 bg-slate-100 rounded-full" />
    </div>
  );
}

// ─── Main widget component ────────────────────────────────────────────────────
export default function AssetDashboardWidgets() {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    api.get('/assets/dashboard-stats')
      .then(({ data }) => setData(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // ── Summary Cards ──────────────────────────────────────────────────────────
  const SummarySection = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
          <Package size={18} className="text-blue-600" /> Company Assets
        </h2>
        <button
          onClick={() => navigate('/admin/assets')}
          className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition"
        >
          View All <ChevronRight size={13} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : SUMMARY_CARDS.map(card => {
            const Icon = card.icon;
            const value = data?.summary?.[card.key] ?? 0;
            return (
              <button
                key={card.key}
                onClick={() => navigate(card.link)}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all group"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className={`p-2 rounded-xl ${card.iconBg}`}>
                    <Icon size={16} className={card.iconColor} />
                  </div>
                  <ChevronRight size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                </div>
                <p className={`text-2xl font-black ${card.valColor}`}>{value}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                  {card.label}
                </p>
              </button>
            );
          })}
      </div>
    </div>
  );

  // ── Recent Activity ────────────────────────────────────────────────────────
  const ActivitySection = () => {
    const [tab, setTab] = useState('assignments');

    const tabs = [
      { key: 'assignments', label: 'Assignments', icon: UserPlus,  count: data?.recentAssignments?.length },
      { key: 'returns',     label: 'Returns',     icon: RotateCcw, count: data?.recentReturns?.length },
      { key: 'credentials', label: 'Credentials', icon: KeyRound,  count: data?.recentCredential?.length },
    ];

    return (
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
            <Clock size={16} className="text-slate-400" />
            Recent Activity
          </h2>
          <button
            onClick={() => navigate(
              tab === 'assignments' ? '/admin/asset-assignments' :
              tab === 'returns'     ? '/admin/asset-assignments?status=Returned' :
              '/admin/credential-audit'
            )}
            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition"
          >
            View All <ChevronRight size={13} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 px-6 border-b border-slate-100">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 pb-3 px-2 text-xs font-bold border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon size={12} />
                {t.label}
                {(t.count > 0) && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                    tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="divide-y divide-slate-50">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            : tab === 'assignments'
              ? <AssignmentsList items={data?.recentAssignments || []} navigate={navigate} />
              : tab === 'returns'
                ? <ReturnsList items={data?.recentReturns || []} navigate={navigate} />
                : <CredentialList items={data?.recentCredential || []} navigate={navigate} />
          }
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-3">
        <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
        <p className="text-xs font-bold text-amber-700">Asset widgets could not load. Check your connection.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SummarySection />
      <ActivitySection />
    </div>
  );
}

// ─── Tab content components ───────────────────────────────────────────────────

function AssignmentsList({ items, navigate }) {
  if (!items.length) return <EmptyState message="No active assignments" />;
  return items.map(a => (
    <button
      key={a._id}
      onClick={() => navigate(`/admin/assets/${a.asset?._id}`)}
      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
    >
      {/* Asset icon */}
      <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
        <Package size={15} className="text-blue-600" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
          {a.asset?.assetName || '—'}
          <span className="ml-1.5 text-[10px] font-black text-slate-400 tracking-wider normal-case">
            {a.asset?.assetNumber}
          </span>
        </p>
        <p className="text-[10px] text-slate-400 font-medium truncate">
          → <span className="font-bold text-slate-600">{a.employee?.name || '—'}</span>
          {a.employee?.employeeId && ` · ${a.employee.employeeId}`}
          {a.employee?.department && ` · ${a.employee.department}`}
        </p>
      </div>

      {/* Status + date */}
      <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
          a.status === 'Overdue'
            ? 'bg-red-50 text-red-600'
            : 'bg-emerald-50 text-emerald-700'
        }`}>
          {a.status}
        </span>
        <span className="text-[10px] text-slate-400 font-medium">{fmt(a.assignedDate)}</span>
      </div>
    </button>
  ));
}

function ReturnsList({ items, navigate }) {
  if (!items.length) return <EmptyState message="No recent returns" />;

  const CONDITION_STYLES = {
    Good:    'bg-emerald-50 text-emerald-700',
    Damaged: 'bg-amber-50 text-amber-700',
    Lost:    'bg-red-50 text-red-600',
  };

  return items.map(a => (
    <button
      key={a._id}
      onClick={() => navigate(`/admin/assets/${a.asset?._id}`)}
      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
        a.returnCondition === 'Damaged' ? 'bg-amber-50' :
        a.returnCondition === 'Lost'    ? 'bg-red-50'   : 'bg-teal-50'
      }`}>
        {a.returnCondition === 'Damaged'
          ? <Wrench size={15} className="text-amber-600" />
          : a.returnCondition === 'Lost'
            ? <AlertOctagon size={15} className="text-red-600" />
            : <RotateCcw size={15} className="text-teal-600" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
          {a.asset?.assetName || '—'}
          <span className="ml-1.5 text-[10px] font-black text-slate-400 tracking-wider normal-case">
            {a.asset?.assetNumber}
          </span>
        </p>
        <p className="text-[10px] text-slate-400 font-medium truncate">
          ← <span className="font-bold text-slate-600">{a.employee?.name || '—'}</span>
          {a.employee?.employeeId && ` · ${a.employee.employeeId}`}
        </p>
      </div>

      <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
        {a.returnCondition && (
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
            CONDITION_STYLES[a.returnCondition] || 'bg-slate-100 text-slate-500'
          }`}>
            {a.returnCondition}
          </span>
        )}
        <span className="text-[10px] text-slate-400 font-medium">{fmt(a.returnedDate)}</span>
      </div>
    </button>
  ));
}

function CredentialList({ items, navigate }) {
  if (!items.length) return <EmptyState message="No credential activity" />;
  return items.map(log => {
    const meta = CRED_ACTION_META[log.action] || { label: log.action, color: 'bg-slate-100 text-slate-600' };
    return (
      <button
        key={log._id}
        onClick={() => navigate(`/admin/employee/${log.targetEmployee?._id}`)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 text-sm font-black text-slate-500">
          {log.targetEmployee?.name?.charAt(0) || '?'}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
            {log.targetEmployee?.name || '—'}
            {log.targetEmployee?.employeeId && (
              <span className="ml-1.5 text-[10px] font-bold text-slate-400">
                {log.targetEmployee.employeeId}
              </span>
            )}
          </p>
          <p className="text-[10px] text-slate-400 font-medium truncate">
            by <span className="font-bold text-slate-600">{log.actorUserId?.name || '—'}</span>
            {log.affectedFields?.length > 0 && (
              <span className="ml-1">
                · {log.affectedFields.slice(0, 2).map(f => FIELD_LABELS[f] || f).join(', ')}
                {log.affectedFields.length > 2 && ` +${log.affectedFields.length - 2}`}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${meta.color}`}>
            {meta.label}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">{fmtTime(log.createdAt)}</span>
        </div>
      </button>
    );
  });
}

function EmptyState({ message }) {
  return (
    <div className="flex items-center justify-center py-10 text-slate-300">
      <p className="text-xs font-bold uppercase tracking-widest">{message}</p>
    </div>
  );
}
