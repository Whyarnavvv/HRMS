import { useEffect, useState, useContext } from 'react';
import api from '../utils/axios';
import { AuthContext } from '../context/AuthContext';

export default function GeofenceManagement() {
  const { user } = useContext(AuthContext);
  const [zones, setZones] = useState([]);
  const [defaultZoneId, setDefaultZoneId] = useState(null);
  const [form, setForm] = useState({ name: '', latitude: '', longitude: '', radius: 100 });

  const loadZones = async () => {
    const { data } = await api.get('/settings/geofences');
    setZones(data.zones || []);
    setDefaultZoneId(data.defaultZoneId);
  };

  useEffect(() => { loadZones(); }, []);

  if (user?.role === 'HR') {
    return <p className="text-slate-500 p-6">You are not authorized to access geolocation settings.</p>;
  }

  const createZone = async () => {
    await api.post('/settings/geofences', {
      name: form.name,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      radius: Number(form.radius)
    });
    setForm({ name: '', latitude: '', longitude: '', radius: 100 });
    await loadZones();
  };

  const setDefault = async (id) => {
    await api.put(`/settings/geofences/${id}/default`);
    await loadZones();
  };

  const removeZone = async (id) => {
    await api.delete(`/settings/geofences/${id}`);
    await loadZones();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Geofence Management</h1>

      <div className="bg-white border rounded-2xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <input className="border rounded-xl px-3 py-2" placeholder="Zone Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="border rounded-xl px-3 py-2" placeholder="Latitude" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
        <input className="border rounded-xl px-3 py-2" placeholder="Longitude" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
        <input className="border rounded-xl px-3 py-2" placeholder="Radius (m)" value={form.radius} onChange={(e) => setForm({ ...form, radius: e.target.value })} />
        <button onClick={createZone} className="md:col-span-4 bg-blue-600 text-white rounded-xl py-2 font-semibold">Add Zone</button>
      </div>

      <div className="bg-white border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Latitude</th>
              <th className="px-4 py-3">Longitude</th>
              <th className="px-4 py-3">Radius</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => (
              <tr key={zone._id} className="border-t">
                <td className="px-4 py-3 font-semibold">{zone.name}{defaultZoneId === zone._id ? ' (Default)' : ''}</td>
                <td className="px-4 py-3">{zone.latitude}</td>
                <td className="px-4 py-3">{zone.longitude}</td>
                <td className="px-4 py-3">{zone.radius}m</td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => setDefault(zone._id)} className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold">Set Default</button>
                  <button onClick={() => removeZone(zone._id)} className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-semibold">Delete</button>
                </td>
              </tr>
            ))}
            {zones.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No geofence zones configured</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
