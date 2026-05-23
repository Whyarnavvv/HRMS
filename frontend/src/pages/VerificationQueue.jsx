import { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axios';
import { AuthContext } from '../context/AuthContext';
import {
  ShieldCheck, Search, AlertTriangle, CheckCircle2,
  ExternalLink, FileText, ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react';

const STATUS_STYLES = {
  'Documents Missing': 'bg-red-50 text-red-600 border-red-100',
  'Under Review':      'bg-amber-50 text-amber-600 border-amber-100',
  'Rejected':          'bg-rose-50 text-rose-600 border-rose-100',
  'Pending':           'bg-slate-50 text-slate-500 border-slate-100',
};

export default function VerificationQueue() {
  const { user } = useContext(AuthContext);
  const navigate  = useNavigate();

  const [rows, setRows]           = useState([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [verifying, setVerifying] = useState(null); // id being verified
  const [toast, setToast]         = useState(null); // { type: 'success'|'error', msg }

  const [search, setSearch]       = useState('');
  const [department, setDepartment] = useState('');
  const [sort, setSort]           = useState('joiningDate');
  const [page, setPage]           = useState(1);
  const LIMIT = 15;

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/employees/unverified', {
        params: { search, department, sort, page, limit: LIMIT }
      });
      setRows(data.employees || []);
      setTotal(data.total || 0);
    } catch {
      showToast('error', 'Failed to load verification queue');
    } finally {
      setLoading(false);
    }
  }, [search, department, sort, page]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, department, sort]);

  const handleVerify = async (emp) => {
    if (!window.confirm(`Mark "${emp.name}" (${emp.employeeId}) as ID Verified?\n\nThis action will be logged with your name and timestamp.`)) return;
    setVerifying(emp._id);
    try {
      await api.patch(`/employees/${emp._id}/verify`);
      showToast('success', `${emp.name} has been verified successfully.`);
      load();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Verification failed');
    } finally {
      setVerifying(null);
    }
  };

  const handleRequestDocs = (emp) => {
    // Navigate to employee profile where HR can review/request docs
    navigate(`/admin/employee/${emp._id}`);
  };

  const totalPages = Math.ceil(total / LIMIT);
  const isOverdue  = (emp) => emp.isOverdue;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl font-bold text-sm transition-all ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-amber-50 text-amber-500 rounded-2xl">
              <ShieldCheck size={24} />
            </div>
            ID Verification Queue
          </h1>
          <p className="text-sm text-slate-500 mt-1 ml-1">
            Employees whose identity has not been verified yet
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-amber-100 text-amber-700 font-black text-sm px-4 py-2 rounded-2xl border border-amber-200">
            {total} Pending
          </span>
          <button onClick={load} className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-700 transition shadow-sm">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, ID, department..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <input
          type="text"
          placeholder="Filter by department"
          value={department}
          onChange={e => setDepartment(e.target.value)}
          className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 w-48"
        />
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="joiningDate">Sort: Oldest First</option>
          <option value="-joiningDate">Sort: Newest First</option>
          <option value="name">Sort: Name A–Z</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="space-y-0 divide-y divide-slate-50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-2xl bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-40" />
                  <div className="h-2.5 bg-slate-100 rounded w-24" />
                </div>
                <div className="h-6 bg-slate-100 rounded-xl w-24" />
                <div className="h-8 bg-slate-100 rounded-xl w-20" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
            <div className="p-5 bg-emerald-50 rounded-3xl">
              <CheckCircle2 size={40} className="text-emerald-500" />
            </div>
            <p className="font-black text-lg text-slate-700">All IDs are verified ✓</p>
            <p className="text-sm">No employees pending ID verification</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Department</th>
                    <th className="px-6 py-4">Designation</th>
                    <th className="px-6 py-4">Date of Joining</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map(emp => (
                    <tr
                      key={emp._id}
                      className={`group transition-colors ${isOverdue(emp) ? 'bg-red-50/30 hover:bg-red-50/50' : 'hover:bg-slate-50/50'}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm ${
                            isOverdue(emp) ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {emp.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-black text-slate-800 text-sm flex items-center gap-2">
                              {emp.name}
                              {isOverdue(emp) && (
                                <span title="Overdue — joined 30+ days ago">
                                  <AlertTriangle size={13} className="text-red-500" />
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{emp.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-600">{emp.department}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-600">{emp.designation}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-500">
                        {emp.joiningDate
                          ? new Date(emp.joiningDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border ${STATUS_STYLES[emp.verificationStatus] || STATUS_STYLES['Pending']}`}>
                          {emp.verificationStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleRequestDocs(emp)}
                            title="View Profile / Request Documents"
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100"
                          >
                            <FileText size={16} />
                          </button>
                          <button
                            onClick={() => navigate(`/admin/employee/${emp._id}`)}
                            title="Open Profile"
                            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all border border-transparent hover:border-slate-200"
                          >
                            <ExternalLink size={16} />
                          </button>
                          <button
                            onClick={() => handleVerify(emp)}
                            disabled={verifying === emp._id}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black transition-all disabled:opacity-50 shadow-sm shadow-emerald-200"
                          >
                            {verifying === emp._id
                              ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              : <ShieldCheck size={13} />
                            }
                            Verify
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400">
                  Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 disabled:opacity-30 transition"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-black text-slate-600 px-2">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 disabled:opacity-30 transition"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
