import { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/axios';
import {
  Clock, ChevronLeft, ChevronRight, CheckCircle,
  AlertCircle, XCircle, Calendar as CalendarIcon,
  TrendingUp, X, Star, Zap
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtDay  = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short' });

const STATUS = {
  Present:  { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Present' },
  Late:     { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500',   label: 'Late' },
  'Half-day':{ bg: 'bg-blue-100',   text: 'text-blue-700',    dot: 'bg-blue-500',    label: 'Half Day' },
  Absent:   { bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500',     label: 'Absent' },
  Holiday:  { bg: 'bg-slate-100',   text: 'text-slate-500',   dot: 'bg-slate-400',   label: 'Holiday' },
};

const Badge = ({ status }) => {
  const s = STATUS[status] || STATUS.Absent;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wide ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Attendance() {
  const { user } = useContext(AuthContext);

  // ── existing state ──
  const [todayRecord, setTodayRecord]       = useState(null);
  const [history, setHistory]               = useState([]);
  const [allAttendance, setAllAttendance]   = useState([]);
  const [loading, setLoading]               = useState(true);
  const [officeSettings, setOfficeSettings] = useState(null);
  const [locationError, setLocationError]   = useState('');
  const [verifyingLocation, setVerifyingLocation] = useState(false);
  const [lastGeofence, setLastGeofence]     = useState(null);

  // ── new state ──
  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-indexed
  const [monthRecords, setMonthRecords] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedDay, setSelectedDay]   = useState(null); // detail modal
  const [kpiCelebration, setKpiCelebration] = useState(null); // [{points, reason, kpiType}]

  // ── fetch ──
  useEffect(() => { fetchData(); }, []);
  useEffect(() => { fetchMonthRecords(); }, [viewYear, viewMonth]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [histRes, todayRes, settingsRes] = await Promise.all([
        api.get('/attendance/my-history'),
        api.get('/attendance/today'),
        api.get('/settings').catch(() => null),
      ]);
      if (histRes?.data)                          setHistory(histRes.data);
      if (todayRes?.data?.length > 0)             setTodayRecord(todayRes.data[0]);
      else                                        setTodayRecord(null);
      if (settingsRes?.data?.officeLocation)      setOfficeSettings(settingsRes.data.officeLocation);
      if (['Admin','HR','AGM','SuperAdmin'].includes(user.role)) {
        const allRes = await api.get(`/attendance/all?date=${now.toISOString().split('T')[0]}`);
        setAllAttendance(allRes.data);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchMonthRecords = async () => {
    try {
      const m = String(viewMonth + 1).padStart(2, '0');
      const res = await api.get(`/attendance/monthly/${viewYear}/${m}`);
      setMonthRecords(res.data || []);
    } catch { setMonthRecords([]); }
  };

  // ── check-in / check-out (unchanged logic) ──
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const handleCheckIn = async (coords) => {
    try {
      const { data } = await api.post('/attendance/check-in', {
        latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy
      });
      setTodayRecord(data);
      setLastGeofence(data.geofence || null);
      fetchData(); fetchMonthRecords();
    } catch (err) { alert(err.response?.data?.message || 'Check-in failed'); }
  };

  const verifyLocationAndCheckIn = () => {
    setLocationError(''); setVerifyingLocation(true);
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported'); setVerifyingLocation(false); return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (!officeSettings?.radius) {
          handleCheckIn({ latitude, longitude, accuracy }); setVerifyingLocation(false); return;
        }
        const dist = calculateDistance(latitude, longitude, officeSettings.latitude, officeSettings.longitude);
        if (dist <= officeSettings.radius) {
          handleCheckIn({ latitude, longitude, accuracy });
        } else {
          setLocationError(`You are ${Math.round(dist)}m away from the office. Check-in not allowed.`);
        }
        setVerifyingLocation(false);
      },
      () => { setLocationError('Unable to get location. Enable permissions.'); setVerifyingLocation(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleCheckOut = async () => {
    try {
      const { data } = await api.post('/attendance/check-out');
      setTodayRecord(data);
      // Show celebration if KPI points were awarded
      if (data.kpiAwarded && data.kpiAwarded.length > 0) {
        setKpiCelebration(data.kpiAwarded);
      }
      fetchData(); fetchMonthRecords();
    } catch (err) { alert(err.response?.data?.message || 'Check-out failed'); }
  };

  // ── derived stats ──
  const presentDays = monthRecords.filter(r => r.status === 'Present' || r.status === 'Late').length;
  const lateDays    = monthRecords.filter(r => r.status === 'Late').length;
  const halfDays    = monthRecords.filter(r => r.status === 'Half-day').length;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const workdays    = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(viewYear, viewMonth, i + 1);
    return d.getDay() !== 0; // exclude Sundays
  }).filter(Boolean).length;
  const attendancePct = workdays > 0 ? Math.round((presentDays / workdays) * 100) : 0;

  // ── calendar helpers ──
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const recordMap = {};
  monthRecords.forEach(r => { recordMap[r.date] = r; });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const getTileStyle = (dateStr, dayOfWeek) => {
    if (dayOfWeek === 0) return 'bg-slate-50 text-slate-300';
    const r = recordMap[dateStr];
    if (!r) return 'bg-white border border-slate-100 text-slate-400 hover:border-slate-200';
    if (r.status === 'Present')   return 'bg-emerald-500 text-white shadow-sm shadow-emerald-200';
    if (r.status === 'Late')      return 'bg-amber-400 text-white shadow-sm shadow-amber-200';
    if (r.status === 'Half-day')  return 'bg-blue-400 text-white shadow-sm shadow-blue-200';
    if (r.status === 'Absent')    return 'bg-red-400 text-white shadow-sm shadow-red-200';
    return 'bg-slate-100 text-slate-500';
  };

  // ── filtered history ──
  const filteredHistory = history
    .filter(r => statusFilter === 'All' || r.status === statusFilter)
    .slice(0, 15);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">

      {/* ── Page Header + Check-in ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Attendance</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Check-in / Check-out */}
        <div className="flex flex-col items-end gap-1.5">
          {!todayRecord?.checkIn ? (
            <>
              <button
                onClick={verifyLocationAndCheckIn}
                disabled={verifyingLocation}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm transition shadow-lg shadow-blue-100 disabled:opacity-50"
              >
                <Clock size={16} />
                {verifyingLocation ? 'Locating...' : 'Check In'}
              </button>
              {locationError && (
                <p className="text-xs text-red-500 font-bold flex items-center gap-1 max-w-xs text-right">
                  <AlertCircle size={12} className="shrink-0" /> {locationError}
                </p>
              )}
            </>
          ) : !todayRecord?.checkOut ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Checked in</p>
                <p className="text-sm font-black text-slate-700">{fmtTime(todayRecord.checkIn)}</p>
              </div>
              <button
                onClick={handleCheckOut}
                className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-sm transition shadow-lg"
              >
                <Clock size={16} /> Check Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 px-5 py-3 rounded-2xl font-black text-sm">
              <CheckCircle size={16} /> Shift Complete · {fmtTime(todayRecord.checkIn)} – {fmtTime(todayRecord.checkOut)}
            </div>
          )}
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Present',     value: presentDays,     color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-100' },
          { label: 'Late',        value: lateDays,         color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-100' },
          { label: 'Half Days',   value: halfDays,         color: 'text-blue-600',    bg: 'bg-blue-50',     border: 'border-blue-100' },
          { label: 'Attendance',  value: `${attendancePct}%`, color: attendancePct >= 75 ? 'text-emerald-600' : 'text-red-600', bg: 'bg-slate-50', border: 'border-slate-100' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} border ${c.border} rounded-2xl p-4`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{c.label}</p>
            <p className={`text-3xl font-black mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* ── Month Selector ── */}
      <div className="flex items-center justify-between bg-white border border-slate-100 rounded-2xl px-5 py-3 shadow-sm">
        <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition">
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-3">
          <CalendarIcon size={16} className="text-blue-500" />
          <span className="font-black text-slate-800 text-sm">{MONTHS[viewMonth]} {viewYear}</span>
        </div>
        <button
          onClick={nextMonth}
          disabled={viewYear === now.getFullYear() && viewMonth === now.getMonth()}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* ── Calendar Heatmap ── */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Monthly Overview</p>

          {/* Day labels */}
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase py-1">{d}</div>
            ))}
          </div>

          {/* Calendar tiles */}
          <div className="grid grid-cols-7 gap-1.5">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {/* Day tiles */}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day     = i + 1;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const dayOfWeek = new Date(viewYear, viewMonth, day).getDay();
              const record  = recordMap[dateStr];
              const isToday = dateStr === now.toISOString().split('T')[0];

              return (
                <button
                  key={day}
                  onClick={() => record && setSelectedDay(record)}
                  className={`
                    aspect-square rounded-xl flex items-center justify-center text-xs font-black transition-all
                    ${getTileStyle(dateStr, dayOfWeek)}
                    ${isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                    ${record ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="px-5 py-3 border-t border-slate-50 flex flex-wrap gap-4">
          {[
            { color: 'bg-emerald-500', label: 'Present' },
            { color: 'bg-amber-400',   label: 'Late' },
            { color: 'bg-blue-400',    label: 'Half Day' },
            { color: 'bg-red-400',     label: 'Absent' },
            { color: 'bg-slate-50 border border-slate-200', label: 'No Record' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-sm ${l.color}`} />
              <span className="text-[10px] font-bold text-slate-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recent History Table ── */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="font-black text-slate-800">Recent Records</p>
          {/* Status filter */}
          <div className="flex flex-wrap gap-2">
            {['All','Present','Late','Half-day','Absent'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-xl text-[11px] font-black transition ${
                  statusFilter === s
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {s === 'Half-day' ? 'Half Day' : s}
              </button>
            ))}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <CalendarIcon size={32} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-bold">No records found</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest font-black text-slate-400 border-b border-slate-50">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Day</th>
                    <th className="px-5 py-3">Check In</th>
                    <th className="px-5 py-3">Check Out</th>
                    <th className="px-5 py-3">Hours</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredHistory.map(r => (
                    <tr
                      key={r._id}
                      onClick={() => setSelectedDay(r)}
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3.5 font-bold text-slate-700 text-sm">{fmtDate(r.date)}</td>
                      <td className="px-5 py-3.5 text-slate-400 text-sm font-bold">{fmtDay(r.date)}</td>
                      <td className="px-5 py-3.5 text-slate-700 text-sm font-bold">{fmtTime(r.checkIn)}</td>
                      <td className="px-5 py-3.5 text-slate-700 text-sm font-bold">{fmtTime(r.checkOut)}</td>
                      <td className="px-5 py-3.5 text-slate-700 text-sm font-black">
                        {r.totalHours ? `${r.totalHours}h` : '—'}
                      </td>
                      <td className="px-5 py-3.5"><Badge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-slate-50">
              {filteredHistory.map(r => (
                <div
                  key={r._id}
                  onClick={() => setSelectedDay(r)}
                  className="px-4 py-4 flex items-center justify-between gap-3 active:bg-slate-50"
                >
                  <div>
                    <p className="font-black text-slate-800 text-sm">{fmtDate(r.date)}</p>
                    <p className="text-xs text-slate-400 font-bold mt-0.5">
                      {fmtTime(r.checkIn)} → {fmtTime(r.checkOut)}
                      {r.totalHours ? ` · ${r.totalHours}h` : ''}
                    </p>
                  </div>
                  <Badge status={r.status} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Admin: Today's Team ── */}
      {['Admin','HR','AGM','SuperAdmin'].includes(user.role) && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50">
            <p className="font-black text-slate-800">Today's Team Attendance</p>
          </div>
          {allAttendance.length === 0 ? (
            <p className="px-5 py-10 text-center text-slate-400 text-sm">No records for today</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {allAttendance.map(r => (
                <div key={r._id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-500 text-sm">
                      {r.user?.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-black text-slate-800 text-sm">{r.user?.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{r.user?.designation || r.user?.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500 hidden sm:block">{fmtTime(r.checkIn)}</span>
                    <Badge status={r.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Day Detail Modal ── */}
      {selectedDay && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className={`p-6 ${
              selectedDay.status === 'Present'  ? 'bg-emerald-500' :
              selectedDay.status === 'Late'     ? 'bg-amber-400'   :
              selectedDay.status === 'Half-day' ? 'bg-blue-500'    :
              'bg-red-500'
            } text-white`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-white/70 text-xs font-black uppercase tracking-widest">
                    {fmtDay(selectedDay.date)}
                  </p>
                  <p className="text-2xl font-black mt-0.5">{fmtDate(selectedDay.date)}</p>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mt-4 inline-flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-white" />
                <span className="text-sm font-black">{selectedDay.status}</span>
              </div>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-4">
              {[
                { label: 'Check In',      value: fmtTime(selectedDay.checkIn) },
                { label: 'Check Out',     value: fmtTime(selectedDay.checkOut) },
                { label: 'Hours Worked',  value: selectedDay.totalHours ? `${selectedDay.totalHours} hrs` : '—' },
                { label: 'Remarks',       value: selectedDay.note || '—' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">{row.label}</span>
                  <span className="text-sm font-black text-slate-800">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={() => setSelectedDay(null)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-sm transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── KPI Celebration Popup ── */}
      {kpiCelebration && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">

            {/* Confetti header */}
            <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-8 text-center relative overflow-hidden">
              {/* Decorative circles */}
              <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-16 -translate-y-16" />
              <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-12 translate-y-12" />

              <div className="relative z-10">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white/30">
                  <Star size={36} className="text-yellow-300" fill="currentColor" />
                </div>
                <p className="text-white/80 text-xs font-black uppercase tracking-[0.3em] mb-1">KPI Points Awarded</p>
                <p className="text-5xl font-black text-white">
                  +{kpiCelebration.reduce((sum, k) => sum + k.points, 0)}
                </p>
                <p className="text-white/70 text-sm font-bold mt-1">points earned today</p>
              </div>
            </div>

            {/* Breakdown */}
            <div className="p-6 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Breakdown</p>
              {kpiCelebration.map((k, i) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded-2xl ${
                  k.kpiType === 'punctuality' ? 'bg-emerald-50 border border-emerald-100' : 'bg-blue-50 border border-blue-100'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${
                      k.kpiType === 'punctuality' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {k.kpiType === 'punctuality' ? <Clock size={14} /> : <Zap size={14} />}
                    </div>
                    <div>
                      <p className={`text-xs font-black ${
                        k.kpiType === 'punctuality' ? 'text-emerald-700' : 'text-blue-700'
                      }`}>
                        {k.kpiType === 'punctuality' ? 'Punctuality' : 'Working Hours'}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold mt-0.5 max-w-[180px] leading-tight">{k.reason}</p>
                    </div>
                  </div>
                  <span className={`text-lg font-black ${
                    k.kpiType === 'punctuality' ? 'text-emerald-600' : 'text-blue-600'
                  }`}>+{k.points}</span>
                </div>
              ))}
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={() => setKpiCelebration(null)}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-sm transition"
              >
                Awesome! 🎉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
