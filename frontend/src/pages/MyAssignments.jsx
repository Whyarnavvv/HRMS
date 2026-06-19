import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axios';
import { AuthContext } from '../context/AuthContext';
import {
  Package, CheckCircle, RotateCcw, AlertTriangle,
  Tag, Calendar, User, ChevronRight, Boxes
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  Active:   'bg-emerald-50 text-emerald-700 border border-emerald-100',
  Returned: 'bg-slate-100 text-slate-500 border border-slate-200',
  Overdue:  'bg-red-50 text-red-600 border border-red-100',
};

const STATUS_ICONS = {
  Active:   <CheckCircle size={11} />,
  Returned: <RotateCcw size={11} />,
  Overdue:  <AlertTriangle size={11} />,
};

const CATEGORY_STYLES = {
  'Laptop':       'bg-blue-50 text-blue-600',
  'Desktop':      'bg-indigo-50 text-indigo-600',
  'Phone':        'bg-emerald-50 text-emerald-600',
  'SIM Card':     'bg-teal-50 text-teal-600',
  'ID Card':      'bg-amber-50 text-amber-600',
  'Access Card':  'bg-orange-50 text-orange-600',
  'Furniture':    'bg-stone-50 text-stone-600',
  'Other':        'bg-slate-100 text-slate-500',
};

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

function SkeletonCard() {
  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 animate-pulse space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-100 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-100 rounded-full w-2/3" />
          <div className="h-3 bg-slate-100 rounded-full w-1/3" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-50 rounded-xl" />)}
      </div>
    </div>
  );
}

export default function MyAssignments() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState('Active');

  useEffect(() => {
    api.get('/assets/my-assignments')
      .then(({ data }) => setAssignments(data.assignments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const tabs  = ['Active', 'Overdue', 'Returned'];
  const counts = {
    Active:   assignments.filter(a => a.status === 'Active').length,
    Overdue:  assignments.filter(a => a.status === 'Overdue').length,
    Returned: assignments.filter(a => a.status === 'Returned').length,
  };
  const visible = assignments.filter(a => a.status === activeTab);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-2xl">
            <Package size={20} className="text-white" />
          </div>
          My Assets
        </h1>
        <p className="text-sm text-slate-500 font-medium mt-0.5 ml-14">
          Company assets currently assigned to you
        </p>
      </div>

      {/* ── Summary cards ── */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`bg-white rounded-2xl border shadow-sm p-4 text-left transition-all hover:shadow-md ${
                activeTab === tab ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-100'
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{tab}</p>
              <p className={`text-2xl font-black mt-1 ${
                tab === 'Overdue' ? 'text-red-600' :
                tab === 'Active'  ? 'text-emerald-600' :
                'text-slate-500'
              }`}>{counts[tab]}</p>
            </button>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-white border border-slate-100 rounded-2xl p-1.5 w-fit shadow-sm">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === tab
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            {STATUS_ICONS[tab]} {tab}
            {counts[tab] > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                activeTab === tab ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
              }`}>{counts[tab]}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Cards ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-slate-400">
          <Boxes size={48} className="opacity-20" />
          <p className="text-sm font-black uppercase tracking-widest">No {activeTab.toLowerCase()} assets</p>
          {activeTab !== 'Active' && (
            <button
              onClick={() => setActiveTab('Active')}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              View active assets
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(a => {
            const isOverdue = a.status === 'Overdue';
            return (
              <div
                key={a._id}
                className={`bg-white rounded-[2rem] border shadow-sm p-6 space-y-4 transition-all hover:shadow-md ${
                  isOverdue ? 'border-red-200 bg-red-50/20' : 'border-slate-100'
                }`}
              >
                {/* Asset header */}
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-2xl flex-shrink-0 ${CATEGORY_STYLES[a.asset?.category] || 'bg-slate-100 text-slate-500'}`}>
                    <Package size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 truncate">{a.asset?.assetName || '—'}</p>
                    <p className="text-[10px] font-black text-slate-400 tracking-wider mt-0.5">
                      {a.asset?.assetNumber}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black whitespace-nowrap ${STATUS_STYLES[a.status] || 'bg-slate-100 text-slate-600'}`}>
                    {STATUS_ICONS[a.status]} {a.status}
                  </span>
                </div>

                {/* Asset meta */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Category</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5">{a.asset?.category || '—'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Model</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5 truncate">{a.asset?.modelName || '—'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Quantity</p>
                    <p className="text-xs font-black text-slate-800 mt-0.5">{a.quantity} unit(s)</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Assigned On</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5">{fmt(a.assignedDate)}</p>
                  </div>
                </div>

                {/* Expected return / overdue warning */}
                {a.expectedReturnDate && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${
                    isOverdue
                      ? 'bg-red-50 text-red-700 border border-red-100'
                      : 'bg-slate-50 text-slate-600'
                  }`}>
                    <Calendar size={12} />
                    {isOverdue ? 'Overdue since' : 'Return by'}: {fmt(a.expectedReturnDate)}
                  </div>
                )}

                {/* Return condition (for returned items) */}
                {a.status === 'Returned' && a.returnCondition && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${
                    a.returnCondition === 'Damaged' ? 'bg-amber-50 text-amber-700' :
                    a.returnCondition === 'Lost'    ? 'bg-red-50 text-red-700'   :
                    'bg-emerald-50 text-emerald-700'
                  }`}>
                    Returned: {a.returnCondition} · {fmt(a.returnedDate)}
                  </div>
                )}

                {/* Assigned by */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                  <User size={12} className="text-slate-400" />
                  <p className="text-[10px] text-slate-400 font-medium">
                    Assigned by <span className="font-bold text-slate-600">{a.assignedBy?.name || '—'}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
