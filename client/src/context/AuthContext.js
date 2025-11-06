// client/src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from './api';

const AuthContext = createContext();

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const getToken = () => localStorage.getItem('authToken');

  const setToken = (token) => {
    if (token) {
      localStorage.setItem('authToken', token);
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      localStorage.removeItem('authToken');
      delete api.defaults.headers.common.Authorization;
    }
  };

  const isAuthenticated = !!user;

  const refreshUser = async () => {
    try {
      const { data } = await api.get('/api/users/profile');
      if (data?.user) {
        setUser(data.user);
        return data.user;
      }
    } catch (_) {}
    return null;
  };

  const login = async (email, password) => {
    try {
      setError('');
      setLoading(true);

      const { data } = await api.post('/api/auth/login', { email, password });
      const token = data?.accessToken || data?.token;
      setToken(token);

      await refreshUser();

      return { success: true };
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Login failed';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  const register = async (username, email, password) => {
    try {
      setError('');
      setLoading(true);

      const { data } = await api.post('/api/auth/register', {
        username,
        email,
        password,
      });
      const token = data?.accessToken || data?.token;
      setToken(token);

      await refreshUser();

      return { success: true };
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Registration failed';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (_) {}
    setToken(null);
    setUser(null);
  };

  const validateToken = async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    setToken(token);

    try {
      await api.get('/api/auth/validate').catch(() => {});
      await refreshUser(); 
    } catch (_) {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    validateToken();
  }, []);

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err?.response?.status === 401) logout();
        return Promise.reject(err);
      }
    );
    return () => api.interceptors.response.eject(interceptor);
  }, []);

  const value = {
    user,
    loading,
    error,
    isAuthenticated,
    login,
    register,
    logout,
    refreshUser,
    setError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
