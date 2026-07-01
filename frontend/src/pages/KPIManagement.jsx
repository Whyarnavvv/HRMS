import { useEffect, useMemo, useState } from 'react';
import api from '../utils/axios';
import { Users, Target, PlusCircle, MinusCircle, Trophy, Star, TrendingUp } from 'lucide-react';

// ── Fiscal year helpers ───────────────────────────────────────────────────────
// Generate the next N fiscal year labels starting from a given April year.
// e.g. fiscalLabel(2026) → "April 2026 to March 2027"
const fiscalLabel = (aprilYear) =>
  `April ${aprilYear} to March ${aprilYear + 1}`;

// The fiscal year that contains a given date (defaults to today).
// If today is April or later, FY starts this year; otherwise last year.
const currentFiscalAprilYear = (d = new Date()) =>
  d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;

// Generate selectable fiscal year options: 2 past + current + 2 future
const buildFiscalOptions = () => {
  const base = currentFiscalAprilYear();
  return Array.from({ length: 5 }, (_, i) => base - 2 + i).map(y => ({
    aprilYear: y,
    label: fiscalLabel(y),
    startDate: `${y}-04-01`,
    endDate:   `${y + 1}-04-01`
  }));
};

const FISCAL_OPTIONS = buildFiscalOptions();
const DEFAULT_WORKING_DAYS = 310;
const DEFAULT_MAX_POINTS   = 4960;

