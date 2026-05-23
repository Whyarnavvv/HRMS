import { useEffect, useState } from 'react';
import api from '../utils/axios';

export default function WFHRequest() {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({
    latitude: '',
    longitude: '',
    address: '',
    reason: '',
    date: ''
  });

  const load = async () => {
    const { data } = await api.get('/wfh-requests/my');
    setRecords(data || []);
  };

  useEffect(() => { load(); }, []);

  const useCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setForm((prev) => ({
        ...prev,
        latitude: String(pos.coords.latitude),
        longitude: String(pos.coords.longitude)
      }));
    });
  };

  const submit = async () => {
    await api.post('/wfh-requests', {
      ...form,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude)
    });
    setForm({ latitude: '', longitude: '', address: '', reason: '', date: '' });
    await load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">WFH Location Request</h1>
      <div className="bg-white border rounded-2xl p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        <input className="border rounded-xl px-3 py-2" placeholder="Latitude" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
        <input className="border rounded-xl px-3 py-2" placeholder="Longitude" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
        <input className="border rounded-xl px-3 py-2 md:col-span-2" placeholder="Address (optional)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <input className="border rounded-xl px-3 py-2 md:col-span-2" placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        <div className="md:col-span-2 flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">WFH Date (single day only)</label>
          <input type="date" className="border rounded-xl px-3 py-2" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <button onClick={useCurrentLocation} className="bg-slate-100 rounded-xl py-2 font-semibold w-full">Use Current Location</button>
        <button onClick={submit} className="bg-blue-600 text-white rounded-xl py-2 font-semibold w-full">Submit Request</button>
      </div>

      <div className="bg-white border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r._id} className="border-t">
                <td className="px-4 py-3">{r.fromDate}</td>
                <td className="px-4 py-3">{r.reason}</td>
                <td className="px-4 py-3 font-semibold">{r.status}</td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500">No WFH requests yet</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
