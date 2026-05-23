import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ShieldAlert } from 'lucide-react';

export default function Login() {
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const { login } = useContext(AuthContext);
   const navigate = useNavigate();
   const [error, setError] = useState('');
   const [loading, setLoading] = useState(false);

   const handleSubmit = async (e) => {
      e.preventDefault();
      setError('');
      setLoading(true);
      try {
         await login(email, password);
         // AuthContext handles role-based redirection
      } catch (err) {
         setError(err || 'Login failed');
      } finally {
         setLoading(false);
      }
   };

   return (
      <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 animate-fade-in" style={{ backgroundColor: '#f8fafc' }}>

         {/* Visual / Branding Side */}
         <div className="hidden md:flex flex-col justify-center p-10 lg:p-16 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #172554 100%)' }}>
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600 rounded-full blur-[140px] opacity-20 pointer-events-none transform translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-600 rounded-full blur-[140px] opacity-10 pointer-events-none transform -translate-x-1/2 translate-y-1/2"></div>

            <div className="z-10 relative">
               <div className="flex items-center gap-4 mb-12">
                  <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-2xl shadow-blue-500/20">
                     <ShieldAlert size={32} />
                  </div>
                  <div>
                     <h2 className="text-xl font-bold text-white tracking-tight">Study Palace Hub</h2>
                     <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Advanced HRMS 2.0</p>
                  </div>
               </div>
               <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-[1.1] mb-6 tracking-tight">
                  Enterprise <br /> Resource <br /> Management.
               </h1>
               <p className="text-slate-400 text-lg max-w-md leading-relaxed">
                  A unified platform for performance tracking, automated payroll, and secure employee documentation.
               </p>
            </div>
         </div>

         {/* Login Form Side */}
         <div className="flex items-center justify-center p-4 sm:p-6 md:p-8 bg-white border-l border-slate-100">
            <div className="w-full max-w-md">

               <div className="mb-8 sm:mb-10 text-center md:text-left">
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Secure Access</h2>
                  <p className="text-slate-500 mt-2 font-medium">Please enter your credentials to proceed</p>
               </div>

               {error && (
                  <div className="flex items-center gap-3 mb-8 p-5 rounded-2xl bg-red-50 text-red-600 border border-red-100 text-sm font-bold animate-in slide-in-from-top-4 duration-200">
                     <ShieldAlert size={20} /> {error}
                  </div>
               )}

               <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Work Email</label>
                     <div className="relative group">
                        <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                        <input
                           type="email"
                           required
                           placeholder="email@company.com"
                           value={email}
                           onChange={(e) => setEmail(e.target.value)}
                           className="w-full bg-slate-50 border border-slate-100 text-slate-900 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all py-4 pl-12 pr-4 placeholder:text-slate-300"
                        />
                     </div>
                  </div>

                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Security Password</label>
                     <div className="relative group">
                        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                        <input
                           type="password"
                           required
                           placeholder="••••••••"
                           value={password}
                           onChange={(e) => setPassword(e.target.value)}
                           className="w-full bg-slate-50 border border-slate-100 text-slate-900 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all py-4 pl-12 pr-4 placeholder:text-slate-300"
                        />
                     </div>
                     <div className="flex justify-end mt-2">
                        <Link to="/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                           Forgot password?
                        </Link>
                     </div>
                  </div>

                  <button
                     type="submit"
                     disabled={loading}
                     className="w-full flex justify-center items-center py-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-xl shadow-blue-100 disabled:opacity-50"
                  >
                     {loading ? (
                        <span className="flex items-center gap-2">
                           <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full shadow-sm"></span> Verifying Identity...
                        </span>
                     ) : 'Log In to Dashboard'}
                  </button>
               </form>

               <div className="text-center mt-12 space-y-4">
                  <p className="text-sm text-slate-500">
                     New team member? <Link to="/register" className="text-blue-600 font-bold hover:underline">Register your account</Link>
                  </p>
                  <div className="pt-8 border-t border-slate-50">
                     <p className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em]">Authorized Access Only</p>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}