export default function KPIManagement() {
  const [employees, setEmployees] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [empOfMonth, setEmpOfMonth] = useState(null);
  const [empOfYear, setEmpOfYear] = useState(null);
  const [yearlyIncrement, setYearlyIncrement] = useState(null);
  const [showIncrement, setShowIncrement] = useState(false);
  const [yearlyMaxKpi, setYearlyMaxKpi] = useState([]);
  // Fiscal year selector state — default to the option matching current FY
  const [selectedFiscalOption, setSelectedFiscalOption] = useState(
    () => FISCAL_OPTIONS.find(o => o.aprilYear === currentFiscalAprilYear()) || FISCAL_OPTIONS[2]
  );
  const [maxKpiWorkingDays, setMaxKpiWorkingDays] = useState(String(DEFAULT_WORKING_DAYS));
  const [maxKpiPoints, setMaxKpiPoints] = useState(String(DEFAULT_MAX_POINTS));

  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    fetchEmployees();
    fetchAwards();
    fetchYearlyMaxKpi();
  }, []);

  useEffect(() => {
    setSelectedEmployee('');
    setHistory([]);
  }, [selectedTeam]);

  useEffect(() => {
    if (selectedEmployee) {
      fetchHistory(selectedEmployee);
    }
  }, [selectedEmployee]);

  const teams = useMemo(() => {
    return [...new Set(employees.map((emp) => emp.department).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const teamEmployees = useMemo(() => {
    if (!selectedTeam) return [];
    return employees.filter((emp) => emp.department === selectedTeam);
  }, [employees, selectedTeam]);

  const selectedEmployeeDetails = useMemo(
    () => employees.find((emp) => emp._id === selectedEmployee),
    [employees, selectedEmployee]
  );

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/employees');
      setEmployees(data || []);
    } catch (error) {
      console.error('Failed to fetch employees for KPI management', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchYearlyMaxKpi = async () => {
    try {
      const { data } = await api.get('/kpi/yearly-max');
      setYearlyMaxKpi(data || []);
    } catch (e) {}
  };

  const saveYearlyMaxKpi = async () => {
    const pts  = Number(maxKpiPoints);
    const days = Number(maxKpiWorkingDays);
    if (!pts || pts < 1) return alert('Enter a valid Max Points value.');
    if (!days || days < 1) return alert('Enter a valid Working Days value.');
    try {
      const { data } = await api.put('/kpi/yearly-max', {
        label:       selectedFiscalOption.label,
        startDate:   selectedFiscalOption.startDate,
        endDate:     selectedFiscalOption.endDate,
        workingDays: days,
        maxPoints:   pts
      });
      setYearlyMaxKpi(data);
      alert(`Fiscal year "${selectedFiscalOption.label}" saved: ${days} working days, ${pts} max pts`);
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to save');
    }
  };

  const fetchAwards = async () => {
    try {
      const [momRes, yoyRes] = await Promise.all([
        api.get('/kpi/employee-of-month').catch(() => ({ data: null })),
        api.get('/kpi/employee-of-year').catch(() => ({ data: null }))
      ]);
      setEmpOfMonth(momRes.data);
      setEmpOfYear(yoyRes.data);
    } catch (e) {}
  };

  const fetchYearlyIncrement = async () => {
    try {
      const { data } = await api.get('/kpi/yearly-increment', {
        params: { label: selectedFiscalOption.label }
      });
      setYearlyIncrement(data);
      setShowIncrement(true);
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to load yearly increment data');
    }
  };

  const fetchHistory = async (employeeId) => {
    try {
      const { data } = await api.get(`/kpi/history/${employeeId}`);
      setHistory(data || []);
    } catch (error) {
      console.error('Failed to fetch KPI history', error);
      setHistory([]);
    }
  };

  const submitKpi = async (signedPoints) => {
    if (!selectedEmployee) return alert('Please select an employee first.');
    if (!reason.trim()) return alert('Please select a reason category.');
    if (!entryDate) return alert('Please choose a date.');

    const value = Number(points);
    if (!Number.isFinite(value) || value <= 0) return alert('Please enter a valid points value.');

    try {
      setSubmitting(true);
      await api.post('/kpi/manage', {
        employeeId: selectedEmployee,
        date: new Date(entryDate).toISOString(),
        points: signedPoints * value,
        reason
      });
      setPoints('');
      await Promise.all([fetchHistory(selectedEmployee), fetchEmployees()]);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update KPI');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-500 font-semibold">Loading KPI workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900">KPI Management</h1>
        <p className="text-slate-500 mt-1">Select team, pick employee, then assign or deduct KPI points.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Users size={14} /> Team Selection
          </p>
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-sm"
          >
            <option value="">Select Team</option>
            {teams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>

          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            disabled={!selectedTeam}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-sm disabled:opacity-60"
          >
            <option value="">{selectedTeam ? 'Select Employee' : 'Select Team First'}</option>
            {teamEmployees.map((emp) => (
              <option key={emp._id} value={emp._id}>
                {emp.name} ({emp.employeeId || emp.role})
              </option>
            ))}
          </select>

          {selectedEmployeeDetails && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="font-black text-slate-800">{selectedEmployeeDetails.name}</p>
              <p className="text-xs text-slate-500 font-semibold">
                {selectedEmployeeDetails.designation || 'Designation not set'} • {selectedEmployeeDetails.department}
              </p>
              <p className="text-sm text-blue-600 font-black mt-2">Current KPI: {selectedEmployeeDetails.totalKpi || 0}</p>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Target size={14} /> KPI Action
          </p>
          <input
            type="number"
            min="1"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="Points value"
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-sm"
          />
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-sm"
          />
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-sm"
          >
            <option value="">Select Reason Category</option>
            <option value="Communication/Behaviour">Communication/Behaviour</option>
            <option value="Work Quality">Work Quality</option>
            <option value="Attendance/Punctuality">Attendance/Punctuality</option>
            <option value="Task Completion">Task Completion</option>
            <option value="Professional Development">Professional Development</option>
          </select>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => submitKpi(1)}
              disabled={submitting}
              className="bg-emerald-600 text-white rounded-2xl py-3 font-black text-sm hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <PlusCircle size={16} /> Add
            </button>
            <button
              onClick={() => submitKpi(-1)}
              disabled={submitting}
              className="bg-red-600 text-white rounded-2xl py-3 font-black text-sm hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <MinusCircle size={16} /> Deduct
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Recent KPI Timeline</p>
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {history.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No KPI records found for selected employee.</p>
            ) : (
              history.map((record) => (
                <div key={record._id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <p className={`font-black text-sm ${record.points >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {record.points >= 0 ? '+' : ''}
                    {record.points} points
                  </p>
                  <p className="text-xs font-semibold text-slate-700">{record.reason}</p>
                  <p className="text-[11px] text-slate-500">
                    {new Date(record.date).toLocaleDateString()} • by {record.assignedBy?.name || 'Management'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Employee of Month & Year */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-3xl p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-amber-600 flex items-center gap-2 mb-4">
            <Trophy size={14} /> Employee of the Month
          </p>
          {empOfMonth ? (
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-200 flex items-center justify-center text-xl font-black text-amber-700">
                {empOfMonth.name?.charAt(0)}
              </div>
              <div>
                <p className="font-black text-slate-800 text-lg">{empOfMonth.name}</p>
                <p className="text-xs text-slate-500 font-semibold">{empOfMonth.designation || empOfMonth.role} • {empOfMonth.department}</p>
                <p className="text-sm font-black text-amber-600 mt-1">{empOfMonth.monthlyPoints} pts — {new Date(0, empOfMonth.month - 1).toLocaleString('default',{month:'long'})} {empOfMonth.year}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No data yet for this month</p>
          )}
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 rounded-3xl p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2 mb-4">
            <Star size={14} /> Employee of the Year
          </p>
          {empOfYear ? (
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-200 flex items-center justify-center text-xl font-black text-indigo-700">
                {empOfYear.name?.charAt(0)}
              </div>
              <div>
                <p className="font-black text-slate-800 text-lg">{empOfYear.name}</p>
                <p className="text-xs text-slate-500 font-semibold">{empOfYear.designation || empOfYear.role} • {empOfYear.department}</p>
                <p className="text-sm font-black text-indigo-600 mt-1">{empOfYear.yearlyPoints} pts — {empOfYear.year}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No data yet for this year</p>
          )}
        </div>
      </div>

      {/* Yearly Max KPI Setting */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Target size={14} /> Fiscal Year KPI Config
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-slate-400">Fiscal Year</label>
            <select
              value={selectedFiscalOption.label}
              onChange={e => {
                const opt = FISCAL_OPTIONS.find(o => o.label === e.target.value);
                if (opt) {
                  setSelectedFiscalOption(opt);
                  // Auto-fill working days and points from any existing saved config
                  const saved = yearlyMaxKpi.find(k => k.label === opt.label);
                  if (saved) {
                    if (saved.workingDays) setMaxKpiWorkingDays(String(saved.workingDays));
                    setMaxKpiPoints(String(saved.maxPoints));
                  } else {
                    setMaxKpiWorkingDays(String(DEFAULT_WORKING_DAYS));
                    setMaxKpiPoints(String(DEFAULT_MAX_POINTS));
                  }
                }
              }}
              className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-sm"
            >
              {FISCAL_OPTIONS.map(o => (
                <option key={o.label} value={o.label}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-slate-400">Working Days</label>
            <input
              type="number"
              min="1"
              value={maxKpiWorkingDays}
              onChange={e => setMaxKpiWorkingDays(e.target.value)}
              placeholder="e.g. 310"
              className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-sm w-28"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-slate-400">Max Points</label>
            <input
              type="number"
              min="1"
              value={maxKpiPoints}
              onChange={e => setMaxKpiPoints(e.target.value)}
              placeholder="e.g. 4960"
              className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-sm w-36"
            />
          </div>
          <button
            onClick={saveYearlyMaxKpi}
            className="bg-slate-900 text-white text-xs font-black px-5 py-3 rounded-2xl hover:bg-black transition"
          >
            Save
          </button>
        </div>
        {/* Saved fiscal year configs */}
        {yearlyMaxKpi.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {yearlyMaxKpi
              .slice()
              .sort((a, b) => {
                // Fiscal entries sort by startDate desc; legacy by year desc
                const aKey = a.startDate ? new Date(a.startDate).getTime() : (a.year || 0) * 10000;
                const bKey = b.startDate ? new Date(b.startDate).getTime() : (b.year || 0) * 10000;
                return bKey - aKey;
              })
              .map((e, i) => (
                <span key={e.label || e.year || i} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-700">
                  {e.label || e.year}: {e.maxPoints} pts{e.workingDays ? ` / ${e.workingDays} days` : ''}
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Yearly Increment */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <TrendingUp size={14} /> Yearly KPI Increment
          </p>
          <button
            onClick={fetchYearlyIncrement}
            className="bg-slate-900 text-white text-xs font-black px-4 py-2 rounded-xl hover:bg-black transition"
          >
            Calculate — {selectedFiscalOption.label}
          </button>
        </div>
        {showIncrement && yearlyIncrement && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-100">
                  <th className="pb-3 pr-4">Employee</th>
                  <th className="pb-3 pr-4">Dept</th>
                  <th className="pb-3 pr-4">Points</th>
                  <th className="pb-3 pr-4">KPI %</th>
                  <th className="pb-3 pr-4">Increment</th>
                  <th className="pb-3">Bonus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {yearlyIncrement.employees.map(emp => (
                  <tr key={emp._id} className="hover:bg-slate-50">
                    <td className="py-3 pr-4">
                      <p className="font-black text-slate-800">{emp.name}</p>
                      <p className="text-[10px] text-slate-400">{emp.employeeId}</p>
                    </td>
                    <td className="py-3 pr-4 text-slate-600 font-semibold">{emp.department || '—'}</td>
                    <td className="py-3 pr-4 font-black text-slate-700">{emp.yearlyPoints}</td>
                    <td className="py-3 pr-4">
                      <span className={`font-black ${
                        emp.kpiPercentage >= 90 ? 'text-emerald-600' :
                        emp.kpiPercentage >= 70 ? 'text-amber-600' : 'text-red-500'
                      }`}>{emp.kpiPercentage}%</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-black ${
                        emp.increment === 'No Increment' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
                      }`}>{emp.increment}</span>
                    </td>
                    <td className="py-3">
                      {emp.bonus && <span className="px-2 py-1 rounded-lg text-xs font-black bg-amber-50 text-amber-600">+ Bonus</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-slate-400 mt-3">
              Fiscal year: {yearlyIncrement.periodLabel} &nbsp;|&nbsp;
              Max points: {yearlyIncrement.maxPoints}
              {yearlyIncrement.workingDays ? ` | Working days: ${yearlyIncrement.workingDays}` : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
