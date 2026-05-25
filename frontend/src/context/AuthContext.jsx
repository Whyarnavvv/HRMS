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
        navigate(userData.role === 'Manager' ? '/admin/manager-dashboard' : '/admin');
      } else {
        navigate('/employee');
      }
    } catch (error) {
      throw error.response?.data?.message || 'Login failed';
    }
  };

  const register = async (name, email, password) => {
    try {
      const { data } = await api.post('/auth/register', { name, email, password });
      const { accessToken, refreshToken, ...userData } = data;
      if (accessToken) {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
      }
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      navigate('/employee');
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

  if (!authReady) return null;

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
