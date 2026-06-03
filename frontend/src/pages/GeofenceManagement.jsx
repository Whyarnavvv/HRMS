import { useEffect, useState, useContext } from 'react';
import api from '../utils/axios';
import { AuthContext } from '../context/AuthContext';

export default function GeofenceManagement() {
  const { user } = useContext(AuthContext);
  const [zones, setZones] = useState([]);
  const [defaultZoneId, setDefaultZoneId] = useState(null);
  const [form, setForm] = useState({ name: '', latitude: '', longitude: '', radius: 100 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadZones = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/settings/geofences');
      setZones(data.zones || []);
      setDefaultZoneId(data.defaultZoneId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load geofence zones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadZones(); }, []);

  if (user?.role === 'HR') {
    return <p className="text-slate-500 p-6">You are not authorized to access geolocation settings.</p>;
  }

  const createZone = async () => {
    if (!form.name.trim()) { setError('Zone name is required'); return; }
    if (!form.latitude || !form.longitude) { setError('Latitude and longitude are required'); return; }
    setError('');
    try {
      await api.post('/settings/geofences', {
        name: form.name,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radius: Number(form.radius)
      });
      setForm({ name: '', latitude: '', longitude: '', radius: 100 });
      await loadZones();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create zone');
    }
  };

  const setDefault = async (id) => {
    setError('');
    try {
      await api.put(`/settings/geofences/${id}/default`);
      await loadZones();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to set default zone');
    }
  };

  const removeZone = async (id) => {
    if (!window.confirm('Delete this geofence zone?')) return;
    setError('');
    try {
      await api.delete(`/settings/geofences/${id}`);
      await loadZones();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete zone');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Geofence Management</h1>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-bold flex items-center justify-between">
          {error}
          <button onClick={() => setError('')} className="ml-3 text-xs underline">Dismiss</button>
        </div>
      )}

      <div className="bg-white border rounded-2xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <input
          className="border rounded-xl px-3 py-2"
          placeholder="Zone Name *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="border rounded-xl px-3 py-2"
          placeholder="Latitude *"
          value={form.latitude}
          onChange={(e) => setForm({ ...form, latitude: e.target.value })}
        />
        <input
          className="border rounded-xl px-3 py-2"
          placeholder="Longitude *"
          value={form.longitude}
          onChange={(e) => setForm({ ...form, longitude: e.target.value })}
        />
        <input
          className="border rounded-xl px-3 py-2"
          placeholder="Radius (m)"
          value={form.radius}
          onChange={(e) => setForm({ ...form, radius: e.target.value })}
        />
        <button
          onClick={createZone}
          className="sm:col-span-2 lg:col-span-4 bg-blue-600 text-white rounded-xl py-2 font-semibold hover:bg-blue-700 transition"
        >
          Add Zone
        </button>
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
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Loading...</td></tr>
              ) : zones.map((zone) => (
                <tr key={zone._id} className="border-t">
                  <td className="px-4 py-3 font-semibold">
                    {zone.name}
                    {defaultZoneId && defaultZoneId.toString() === zone._id.toString() && (
                      <span className="ml-2 text-[10px] font-black uppercase bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Default</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{zone.latitude}</td>
                  <td className="px-4 py-3">{zone.longitude}</td>
                  <td className="px-4 py-3">{zone.radius}m</td>
                  <td className="px-4 py-3 flex gap-2">
                    <button
                      onClick={() => setDefault(zone._id)}
                      className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-200 transition"
                    >
                      Set Default
                    </button>
                    <button
                      onClick={() => removeZone(zone._id)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200 transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && zones.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No geofence zones configured</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
