import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, updateUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const revision = useRef(0);
  const setUser = useCallback(account => {
    revision.current += 1;
    updateUser(account);
    setError('');
    setLoading(false);
  }, []);
  const load = useCallback(async ({ throwOnError = false } = {}) => {
    const request = ++revision.current;
    setError('');
    setLoading(true);
    try {
      const account = await api('/auth/me');
      if (request === revision.current) updateUser(account);
      return account;
    } catch (err) {
      if (request === revision.current) {
        if (err.status === 401) updateUser(null);
        else setError(err.message);
      }
      if (throwOnError) throw err;
      return null;
    } finally {
      if (request === revision.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    const expire = () => setUser(null);
    window.addEventListener('session-expired', expire);
    return () => window.removeEventListener('session-expired', expire);
  }, [load, setUser]);
  const logout = async () => { await api('/auth/logout', { method: 'POST' }); setUser(null); };
  return <AuthContext.Provider value={{ user, setUser, loading, error, reload: load, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function RequireAuth({ children }) {
  const { user, loading, error, reload } = useAuth();
  const location = useLocation();
  if (loading) return <div className="page-loading"><span className="spinner" /> Đang kết nối…</div>;
  if (error) return <div className="page-loading"><p role="alert">{error}</p><button className="btn" onClick={() => reload()}>Thử lại</button></div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search + location.hash }} replace />;
  if (user.must_change_password && location.pathname !== '/change-password') return <Navigate to="/change-password" replace />;
  return children;
}

export function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (!user?.is_admin) return <Navigate to="/" replace />;
  return children;
}
