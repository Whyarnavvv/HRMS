import { createContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user')));
  const navigate = useNavigate();

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
      navigate('/employee'); // Default for all new registrations
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

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

