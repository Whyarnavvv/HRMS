import { useEffect, useState } from 'react';
import api from '../utils/axios';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({ module: '', action: '' });

  const load = async () => {
    const params = {};
    if (filters.module) params.module = filters.module;
    if (filters.action) params.action = filters.action;
    const { data } = await api.get('/audit-logs', { params });
    setLogs(data.records || []);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Audit Logs</h1>
      <div className="bg-white border rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
        <input className="border rounded-xl px-3 py-2 w-full" placeholder="Filter module" value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value })} />
        <input className="border rounded-xl px-3 py-2 w-full" placeholder="Filter action" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} />
        <button onClick={load} className="bg-blue-600 text-white rounded-xl px-4 py-2 font-semibold w-full sm:w-auto">Apply</button>
      </div>
      <div className="bg-white border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id} className="border-t">
                <td className="px-4 py-3">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3">{log.actorUserId?.name || 'System'}</td>
                <td className="px-4 py-3">{log.actorRole || '-'}</td>
                <td className="px-4 py-3">{log.module}</td>
                <td className="px-4 py-3 font-semibold">{log.action}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No audit logs found</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
