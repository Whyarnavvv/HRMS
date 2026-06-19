import { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../utils/axios';
import { AuthContext } from '../context/AuthContext';
import ReturnAssetModal from '../components/ReturnAssetModal';
import {
  ArrowLeft, Package, Pencil, Trash2, UserPlus, Clock,
  Tag, AlertTriangle, CheckCircle, History,
  User, Calendar, IndianRupee, Wrench, X, Search,
  RotateCcw, Users, ChevronRight, AlertOctagon
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  'Available':      'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'Fully Assigned': 'bg-blue-50 text-blue-700 border border-blue-200',
  'Under Repair':   'bg-amber-50 text-amber-700 border border-amber-200',
  'Retired':        'bg-red-50 text-red-600 border border-red-200',
};

const ASSIGN_STATUS_STYLES = {
  Active:   'bg-emerald-50 text-emerald-700 border border-emerald-100',
  Returned: 'bg-slate-100 text-slate-500 border border-slate-200',
  Overdue:  'bg-red-50 text-red-600 border border-red-100',
};

const HISTORY_ACTION_STYLES = {
  CREATED:        'bg-emerald-100 text-emerald-700',
  UPDATED:        'bg-blue-100 text-blue-700',
  ASSIGNED:       'bg-indigo-100 text-indigo-700',
  RETURNED:       'bg-teal-100 text-teal-700',
  STATUS_CHANGED: 'bg-amber-100 text-amber-700',
  RETIRED:        'bg-red-100 text-red-700',
  DELETED:        'bg-slate-100 text-slate-600',
};

// ─── Shared helpers ───────────────────────────────────────────────────────────
const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : null;

// ─── Info Row ─────────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      <div className="p-2 bg-slate-50 rounded-xl text-slate-400 flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-sm font-bold text-slate-800 mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}

// ─── Assign Modal ─────────────────────────────────────────────────────────────
function AssignModal({ asset, onClose, onAssigned }) {
  const [employees, setEmployees]         = useState([]);
  const [empSearch, setEmpSearch]         = useState('');
  const [selected, setSelected]           = useState(null); // full employee object
  const [qty, setQty]                     = useState('1');
  const [assignedDate, setAssignedDate]   = useState(new Date().toISOString().split('T')[0]);
  const [expectedReturn, setExpectedReturn] = useState('');
  const [remarks, setRemarks]             = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [loadingEmps, setLoadingEmps]     = useState(true);
  const [error, setError]                 = useState('');

  useEffect(() => {
    setLoadingEmps(true);
    api.get('/employees', { params: { search: empSearch, limit: 50 } })
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : (data.employees || []);
        setEmployees(list.filter(e => e.isActive === 'Active'));
      })
      .catch(() => {})
      .finally(() => setLoadingEmps(false));
  }, [empSearch]);

  const handleAssign = async () => {
    setError('');
    if (!selected) return setError('Please select an employee');
    const q = Number(qty);
    if (!Number.isFinite(q) || q < 1) return setError('Quantity must be at least 1');
    if (q > asset.availableQuantity) return setError(`Only ${asset.availableQuantity} unit(s) available`);
    if (expectedReturn && new Date(expectedReturn) <= new Date(assignedDate)) {
      return setError('Expected return date must be after the assigned date');
    }

    setSubmitting(true);
    try {
      await api.post(`/assets/${asset._id}/assign`, {
        employeeId:         selected._id,
        quantity:           q,
        assignedDate:       assignedDate || undefined,
        expectedReturnDate: expectedReturn || undefined,
        remarks:            remarks.trim() || undefined,
      });
      onAssigned();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Assignment failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
    (e.employeeId || '').toLowerCase().includes(empSearch.toLowerCase()) ||
    (e.department || '').toLowerCase().includes(empSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <UserPlus size={18} className="text-blue-600" /> Assign Asset
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {asset.assetName} ·{' '}
              <span className="font-black text-emerald-600">{asset.availableQuantity} available</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">

          {/* ── Section: Employee Information ── */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-3">
              Employee Information
            </p>

            {/* Employee search */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Select Employee <span className="text-red-400">*</span>
              </label>
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  placeholder="Search by name, ID, department..."
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 rounded-xl text-sm font-medium border-none focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="max-h-44 overflow-y-auto border border-slate-100 rounded-2xl divide-y divide-slate-50">
                {loadingEmps ? (
                  <p className="text-xs text-slate-400 text-center py-4 font-medium">Loading employees...</p>
                ) : filteredEmployees.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4 font-medium">No active employees found</p>
                ) : filteredEmployees.map(emp => (
                  <button
                    key={emp._id}
                    onClick={() => setSelected(emp)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
                      selected?._id === emp._id ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${
                      selected?._id === emp._id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {emp.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold truncate ${selected?._id === emp._id ? 'text-blue-700' : 'text-slate-800'}`}>
                        {emp.name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {emp.employeeId && <span className="font-black">{emp.employeeId}</span>}
                        {emp.employeeId && emp.department && ' · '}
                        {emp.department || emp.role}
                      </p>
                    </div>
                    {selected?._id === emp._id && (
                      <CheckCircle size={16} className="text-blue-600 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              {/* Selected employee summary */}
              {selected && (
                <div className="mt-2 bg-blue-50/70 border border-blue-100 rounded-2xl p-3 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">Name</p>
                    <p className="text-xs font-bold text-blue-800 mt-0.5 truncate">{selected.name}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">Employee ID</p>
                    <p className="text-xs font-bold text-blue-800 mt-0.5">{selected.employeeId || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">Department</p>
                    <p className="text-xs font-bold text-blue-800 mt-0.5 truncate">{selected.department || '—'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Section: Asset Information ── */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-3">
              Asset Information
            </p>
            <div className="bg-slate-50 rounded-2xl p-3 grid grid-cols-3 gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Asset</p>
                <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">{asset.assetName}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Asset No.</p>
                <p className="text-xs font-black text-slate-700 mt-0.5 tracking-wider">{asset.assetNumber}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Model</p>
                <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">{asset.modelName || '—'}</p>
              </div>
            </div>
          </div>

          {/* ── Section: Assignment Details ── */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-3">
              Assignment Details
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Quantity <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={asset.availableQuantity}
                    value={qty}
                    onChange={e => setQty(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl py-2.5 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-[9px] text-slate-400 mt-1 font-medium">
                    Max: {asset.availableQuantity}
                  </p>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Assigned Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={assignedDate}
                    onChange={e => setAssignedDate(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl py-2.5 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Expected Return Date
                </label>
                <input
                  type="date"
                  value={expectedReturn}
                  min={assignedDate}
                  onChange={e => setExpectedReturn(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-xl py-2.5 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Remarks
                </label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Optional assignment notes, purpose, condition..."
                  className="w-full bg-slate-50 border-none rounded-xl py-2.5 px-4 text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 font-bold bg-red-50 px-4 py-2.5 rounded-xl flex items-center gap-2">
              <AlertTriangle size={13} /> {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={submitting || !selected}
            className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-100 disabled:opacity-50"
          >
            {submitting ? 'Assigning...' : 'Confirm Assignment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Assignments Table (embedded inside AssetDetail) ─────────────────────────
function AssetAssignmentsTable({ assetId, canWrite, onAssignClick, refreshTrigger, onReturned }) {
  const navigate        = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState('Active');
  const [returning, setReturning]     = useState(null);

  const CONDITION_STYLES = {
    Good:    'bg-emerald-50 text-emerald-700',
    Damaged: 'bg-amber-50 text-amber-700',
    Lost:    'bg-red-50 text-red-600',
  };

  const CONDITION_ICONS = {
    Good:    <CheckCircle size={10} />,
    Damaged: <Wrench size={10} />,
    Lost:    <AlertOctagon size={10} />,
  };

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/assets/${assetId}/assignments`);
      setAssignments(data.assignments || []);
    } catch {
      // non-critical, fail silently
    } finally {
      setLoading(false);
    }
  }, [assetId, refreshTrigger]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const tabs    = ['Active', 'Overdue', 'Returned'];
  const visible = assignments.filter(a =>
    activeTab === 'All' ? true : a.status === activeTab
  );

  const counts = {
    Active:   assignments.filter(a => a.status === 'Active').length,
    Overdue:  assignments.filter(a => a.status === 'Overdue').length,
    Returned: assignments.filter(a => a.status === 'Returned').length,
  };

  return (
    <>
      <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="font-black text-slate-800 flex items-center gap-2">
            <Users size={16} className="text-blue-600" />
            Assigned To
            <span className="ml-1 text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">
              {counts.Active + counts.Overdue} active
            </span>
          </h2>
          {canWrite && (
            <button
              onClick={onAssignClick}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition"
            >
              <UserPlus size={14} /> Assign
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="px-6 flex gap-1 border-b border-slate-100">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab}
              {counts[tab] > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === tab ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {counts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50">
              <tr>
                {['Employee', 'Emp. ID', 'Department', 'Qty', 'Assigned Date', 'Exp. Return', 'Status', 'Condition', 'Actions'].map(col => (
                  <th key={col} className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-t border-slate-100 animate-pulse">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-3 bg-slate-100 rounded-full w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Users size={28} className="opacity-20" />
                      <p className="text-xs font-bold">No {activeTab.toLowerCase()} assignments</p>
                    </div>
                  </td>
                </tr>
              ) : visible.map(a => (
                <tr key={a._id} className={`border-t border-slate-100 group hover:bg-slate-50/60 transition-colors ${
                  a.status === 'Overdue' ? 'bg-red-50/20' : ''
                }`}>
                  {/* Employee */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-[10px] font-black text-blue-600 flex-shrink-0">
                        {a.employee?.name?.charAt(0) || '?'}
                      </div>
                      <p className="font-bold text-slate-800 text-sm whitespace-nowrap">
                        {a.employee?.name || '—'}
                      </p>
                    </div>
                  </td>

                  {/* Emp ID */}
                  <td className="px-4 py-3.5 text-xs font-black text-slate-500 tracking-wider">
                    {a.employee?.employeeId || <span className="text-slate-300 font-normal">—</span>}
                  </td>

                  {/* Department */}
                  <td className="px-4 py-3.5 text-sm text-slate-600 font-medium whitespace-nowrap">
                    {a.employee?.department || <span className="text-slate-300">—</span>}
                  </td>

                  {/* Quantity */}
                  <td className="px-4 py-3.5">
                    <span className="font-black text-slate-800">{a.quantity}</span>
                  </td>

                  {/* Assigned Date */}
                  <td className="px-4 py-3.5 text-sm text-slate-600 font-medium whitespace-nowrap">
                    {fmt(a.assignedDate)}
                  </td>

                  {/* Expected Return */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {a.expectedReturnDate ? (
                      <span className={`text-sm font-bold ${a.status === 'Overdue' ? 'text-red-600' : 'text-slate-600'}`}>
                        {fmt(a.expectedReturnDate)}
                        {a.status === 'Overdue' && <AlertTriangle size={11} className="inline ml-1 mb-0.5" />}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-sm">—</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-bold whitespace-nowrap ${
                      ASSIGN_STATUS_STYLES[a.status] || 'bg-slate-100 text-slate-600'
                    }`}>
                      {a.status}
                    </span>
                  </td>

                  {/* Return Condition */}
                  <td className="px-4 py-3.5">
                    {a.returnCondition ? (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold whitespace-nowrap ${
                        CONDITION_STYLES[a.returnCondition] || 'bg-slate-100 text-slate-600'
                      }`}>
                        {CONDITION_ICONS[a.returnCondition]}
                        {a.returnCondition}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-sm">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5">
                    {canWrite && (a.status === 'Active' || a.status === 'Overdue') && (
                      <button
                        onClick={() => setReturning(a)}
                        title="Return asset"
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 bg-slate-50 hover:bg-emerald-50 px-3 py-1.5 rounded-xl transition-all border border-transparent hover:border-emerald-100"
                      >
                        <RotateCcw size={12} /> Return
                      </button>
                    )}
                    {a.status === 'Returned' && a.returnedDate && (
                      <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                        {fmt(a.returnedDate)}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Return modal */}
      {returning && (
        <ReturnAssetModal
          assignment={returning}
          assetId={assetId}
          onClose={() => setReturning(null)}
          onReturned={() => { fetchAssignments(); onReturned?.(); }}
        />
      )}
    </>
  );
}

// ─── Main AssetDetail Component ───────────────────────────────────────────────
export default function AssetDetail() {
  const { id }         = useParams();
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const { user }       = useContext(AuthContext);

  const [asset, setAsset]       = useState(null);
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showAssign, setShowAssign] = useState(searchParams.get('assign') === '1');
  // Increment to trigger assignments table re-fetch after a new assignment
  const [assignRefresh, setAssignRefresh] = useState(0);

  const canWrite  = ['Admin', 'HR', 'SuperAdmin'].includes(user.role);
  const canDelete = ['Admin', 'SuperAdmin'].includes(user.role);

  const fetchAsset = useCallback(async () => {
    try {
      const { data } = await api.get(`/assets/${id}`);
      setAsset(data.asset);
      setHistory(data.history || []);
    } catch {
      navigate('/admin/assets');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAsset(); }, [fetchAsset]);

  const handleAssigned = () => {
    fetchAsset();
    setAssignRefresh(n => n + 1);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Permanently delete "${asset.assetName}"?`)) return;
    setDeleting(true);
    try {
      await api.delete(`/assets/${id}`);
      navigate('/admin/assets');
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Asset...</p>
      </div>
    </div>
  );

  if (!asset) return null;

  const warrantyExpired = asset.warrantyExpiry && new Date(asset.warrantyExpiry) < new Date();
  const isUnassignable  = ['Under Repair', 'Retired'].includes(asset.status);

  return (
    <>
      <div className="space-y-6 max-w-5xl">
        {/* ── Top Nav ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/assets')}
              className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition shadow-sm"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{asset.assetName}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded tracking-wider uppercase">
                  {asset.assetNumber}
                </span>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-xl ${STATUS_STYLES[asset.status] || 'bg-slate-100 text-slate-600'}`}>
                  {asset.status}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canWrite && asset.availableQuantity > 0 && !isUnassignable && (
              <button
                onClick={() => setShowAssign(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-100"
              >
                <UserPlus size={16} /> Assign
              </button>
            )}
            {isUnassignable && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-100 text-amber-700 rounded-2xl text-xs font-bold">
                <AlertTriangle size={14} /> Not assignable
              </div>
            )}
            {canWrite && (
              <button
                onClick={() => navigate(`/admin/assets/${id}/edit`)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold text-sm hover:bg-slate-50 transition"
              >
                <Pencil size={16} /> Edit
              </button>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-red-100 text-red-500 rounded-2xl font-bold text-sm hover:bg-red-50 transition disabled:opacity-50"
              >
                <Trash2 size={16} /> {deleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
        </div>

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Asset Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Identity */}
            <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm p-6">
              <h2 className="font-black text-slate-800 flex items-center gap-2 mb-4">
                <Package size={16} className="text-blue-600" /> Asset Details
              </h2>
              <InfoRow icon={<Tag size={15} />}     label="Category"     value={asset.category} />
              <InfoRow icon={<Package size={15} />} label="Brand"        value={asset.brand} />
              <InfoRow icon={<Package size={15} />} label="Model"        value={asset.modelName} />
              <InfoRow icon={<Tag size={15} />}     label="Asset Number" value={asset.assetNumber} />
              {asset.imeiNumber && <InfoRow icon={<Tag size={15} />} label="IMEI Number" value={asset.imeiNumber} />}
              {asset.notes && <InfoRow icon={<Tag size={15} />} label="Notes" value={asset.notes} />}
            </div>

            {/* Procurement */}
            <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm p-6">
              <h2 className="font-black text-slate-800 flex items-center gap-2 mb-4">
                <IndianRupee size={16} className="text-emerald-600" /> Procurement
              </h2>
              <InfoRow icon={<User size={15} />}        label="Vendor"         value={asset.vendorName} />
              <InfoRow icon={<IndianRupee size={15} />} label="Purchase Price" value={asset.purchasePrice != null ? `₹${asset.purchasePrice.toLocaleString('en-IN')}` : null} />
              <InfoRow icon={<Calendar size={15} />}    label="Purchase Date"  value={fmt(asset.purchaseDate)} />
              <div className="flex items-start gap-3 py-3">
                <div className="p-2 bg-slate-50 rounded-xl text-slate-400 flex-shrink-0">
                  <Wrench size={15} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Warranty Expiry</p>
                  <p className={`text-sm font-bold mt-0.5 flex items-center gap-2 ${warrantyExpired ? 'text-red-600' : 'text-slate-800'}`}>
                    {fmt(asset.warrantyExpiry) || <span className="text-slate-300">—</span>}
                    {warrantyExpired && (
                      <span className="flex items-center gap-1 text-[10px] font-black bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100">
                        <AlertTriangle size={10} /> Expired
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <InfoRow icon={<Clock size={15} />} label="Added On" value={fmt(asset.createdAt)} />
            </div>
          </div>

          {/* Right: Quantity + Added By */}
          <div className="space-y-6">
            {/* Quantity Card */}
            <div className="bg-slate-900 text-white rounded-[2rem] p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-blue-600/20 rounded-full blur-2xl" />
              <div className="relative z-10 space-y-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quantity Overview</p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-400">Total</span>
                    <span className="text-2xl font-black">{asset.totalQuantity}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-400">Assigned</span>
                    <span className="text-2xl font-black text-blue-400">{asset.assignedQuantity}</span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-white/10">
                    <span className="text-sm font-bold text-slate-400">Available</span>
                    <span className="text-2xl font-black text-emerald-400">{asset.availableQuantity}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${asset.totalQuantity > 0 ? (asset.assignedQuantity / asset.totalQuantity) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold">
                    {asset.totalQuantity > 0
                      ? `${Math.round((asset.assignedQuantity / asset.totalQuantity) * 100)}% assigned`
                      : '0% assigned'}
                  </p>
                </div>
              </div>
            </div>

            {/* Added By */}
            {asset.createdBy && (
              <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Added By</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-sm font-black text-blue-700">
                    {asset.createdBy.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{asset.createdBy.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{asset.createdBy.role}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Quick link to all assignments */}
            <button
              onClick={() => navigate('/admin/asset-assignments')}
              className="w-full flex items-center justify-between px-5 py-4 bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:bg-slate-50 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-xl">
                  <Users size={16} className="text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-slate-800">All Assignments</p>
                  <p className="text-[10px] text-slate-400 font-medium">View assignment records</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
            </button>
          </div>
        </div>

        {/* ── Assignments Table ── */}
        <AssetAssignmentsTable
          assetId={id}
          canWrite={canWrite}
          onAssignClick={() => setShowAssign(true)}
          refreshTrigger={assignRefresh}
          onReturned={fetchAsset}
        />

        {/* ── History Timeline ── */}
        <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm p-6">
          <h2 className="font-black text-slate-800 flex items-center gap-2 mb-6">
            <History size={16} className="text-slate-400" />
            Activity History
            <span className="ml-auto text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">
              {history.length} events
            </span>
          </h2>

          {history.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <History size={32} className="mx-auto opacity-20 mb-2" />
              <p className="text-sm font-bold">No activity recorded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry, idx) => (
                <div key={entry._id || idx} className="flex gap-4 group">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                      HISTORY_ACTION_STYLES[entry.action] || 'bg-slate-100 text-slate-600'
                    }`}>
                      {entry.action?.charAt(0)}
                    </div>
                    {idx < history.length - 1 && <div className="w-px flex-1 bg-slate-100 my-1" />}
                  </div>

                  <div className="flex-1 pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg ${
                        HISTORY_ACTION_STYLES[entry.action] || 'bg-slate-100 text-slate-600'
                      }`}>
                        {entry.action?.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(entry.createdAt).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>

                    {entry.performedBy && (
                      <p className="text-xs text-slate-600 font-bold mt-1">
                        by {entry.performedBy.name}
                        <span className="text-slate-400 font-normal ml-1">({entry.performedBy.role})</span>
                      </p>
                    )}

                    {entry.remarks && (
                      <p className="text-xs text-slate-500 mt-1 italic">"{entry.remarks}"</p>
                    )}

                    {entry.changes && Object.keys(entry.changes).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {Object.entries(entry.changes).map(([field, diff]) => (
                          <p key={field} className="text-[10px] font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg">
                            <span className="font-black text-slate-700">{field}:</span>{' '}
                            <span className="text-red-400 line-through">{String(diff.from ?? '—')}</span>
                            {' → '}
                            <span className="text-emerald-600">{String(diff.to ?? '—')}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Assign Modal ── */}
      {showAssign && (
        <AssignModal
          asset={asset}
          onClose={() => setShowAssign(false)}
          onAssigned={handleAssigned}
        />
      )}
    </>
  );
}
