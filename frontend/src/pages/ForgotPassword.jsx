import React, { useState } from 'react';
import api from '../utils/axios';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await api.post('/auth/forgot-password', { email });
      setIsSent(true);
      setMessage('If an account matches that email, a password reset link has been sent.');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Ornaments */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-b-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400/20 rounded-t-full blur-3xl -z-10" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <span className="text-3xl font-bold text-white">SP</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          Forgot Password
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 max-w">
          Enter your email and we'll send you a link to reset your password.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/80 backdrop-blur-xl py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-slate-100 relative">
          
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {isSent ? (
            <div className="text-center py-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">Check your inbox</h3>
              <p className="text-sm text-slate-500 mb-6">
                {message}
              </p>
              <Link
                to="/"
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
              >
                Return to log in
              </Link>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                  Email Address
                </label>
                <div className="mt-2 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white/50 backdrop-blur-sm transition-all duration-200"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    <>
                      Send Reset Link
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center mt-4">
                <Link to="/" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                  Back to login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
      
      {/* Footer decorative */}
      <div className="mt-auto pb-8 flex justify-center">
        <p className="text-sm text-slate-400">© 2026 Study Palace Hub. All rights reserved.</p>
      </div>
    </div>
  );
}
