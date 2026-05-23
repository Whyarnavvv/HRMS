import { createContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user')));
  const [authReady, setAuthReady] = useState(false);
  const navigate = useNavigate();
  const refreshAttempted = useRef(false);

  // On mount: silently try to refresh the access token so existing sessions survive page reloads
  useEffect(() => {
    if (refreshAttempted.current) return;
    refreshAttempted.current = true;

    const storedUser = JSON.parse(localStorage.getItem('user'));
    if (!storedUser) {
      setAuthReady(true);
      return;
    }

    api.post('/auth/refresh-token')
      .then(() => {
        setUser(storedUser);
      })
      .catch(() => {
        // Refresh token also expired — clear session
        setUser(null);
        localStorage.removeItem('user');
      })
      .finally(() => setAuthReady(true));
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setUser(data);
      localStorage.setItem('user', JSON.stringify(data));
      
      // Smart Navigation
      if (data.kycStatus === 'Incomplete' || data.kycStatus === 'Rejected') {
         navigate('/kyc-submission');
      } else if (data.kycStatus === 'Pending') {
         navigate('/verification-pending');
      } else if (['Admin', 'HR', 'Manager', 'AGM', 'SuperAdmin'].includes(data.role)) {
         navigate('/admin');
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
      setUser(data);
      localStorage.setItem('user', JSON.stringify(data));
      navigate('/employee');
    } catch (error) {
      throw error.response?.data?.message || 'Registration failed';
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    }
    setUser(null);
    localStorage.removeItem('user');
    navigate('/');
  };

  // Don't render children until we know auth state (prevents flash-redirect to login)
  if (!authReady) return null;

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

