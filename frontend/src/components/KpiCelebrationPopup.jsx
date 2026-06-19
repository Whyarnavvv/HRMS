import { Clock, Zap, Star } from 'lucide-react';

/**
 * KpiCelebrationPopup
 * Shown after a successful check-out when the backend awards KPI points.
 *
 * Props:
 *   kpiAwarded — array of { points, reason, kpiType } from the check-out API response
 *   onClose    — () => void   called when the user dismisses the popup
 */
export default function KpiCelebrationPopup({ kpiAwarded, onClose }) {
  if (!kpiAwarded || kpiAwarded.length === 0) return null;

  const totalPoints = kpiAwarded.reduce((sum, k) => sum + k.points, 0);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">

        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-8 text-center relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-16 -translate-y-16" />
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-12 translate-y-12" />

          <div className="relative z-10">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white/30">
              <Star size={36} className="text-yellow-300" fill="currentColor" />
            </div>
            <p className="text-white/80 text-xs font-black uppercase tracking-[0.3em] mb-1">
              KPI Points Awarded
            </p>
            <p className="text-5xl font-black text-white">+{totalPoints}</p>
            <p className="text-white/70 text-sm font-bold mt-1">points earned today</p>
          </div>
        </div>

        {/* Breakdown */}
        <div className="p-6 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
            Breakdown
          </p>
          {kpiAwarded.map((k, i) => (
            <div
              key={i}
              className={`flex items-center justify-between p-3 rounded-2xl ${
                k.kpiType === 'punctuality'
                  ? 'bg-emerald-50 border border-emerald-100'
                  : 'bg-blue-50 border border-blue-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  k.kpiType === 'punctuality'
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-blue-100 text-blue-600'
                }`}>
                  {k.kpiType === 'punctuality' ? <Clock size={14} /> : <Zap size={14} />}
                </div>
                <div>
                  <p className={`text-xs font-black ${
                    k.kpiType === 'punctuality' ? 'text-emerald-700' : 'text-blue-700'
                  }`}>
                    {k.kpiType === 'punctuality' ? 'Punctuality' : 'Working Hours'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5 max-w-[180px] leading-tight">
                    {k.reason}
                  </p>
                </div>
              </div>
              <span className={`text-lg font-black ${
                k.kpiType === 'punctuality' ? 'text-emerald-600' : 'text-blue-600'
              }`}>
                +{k.points}
              </span>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-sm transition"
          >
            Awesome! 🎉
          </button>
        </div>
      </div>
    </div>
  );
}
