import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/axios';
import { CheckCircle, XCircle, Loader2, Lock, ShieldCheck, ArrowRight } from 'lucide-react';

export default function PasswordSetup() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading, valid, success, error
  const [userData, setUserData] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [btnLoading, setBtnLoading] = useState(false);

  useEffect(() => {
    const checkToken = async () => {
      try {
        const { data } = await api.get(`/auth/check-token/${token}`);
        if (data.valid) {
          setUserData(data);
          setStatus('valid');
        } else {
          setStatus('error');
          setError('This link is invalid or has already been used.');
        }
      } catch (err) {
        setStatus('error');
        setError('Token validation failed. Please request a new invite.');
      }
    };
    checkToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }
    if (password.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    setBtnLoading(true);
    try {
      await api.post(`/auth/setup-password/${token}`, { password });
      setStatus('success');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to set password');
    } finally {
      setBtnLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-md w-full bg-white rounded-2xl sm:rounded-[2.5rem] shadow-2xl p-6 sm:p-10 animate-fade-in border border-white">
        
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-6 py-10">
            <Loader2 size={64} className="text-blue-500 animate-spin" />
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Validating Invitation</h2>
              <p className="text-slate-500 mt-2">Securing your connection...</p>
            </div>
          </div>
        )}

        {status === 'valid' && (
          <>
            <div className="flex items-center gap-3 mb-10">
              <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-200">
                <ShieldCheck size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Account Setup</h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Final Step for {userData.name}</p>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Set Password</h2>
              <p className="text-slate-500 mt-2">Almost there! Create a strong password to activate your HRMS portal access.</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-medium flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 ml-1 uppercase tracking-wider">New Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="password" required
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-300 font-medium"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 ml-1 uppercase tracking-wider">Confirm Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="password" required
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-300 font-medium"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={btnLoading}
                className="w-full bg-blue-600 text-white font-bold py-5 rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed mt-4 flex items-center justify-center gap-2"
              >
                {btnLoading ? 'Activating...' : (
                  <>Activate Account <ArrowRight size={18} /></>
                )}
              </button>
            </form>
          </>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-6 py-6 text-center">
            <div className="bg-emerald-50 text-emerald-500 p-6 rounded-full shadow-inner">
              <CheckCircle size={64} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Account Active!</h2>
              <p className="text-slate-500 mt-4 leading-relaxed">
                Your email is verified and your password has been secured. 
                You can now log in to complete your KYC details.
              </p>
            </div>
            <Link 
              to="/" 
              className="w-full bg-blue-600 text-white font-bold py-5 rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 mt-6 block"
            >
              Sign In Now
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-6 py-6 text-center">
            <div className="bg-red-50 text-red-500 p-6 rounded-full shadow-inner">
              <XCircle size={64} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Setup Failed</h2>
              <p className="text-slate-500 mt-4 leading-relaxed">{error}</p>
            </div>
            <Link 
              to="/register" 
              className="w-full bg-slate-100 text-slate-600 font-bold py-5 rounded-2xl hover:bg-slate-200 transition-all mt-6 block"
            >
              Try Registering Again
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
