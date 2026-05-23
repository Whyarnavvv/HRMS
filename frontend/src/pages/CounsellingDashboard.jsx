import { useContext, useEffect, useState } from 'react';
import api from '../utils/axios';
import { AuthContext } from '../context/AuthContext';
import { Phone, Plus, FileText } from 'lucide-react';

export default function CounsellingDashboard() {
  const { user } = useContext(AuthContext);
  const isCounselling = user?.role === 'Counselling Team';
  const isSuperAdmin  = user?.role === 'SuperAdmin';

  if (!isCounselling && !isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
        <Phone size={40} className="opacity-30" />
        <p className="font-bold text-sm uppercase tracking-widest">Access Restricted</p>
      </div>
    );
  }

  const [logs, setLogs]           = useState([]);
  const [showForm, setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm]           = useState({ phoneNumber: '', callSummary: '', remarks: '' });
  const [file, setFile]           = useState(null);

  const BACKEND = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

  const load = async () => {
    try {
      const endpoint = isSuperAdmin ? '/counselling' : '/counselling/my';
      const { data } = await api.get(endpoint);
      setLogs(data || []);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.phoneNumber || !form.callSummary) return alert('Phone number and call summary are required.');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('phoneNumber', form.phoneNumber);
      fd.append('callSummary', form.callSummary);
      fd.append('remarks', form.remarks);
      if (file) fd.append('screenshot', file);
      await api.post('/counselling', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm({ phoneNumber: '', callSummary: '', remarks: '' });
      setFile(null);
      setShowForm(false);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Submission failed');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Counselling Logs</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isSuperAdmin ? 'All submissions — SuperAdmin view' : 'Log your call records'}
          </p>
        </div>
        {isCounselling && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-100">
            <Plus size={18} /> New Log
          </button>
        )}
      </div>

      {/* Log form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-black text-slate-800">New Call Log</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={submit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-400 mb-1">Phone Number</label>
                <input type="text" required value={form.phoneNumber}
                  onChange={e => setForm({ ...form, phoneNumber: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold"
                  placeholder="+91 XXXXX XXXXX" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-slate-400 mb-1">Call Summary</label>
                <textarea required rows={3} value={form.callSummary}
                  onChange={e => setForm({ ...form, callSummary: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold resize-none"
                  placeholder="Brief summary of the call…" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-slate-400 mb-1">Remarks</label>
                <textarea rows={2} value={form.remarks}
                  onChange={e => setForm({ ...form, remarks: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold resize-none"
                  placeholder="Optional remarks…" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-slate-400 mb-1">Call Screenshot (optional)</label>
                <input type="file" accept="image/*"
                  onChange={e => setFile(e.target.files[0])}
                  className="w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-slate-100 file:font-bold file:text-slate-600 hover:file:bg-slate-200" />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-blue-600 text-white font-black py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
                {submitting ? 'Submitting…' : 'Submit Log'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Logs list */}
      <div className="space-y-3">
        {logs.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
            <FileText size={36} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-bold">No logs yet</p>
          </div>
        )}
        {logs.map(log => (
          <div key={log._id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-blue-500" />
                  <span className="font-black text-slate-800">{log.phoneNumber}</span>
                  <span className="text-[10px] text-slate-400 font-bold ml-auto">
                    {new Date(log.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                {isSuperAdmin && log.submittedBy && (
                  <p className="text-xs text-slate-500 font-semibold">
                    By: <span className="font-black text-slate-700">{log.submittedBy.name}</span>
                    {log.submittedBy.employeeId && ` (${log.submittedBy.employeeId})`}
                  </p>
                )}
                <p className="text-sm text-slate-700 font-semibold mt-2">{log.callSummary}</p>
                {log.remarks && <p className="text-xs text-slate-500 italic">{log.remarks}</p>}
              </div>
              {log.screenshotFilename && (
                <a href={`${BACKEND}/uploads/${log.screenshotFilename}`} target="_blank" rel="noreferrer">
                  <img src={`${BACKEND}/uploads/${log.screenshotFilename}`} alt="Call screenshot"
                    className="w-32 h-20 object-cover rounded-xl border border-slate-200 hover:scale-105 transition-transform shadow-sm" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
