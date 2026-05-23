import { useState, useEffect } from 'react';
import api from '../utils/axios';
import { 
  Trophy, 
  Medal, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Star,
  Award,
  ChevronRight
} from 'lucide-react';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/kpi/leaderboard');
      setLeaderboard(data);
    } catch (err) {
      console.error('Failed to fetch leaderboard', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = leaderboard.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const topThree = filteredData.slice(0, 3);
  const rest = filteredData.slice(3);

  if (loading) return (
     <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="font-bold text-slate-400 animate-pulse uppercase tracking-widest text-xs">Ranking the Champions...</p>
     </div>
  );

  return (
    <div className="space-y-8 sm:space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">Performance Leaderboard</h1>
          <p className="text-sm sm:text-base text-slate-500 font-medium">Lifetime standings based on KPI points and work excellence</p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Find an achiever..."
            className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Podium Section */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end max-w-5xl mx-auto pt-10">
          {/* Silver - Rank 2 */}
          {topThree[1] && (
            <div className="order-2 md:order-1 flex flex-col items-center group">
               <div className="relative mb-4">
                  <div className="w-24 h-24 rounded-[2rem] bg-slate-100 border-4 border-slate-200 flex items-center justify-center font-black text-slate-400 shadow-xl overflow-hidden group-hover:scale-105 transition-transform duration-500">
                     {topThree[1].profilePic ? <img src={topThree[1].profilePic} alt="" className="w-full h-full object-cover" /> : topThree[1].name.charAt(0)}
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-slate-300 text-white p-2 rounded-xl shadow-lg border-2 border-white">
                     <Medal size={20} />
                  </div>
               </div>
               <div className="text-center mb-6">
                  <p className="text-lg font-black text-slate-800">{topThree[1].name}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{topThree[1].role}</p>
               </div>
               <div className="bg-white w-full h-48 rounded-t-[3rem] shadow-2xl border-x border-t border-slate-100 p-8 flex flex-col items-center justify-center gap-2">
                  <span className="text-4xl font-black text-slate-300">#2</span>
                  <div className="text-2xl font-black text-slate-800">{topThree[1].totalKpi} pts</div>
               </div>
            </div>
          )}

          {/* Gold - Rank 1 */}
          {topThree[0] && (
            <div className="order-1 md:order-2 flex flex-col items-center group -translate-y-6">
               <div className="relative mb-6">
                  <div className="w-32 h-32 rounded-[2.5rem] bg-amber-50 border-4 border-amber-300 flex items-center justify-center font-black text-amber-600 shadow-2xl overflow-hidden group-hover:scale-110 transition-transform duration-500">
                     {topThree[0].profilePic ? <img src={topThree[0].profilePic} alt="" className="w-full h-full object-cover" /> : topThree[0].name.charAt(0)}
                  </div>
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                     <Trophy size={48} className="text-amber-400 drop-shadow-lg animate-bounce" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-amber-500 text-white p-2.5 rounded-2xl shadow-lg border-2 border-white">
                     <Star size={24} fill="currentColor" />
                  </div>
               </div>
               <div className="text-center mb-8">
                  <p className="text-2xl font-black text-slate-900 leading-tight">{topThree[0].name}</p>
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-[0.2em] mt-1">Leading the League</p>
               </div>
               <div className="bg-gradient-to-b from-amber-400 to-amber-600 w-full h-64 rounded-t-[3rem] shadow-2xl p-10 flex flex-col items-center justify-center gap-3">
                  <span className="text-5xl font-black text-white/40">#1</span>
                  <div className="text-4xl font-black text-white drop-shadow-md">{topThree[0].totalKpi}</div>
                  <div className="text-[10px] font-black text-white/80 uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">Net Points</div>
               </div>
            </div>
          )}

          {/* Bronze - Rank 3 */}
          {topThree[2] && (
            <div className="order-3 flex flex-col items-center group">
               <div className="relative mb-4">
                  <div className="w-24 h-24 rounded-[2rem] bg-orange-50 border-4 border-orange-200 flex items-center justify-center font-black text-orange-400 shadow-xl overflow-hidden group-hover:scale-105 transition-transform duration-500">
                     {topThree[2].profilePic ? <img src={topThree[2].profilePic} alt="" className="w-full h-full object-cover" /> : topThree[2].name.charAt(0)}
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-orange-400 text-white p-2 rounded-xl shadow-lg border-2 border-white">
                     <Award size={20} />
                  </div>
               </div>
               <div className="text-center mb-6">
                  <p className="text-lg font-black text-slate-800">{topThree[2].name}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{topThree[2].role}</p>
               </div>
               <div className="bg-white w-full h-36 rounded-t-[3rem] shadow-2xl border-x border-t border-slate-100 p-8 flex flex-col items-center justify-center gap-2">
                  <span className="text-4xl font-black text-orange-200">#3</span>
                  <div className="text-2xl font-black text-slate-800">{topThree[2].totalKpi} pts</div>
               </div>
            </div>
          )}
        </div>
      )}

      {/* Remaining List */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl sm:rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 sm:p-8 border-b border-slate-50 flex justify-between items-center text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400">
           <span>The Grand League</span>
          <div className="hidden sm:flex gap-10">
              <span>Performance</span>
              <span>KPI Total</span>
           </div>
        </div>
        <div className="divide-y divide-slate-50">
          {rest.map((user, idx) => (
            <div key={user._id} className="p-4 sm:p-6 hover:bg-slate-50/50 transition-colors flex items-center gap-3 sm:gap-6 group">
               <div className="w-8 text-sm font-black text-slate-300 group-hover:text-blue-600 transition-colors">
                  {(idx + 4).toString().padStart(2, '0')}
               </div>
               <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center text-slate-400 font-bold text-sm">
                  {user.profilePic ? <img src={user.profilePic} alt="" /> : user.name.charAt(0)}
               </div>
               <div className="flex-1">
                  <p className="font-black text-slate-800 group-hover:translate-x-1 transition-transform">{user.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{user.role} • {user.designation || 'Staff'}</p>
               </div>
               
               <div className="flex items-center gap-4 sm:gap-12 text-right">
                  <div className="flex gap-4">
                     <div className="flex flex-col items-center">
                        <span className="text-[9px] font-bold text-emerald-500 tracking-tighter uppercase mb-0.5">+{user.totalAdded || 0}</span>
                        <TrendingUp size={12} className="text-emerald-400" />
                     </div>
                     <div className="flex flex-col items-center">
                        <span className="text-[9px] font-bold text-red-500 tracking-tighter uppercase mb-0.5">-{user.totalDeducted || 0}</span>
                        <TrendingDown size={12} className="text-red-400" />
                     </div>
                  </div>
                  <div className="w-20">
                     <span className="text-xl font-black text-slate-800">{user.totalKpi}</span>
                     <p className="text-[8px] font-black text-slate-400 uppercase leading-none">Net Score</p>
                  </div>
                  <ChevronRight size={18} className="text-slate-200 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
               </div>
            </div>
          ))}
          {rest.length === 0 && filteredData.length <= 3 && (
            <div className="p-20 text-center text-slate-300 italic font-medium"> No further rankings available at this time</div>
          )}
        </div>
      </div>
    </div>
  );
}
