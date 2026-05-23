import { useState, useEffect } from 'react';
import api from '../utils/axios';
import { Calendar, Trash2, Plus, AlertCircle, CheckCircle } from 'lucide-react';

export default function HolidayManagement() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '', type: 'Company', description: '' });
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/holidays');
      setHolidays(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/holidays', newHoliday);
      setHolidays([...holidays, data].sort((a, b) => a.date.localeCompare(b.date)));
      setNewHoliday({ date: '', name: '', type: 'Company', description: '' });
      setMessage({ type: 'success', text: 'Holiday added successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to add holiday' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;
    try {
      await api.delete(`/holidays/${id}`);
      setHolidays(holidays.filter(h => h._id !== id));
      setMessage({ type: 'success', text: 'Holiday deleted' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Holiday Calendar</h1>
          <p className="text-sm sm:text-base text-slate-500 font-medium">Manage company-wide holidays and national observances</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Add Holiday Form */}
        <div className="lg:col-span-1">
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Plus size={20} className="text-blue-600" /> Add New Holiday
            </h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-2">Holiday Name</label>
                <input 
                  required
                  type="text"
                  placeholder="e.g. Diwali, Independence Day"
                  className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                  value={newHoliday.name}
                  onChange={e => setNewHoliday({...newHoliday, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-2">Date</label>
                  <input 
                    required
                    type="date"
                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                    value={newHoliday.date}
                    onChange={e => setNewHoliday({...newHoliday, date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-2">Type</label>
                  <select 
                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                    value={newHoliday.type}
                    onChange={e => setNewHoliday({...newHoliday, type: e.target.value})}
                  >
                    <option value="National">National</option>
                    <option value="Company">Company</option>
                    <option value="Regional">Regional</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-2">Description (Optional)</label>
                <textarea 
                  rows="2"
                  placeholder="Brief details about the holiday..."
                  className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none resize-none"
                  value={newHoliday.description}
                  onChange={e => setNewHoliday({...newHoliday, description: e.target.value})}
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
              >
                Add Holiday
              </button>
            </form>

            {message && (
              <div className={`flex items-center gap-3 p-4 rounded-2xl text-sm font-bold animate-in slide-in-from-top duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                {message.text}
              </div>
            )}
          </div>
        </div>

        {/* Holiday List */}
        <div className="lg:col-span-2">
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 shadow-sm min-h-[400px]">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Calendar size={20} className="text-slate-400" /> Upcoming Holidays
            </h3>

            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-bold text-slate-400">Loading calendar...</p>
              </div>
            ) : holidays.length > 0 ? (
              <div className="space-y-4">
                {holidays.map(h => (
                  <div key={h._id} className="group flex items-center justify-between p-5 bg-slate-50 hover:bg-white hover:shadow-md border border-transparent hover:border-slate-100 rounded-3xl transition-all duration-300">
                    <div className="flex items-center gap-5">
                      <div className="flex flex-col items-center justify-center w-16 h-16 bg-white rounded-2xl border border-slate-100 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                        <span className="text-[10px] font-black uppercase tracking-tighter opacity-60">
                          {new Date(h.date).toLocaleString('default', { month: 'short' })}
                        </span>
                        <span className="text-2xl font-black">
                          {new Date(h.date).getDate()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-slate-800">{h.name}</h4>
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                            h.type === 'National' ? 'bg-amber-100 text-amber-600' :
                            h.type === 'Company' ? 'bg-blue-100 text-blue-600' :
                            'bg-slate-200 text-slate-600'
                          }`}>
                            {h.type}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-400 mt-0.5">{h.description || 'Company-wide holiday observance'}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDelete(h._id)}
                      className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all active:scale-90"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 opacity-30 gap-3">
                <Calendar size={48} />
                <p className="font-black text-slate-400 uppercase tracking-widest">No holidays scheduled</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
