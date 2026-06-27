import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { authApi } from '../../services/api';
import toast from 'react-hot-toast';

const IDLE_MS = 5 * 60 * 1000; // sign out after 5 minutes idle

export default function SessionTimeout() {
  const navigate = useNavigate();
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const logout = useAuthStore.getState().logout;

    const doLogout = async () => {
      clearTimeout(timer.current);
      try { await authApi.logout(); } catch { /* ignore */ }
      logout();
      navigate('/login', { replace: true });
      toast('Signed out due to inactivity', { icon: '🔒' });
    };

    const reset = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(doLogout, IDLE_MS);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => { events.forEach(e => window.removeEventListener(e, reset)); clearTimeout(timer.current); };
  }, [navigate]);

  return null;
}
