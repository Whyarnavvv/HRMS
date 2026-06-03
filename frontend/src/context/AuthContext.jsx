import { createContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axios';
import { baseURL } from '../utils/axios';
import axios from 'axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user')));
  const [authReady, setAuthReady] = useState(false);
  const navigate = useNavigate();
  const refreshAttempted = useRef(false);

  // On mount: silently refresh tokens so sessions survive page reloads
  useEffect(() => {
    if (refreshAttempted.current) return;
    refreshAttempted.current = true;

    const storedUser = JSON.parse(localStorage.getItem('user'));
    const storedRefreshToken = localStorage.getItem('refreshToken');

    if (!storedUser || !storedRefreshToken) {
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setAuthReady(true);
      return;
    }

    axios.post(`${baseURL}/api/auth/refresh-token`, { refreshToken: storedRefreshToken })
      .then(({ data }) => {
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        setUser(storedUser);
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      })
      .finally(() => setAuthReady(true));
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      const { accessToken, refreshToken, ...userData } = data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      if (userData.kycStatus === 'Incomplete' || userData.kycStatus === 'Rejected') {
        navigate('/kyc-submission');
      } else if (userData.kycStatus === 'Pending') {
        navigate('/verification-pending');
      } else if (['Admin', 'HR', 'Manager', 'AGM', 'SuperAdmin'].includes(userData.role)) {
        navigate('/admin');
      } else {
        navigate('/employee');
      }
    } catch (error) {
      throw error.response?.data?.message || 'Login failed';
    }
  };

  const register = async (name, email) => {
    try {
      // Register only sends name+email — backend initiates the email verification flow
      // No tokens are returned at this stage; user must verify email first
      await api.post('/auth/register', { name, email });
      // Don't set user or navigate — the Register page handles the success state
    } catch (error) {
      throw error.response?.data?.message || 'Registration failed';
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await api.post('/auth/logout', { refreshToken });
    } catch (err) {
      console.error('Logout error:', err);
    }
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/');
  };

  if (!authReady) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading...</p>
      </div>
    </div>
  );

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
