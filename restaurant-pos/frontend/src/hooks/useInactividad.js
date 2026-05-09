import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const INACTIVIDAD_MS = 30 * 60 * 1000; // 30 minutos

export function useInactividad() {
  const navigate = useNavigate();

  const cerrarSesion = useCallback(() => {
    localStorage.clear();
    navigate('/login');
  }, [navigate]);

  useEffect(() => {
    let timer = setTimeout(cerrarSesion, INACTIVIDAD_MS);

    const resetTimer = () => {
      clearTimeout(timer);
      localStorage.setItem('lastActivity', Date.now().toString());
      timer = setTimeout(cerrarSesion, INACTIVIDAD_MS);
    };

    const eventos = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    eventos.forEach(e => window.addEventListener(e, resetTimer));

    return () => {
      clearTimeout(timer);
      eventos.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [cerrarSesion]);
}
