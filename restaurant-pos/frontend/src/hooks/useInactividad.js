import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const INACTIVIDAD_DEFAULT_MS = 30 * 60 * 1000; // 30 minutos

export function useInactividad(timeout = INACTIVIDAD_DEFAULT_MS, onTimeout) {
  const navigate = useNavigate();

  const cerrarSesion = useCallback(() => {
    if (onTimeout) {
      onTimeout();
    } else {
      localStorage.clear();
      navigate('/sesion-expirada');
    }
  }, [navigate, onTimeout]);

  useEffect(() => {
    let timer = setTimeout(cerrarSesion, timeout);

    const resetTimer = () => {
      clearTimeout(timer);
      localStorage.setItem('lastActivity', Date.now().toString());
      timer = setTimeout(cerrarSesion, timeout);
    };

    const eventos = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    eventos.forEach(e => window.addEventListener(e, resetTimer));

    return () => {
      clearTimeout(timer);
      eventos.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [cerrarSesion, timeout]);
}
