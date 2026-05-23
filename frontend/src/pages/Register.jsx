import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/axios';
import { User, Mail, ShieldCheck, CheckCircle, ArrowRight } from 'lucide-react';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/register', { name, email });
      setIsSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-md w-full bg-white rounded-2xl sm:rounded-[3rem] shadow-2xl p-6 sm:p-10 text-center animate-fade-in border border-white">
          <div className="bg-emerald-50 text-emerald-500 p-6 rounded-full w-fit mx-auto mb-8 shadow-inner">
            <CheckCircle size={48} />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4">Registration Success!</h2>
          <p className="text-slate-500 leading-relaxed mb-10">
            Thank you for registering. <strong className="text-slate-900">Your profile will be updated shortly</strong> once you verify your email.
          </p>
          <Link 
            to="/" 
            className="w-full bg-blue-600 text-white font-bold py-5 rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
          >
            Return to Login <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    );
  }

  return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-md w-full bg-white rounded-2xl sm:rounded-[2.5rem] shadow-2xl shadow-blue-100 overflow-hidden border border-white">
        <div className="p-6 sm:p-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-200">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">HRMS Portal</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">New Staff Registration</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Create Account</h2>
            <p className="text-slate-500 mt-2">Sign up to receive your access invite</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-medium flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1 uppercase tracking-wider">Full Name</label>
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" required
                  placeholder="John Doe"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-300 font-medium"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="email" required
                  placeholder="email@company.com"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-300 font-medium"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 text-white font-bold py-5 rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed mt-4 flex items-center justify-center gap-2"
            >
              {loading ? 'Processing...' : (
                <>Send Invite Link <ArrowRight size={18} /></>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-slate-500">
            Already have an account? <Link to="/" className="text-blue-600 font-bold hover:underline">Log in here</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

