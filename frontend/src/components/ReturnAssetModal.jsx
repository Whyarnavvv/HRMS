import { useState } from 'react';
import api from '../utils/axios';
import {
  RotateCcw, X, AlertTriangle, CheckCircle,
  Wrench, AlertOctagon, Calendar, FileText
} from 'lucide-react';

// ─── Condition options ────────────────────────────────────────────────────────
const CONDITIONS = [
  {
    value: 'Good',
    label: 'Good Condition',
    description: 'Asset is in working order. Quantity restored to inventory.',
    icon: CheckCircle,
    iconColor: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    selectedBg: 'bg-emerald-600',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  {
    value: 'Damaged',
    label: 'Damaged',
    description: 'Asset is damaged or requires repair. Will be marked Under Repair.',
    icon: Wrench,
    iconColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    selectedBg: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700',
  },
  {
    value: 'Lost',
    label: 'Lost',
    description: 'Asset cannot be recovered. Inventory will be permanently reduced.',
    icon: AlertOctagon,
    iconColor: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    selectedBg: 'bg-red-600',
    badge: 'bg-red-100 text-red-700',
  },
];

// ─── Return Asset Modal ───────────────────────────────────────────────────────
// Props:
//   assignment  — the full assignment object (populated with asset + employee)
//   assetId     — string, the asset's _id (used in the API URL)
//   onClose     — () => void
//   onReturned  — (updatedAssignment) => void  called after successful return
export default function ReturnAssetModal({ assignment, assetId, onClose, onReturned }) {
  const today = new Date().toISOString().split('T')[0];
  const minDate = assignment?.assignedDate
    ? new Date(assignment.assignedDate).toISOString().split('T')[0]
    : undefined;

  const [returnDate, setReturnDate]   = useState(today);
  const [condition, setCondition]     = useState('Good');
  const [remarks, setRemarks]         = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState('');
  // Second-step confirmation for Damaged / Lost
  const [confirming, setConfirming]   = useState(false);

  const selectedCondition = CONDITIONS.find(c => c.value === condition);

  const fmt = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  const handleSubmitClick = () => {
    setError('');
    // Basic client-side validation
    if (!returnDate) return setError('Return date is required');
    if (!condition)  return setError('Asset condition is required');
    if (condition === 'Damaged' || condition === 'Lost') {
      // Require confirmation step for destructive conditions
      setConfirming(true);
      return;
    }
    doReturn();
  };

  const doReturn = async () => {
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.patch(
        `/assets/${assetId}/assignments/${assignment._id}/return`,
        {
          returnDate,
          condition,
          returnRemarks: remarks.trim() || undefined,
        }
      );
      onReturned(data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Return failed. Please try again.');
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Confirmation screen for Damaged / Lost ──────────────────────────────
  if (confirming) {
    const isDamaged  = condition === 'Damaged';
    const icon       = isDamaged ? Wrench : AlertOctagon;
    const IconComp   = icon;
    const headerColor = isDamaged ? 'text-amber-600' : 'text-red-600';
    const headerBg    = isDamaged ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100';
    const btnColor    = isDamaged
      ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100'
      : 'bg-red-600 hover:bg-red-700 shadow-red-100';

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
          <div className={`p-6 border-b ${headerBg}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl ${isDamaged ? 'bg-amber-100' : 'bg-red-100'}`}>
                <IconComp size={20} className={headerColor} />
              </div>
              <div>
                <h2 className={`text-base font-black ${headerColor}`}>
                  Confirm: {condition} Asset
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  This action cannot be undone
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className={`p-4 rounded-2xl border ${headerBg} space-y-2`}>
              {isDamaged ? (
                <>
                  <p className="text-sm font-black text-amber-700">What will happen:</p>
                  <ul className="space-y-1.5">
                    <li className="text-xs text-amber-700 flex items-start gap-2">
                      <span className="mt-0.5 flex-shrink-0">•</span>
                      Assignment closed as Returned
                    </li>
                    <li className="text-xs text-amber-700 flex items-start gap-2">
                      <span className="mt-0.5 flex-shrink-0">•</span>
                      Asset status set to <strong>Under Repair</strong>
                    </li>
                    <li className="text-xs text-amber-700 flex items-start gap-2">
                      <span className="mt-0.5 flex-shrink-0">•</span>
                      Unit removed from available pool until repaired
                    </li>
                  </ul>
                </>
              ) : (
                <>
                  <p className="text-sm font-black text-red-700">What will happen:</p>
                  <ul className="space-y-1.5">
                    <li className="text-xs text-red-700 flex items-start gap-2">
                      <span className="mt-0.5 flex-shrink-0">•</span>
                      Assignment closed as Returned
                    </li>
                    <li className="text-xs text-red-700 flex items-start gap-2">
                      <span className="mt-0.5 flex-shrink-0">•</span>
                      <strong>Total inventory permanently reduced</strong> by {assignment.quantity} unit(s)
                    </li>
                    <li className="text-xs text-red-700 flex items-start gap-2">
                      <span className="mt-0.5 flex-shrink-0">•</span>
                      This cannot be reversed
                    </li>
                  </ul>
                </>
              )}
            </div>

            <div className="bg-slate-50 rounded-2xl p-3 text-xs font-bold text-slate-600 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Asset</span>
                <span>{assignment.asset?.assetName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Employee</span>
                <span>{assignment.employee?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Quantity</span>
                <span>{assignment.quantity} unit(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Return Date</span>
                <span>{fmt(returnDate)}</span>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 font-bold bg-red-50 px-4 py-2.5 rounded-xl flex items-center gap-2">
                <AlertTriangle size={13} /> {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                disabled={submitting}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition disabled:opacity-50"
              >
                Go Back
              </button>
              <button
                onClick={doReturn}
                disabled={submitting}
                className={`flex-1 py-3 text-white rounded-2xl font-bold text-sm transition shadow-lg disabled:opacity-50 ${btnColor}`}
              >
                {submitting ? 'Processing...' : `Yes, Mark as ${condition}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main return form ────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <RotateCcw size={18} className="text-blue-600" /> Return Asset
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {assignment.asset?.assetName}
              <span className="mx-1.5 text-slate-300">·</span>
              <span className="font-black text-slate-600 tracking-wider text-[11px]">{assignment.asset?.assetNumber}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">

            {/* ── Assignment summary ── */}
            <div className="bg-slate-50 rounded-2xl p-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Employee</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{assignment.employee?.name || '—'}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Employee ID</p>
                <p className="text-sm font-black text-slate-700 mt-0.5">{assignment.employee?.employeeId || '—'}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Department</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{assignment.employee?.department || '—'}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Quantity</p>
                <p className="text-sm font-black text-slate-800 mt-0.5">{assignment.quantity} unit(s)</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Assigned On</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{fmt(assignment.assignedDate)}</p>
              </div>
              {assignment.expectedReturnDate && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Expected Return</p>
                  <p className={`text-sm font-bold mt-0.5 ${
                    assignment.status === 'Overdue' ? 'text-red-600' : 'text-slate-800'
                  }`}>
                    {fmt(assignment.expectedReturnDate)}
                    {assignment.status === 'Overdue' && (
                      <span className="ml-1.5 text-[9px] font-black bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">
                        OVERDUE
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* ── Return Date ── */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Calendar size={11} /> Return Date <span className="text-red-400">*</span>
                </span>
              </label>
              <input
                type="date"
                value={returnDate}
                min={minDate}
                max={today}
                onChange={e => setReturnDate(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1 font-medium">
                Cannot be before assignment date ({fmt(assignment.assignedDate)})
              </p>
            </div>

            {/* ── Asset Condition ── */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Asset Condition <span className="text-red-400">*</span>
              </label>
              <div className="space-y-2.5">
                {CONDITIONS.map(opt => {
                  const Icon = opt.icon;
                  const isSelected = condition === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCondition(opt.value)}
                      className={`w-full flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                        isSelected
                          ? `${opt.bgColor} ${opt.borderColor}`
                          : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {/* Radio dot */}
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isSelected ? `${opt.selectedBg} border-transparent` : 'border-slate-300'
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>

                      {/* Icon */}
                      <div className={`p-2 rounded-xl flex-shrink-0 ${isSelected ? 'bg-white/70' : 'bg-slate-100'}`}>
                        <Icon size={15} className={isSelected ? opt.iconColor : 'text-slate-400'} />
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-black ${isSelected ? opt.iconColor : 'text-slate-700'}`}>
                          {opt.label}
                        </p>
                        <p className={`text-[11px] font-medium mt-0.5 leading-relaxed ${
                          isSelected ? 'text-slate-600' : 'text-slate-400'
                        }`}>
                          {opt.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Remarks ── */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <FileText size={11} /> Remarks
                  <span className="text-slate-300 font-normal normal-case">(optional)</span>
                </span>
              </label>
              <textarea
                rows={3}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder={
                  condition === 'Damaged'
                    ? 'Describe the damage, which components are affected...'
                    : condition === 'Lost'
                      ? 'Describe the circumstances, when/where it was lost...'
                      : 'Any notes about the return condition...'
                }
                className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
              />
            </div>

            {/* ── Consequence banner for non-Good conditions ── */}
            {condition !== 'Good' && (
              <div className={`flex items-start gap-3 p-4 rounded-2xl border ${
                condition === 'Damaged'
                  ? 'bg-amber-50 border-amber-100'
                  : 'bg-red-50 border-red-100'
              }`}>
                <AlertTriangle size={15} className={condition === 'Damaged' ? 'text-amber-500 flex-shrink-0 mt-0.5' : 'text-red-500 flex-shrink-0 mt-0.5'} />
                <p className={`text-xs font-medium leading-relaxed ${
                  condition === 'Damaged' ? 'text-amber-700' : 'text-red-700'
                }`}>
                  {condition === 'Damaged'
                    ? 'You will be asked to confirm before the asset is marked Under Repair.'
                    : 'You will be asked to confirm before the inventory is permanently reduced.'
                  }
                </p>
              </div>
            )}

            {/* ── Error ── */}
            {error && (
              <p className="text-xs text-red-600 font-bold bg-red-50 px-4 py-2.5 rounded-xl flex items-center gap-2">
                <AlertTriangle size={13} /> {error}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-100 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmitClick}
            disabled={submitting || !returnDate || !condition}
            className={`flex-1 py-3 text-white rounded-2xl font-bold text-sm transition shadow-lg disabled:opacity-50 ${
              condition === 'Lost'
                ? 'bg-red-600 hover:bg-red-700 shadow-red-100'
                : condition === 'Damaged'
                  ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'
            }`}
          >
            {submitting ? 'Processing...' : 'Process Return'}
          </button>
        </div>
      </div>
    </div>
  );
}
