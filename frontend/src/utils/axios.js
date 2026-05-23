import axios from 'axios';

const host = window.location.hostname;
const rawBaseUrl = import.meta.env.DEV ? `http://${host}:5000` : (import.meta.env.VITE_API_BASE_URL || `http://${host}:5000`);
const normalizedBaseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

const api = axios.create({
  baseURL: `${normalizedBaseUrl}/api`,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/login' && originalRequest.url !== '/auth/refresh-token') {
      originalRequest._retry = true;
      try {
        await axios.post(`${normalizedBaseUrl}/api/auth/refresh-token`, {}, { withCredentials: true });
        return api(originalRequest);
      } catch (err) {
        localStorage.removeItem('user');
        window.location.href = '/';
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
