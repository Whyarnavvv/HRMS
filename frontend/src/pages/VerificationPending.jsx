import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ShieldCheck, Clock, LogOut, RefreshCcw } from 'lucide-react';

export default function VerificationPending() {
  const { user, logout } = useContext(AuthContext);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-xl w-full bg-white rounded-2xl sm:rounded-[3rem] shadow-2xl overflow-hidden animate-fade-in border border-white">
        
        {/* Top Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 sm:p-10 lg:p-12 text-center text-white relative">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2"></div>
           <div className="bg-white/20 p-4 rounded-3xl w-fit mx-auto mb-6 backdrop-blur-md">
              <ShieldCheck size={48} className="text-white" />
           </div>
           <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Identity Verification Required</h2>
           <p className="text-blue-100 mt-2 font-medium opacity-80">Protecting your data and our community</p>
        </div>

        <div className="p-5 sm:p-8 lg:p-12 text-center space-y-6 sm:space-y-8">
          <div className="bg-amber-50 border border-amber-100 p-4 sm:p-6 rounded-2xl sm:rounded-3xl flex items-start sm:items-center gap-4 sm:gap-5 text-left">
              <div className="bg-white p-3 rounded-2xl text-amber-500 shadow-sm">
                 <Clock size={24} />
              </div>
              <div>
                 <p className="font-bold text-slate-800 text-lg">Under HR Review</p>
                 <p className="text-sm text-slate-500 leading-relaxed font-medium">Please wait while your account is being verified. This typically takes 24-48 business hours.</p>
              </div>
           </div>

           <div className="space-y-4 pt-4">
              <p className="text-sm text-slate-400 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                 <RefreshCcw size={14} className="animate-spin" /> Auto-Refreshing Status
              </p>
              <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed">
                 You will be automatically logged in as an Employee once the HR team approves your submitted documents and PAN/Aadhaar details.
              </p>
           </div>

          <div className="pt-6 sm:pt-8 border-t border-slate-50 flex flex-col md:flex-row gap-4">
              <button 
                onClick={() => window.location.reload()}
                className="flex-1 bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 transition shadow-lg shadow-slate-200"
              >
                 Check Again
              </button>
              <button 
                onClick={logout}
                className="flex-1 bg-white border border-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-50 transition flex items-center justify-center gap-2"
              >
                 <LogOut size={18} /> Sign Out
              </button>
           </div>
        </div>

        <div className="bg-slate-50/50 py-6 text-center border-t border-slate-50">
           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Study Palace Hub Security Portal</p>
        </div>
      </div>
    </div>
  );
}
