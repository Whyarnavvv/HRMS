import { useEffect, useState, useContext } from 'react';
import api from '../utils/axios';
import { AuthContext } from '../context/AuthContext';

const APPROVER_ROLES = ['SuperAdmin', 'AGM', 'Admin'];

export default function WFHApprovals() {
  const { user } = useContext(AuthContext);
  const [records, setRecords] = useState([]);
  const [locationMap, setLocationMap] = useState({});

  if (!APPROVER_ROLES.includes(user?.role)) {
    return <p className="text-slate-500 p-6">You are not authorized to view WFH approvals.</p>;
  }

  const load = async () => {
    const { data } = await api.get('/wfh-requests');
    setRecords(data || []);
  };

  useEffect(() => { load(); }, []);

  const fetchLocation = async (id) => {
    if (locationMap[id]) return; // already fetched
    try {
      const { data } = await api.get(`/wfh-requests/${id}/employee-location`);
      setLocationMap((prev) => ({ ...prev, [id]: data }));
    } catch {
      setLocationMap((prev) => ({ ...prev, [id]: { error: 'Could not fetch location' } }));
    }
  };

  const approve = async (id) => {
    await api.patch(`/wfh-requests/${id}/approve`, {});
    await load();
  };

  const reject = async (id) => {
    await api.patch(`/wfh-requests/${id}/reject`, {});
    await load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">WFH Request Approvals</h1>
      <div className="bg-white border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Employee Location</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const loc = locationMap[r._id];
              return (
                <tr key={r._id} className="border-t align-top">
                  <td className="px-4 py-3">{r.user?.name || 'Unknown'}</td>
                  <td className="px-4 py-3">{r.fromDate}</td>
                  <td className="px-4 py-3">{r.reason}</td>
                  <td className="px-4 py-3 font-semibold">{r.status}</td>
                  <td className="px-4 py-3">
                    {!loc ? (
                      <button
                        onClick={() => fetchLocation(r._id)}
                        className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold"
                      >
                        View Location
                      </button>
                    ) : loc.error ? (
                      <span className="text-xs text-red-500">{loc.error}</span>
                    ) : (
                      <div className="text-xs space-y-0.5">
                        <p className="font-semibold text-slate-700">{loc.address || 'No address'}</p>
                        <p className="text-slate-500">Lat: {loc.latitude}, Lng: {loc.longitude}</p>
                        <a
                          href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 underline"
                        >
                          Open in Maps
                        </a>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => approve(r._id)} className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold">Approve</button>
                    <button onClick={() => reject(r._id)} className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-semibold">Reject</button>
                  </td>
                </tr>
              );
            })}
            {records.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No WFH requests pending review</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
