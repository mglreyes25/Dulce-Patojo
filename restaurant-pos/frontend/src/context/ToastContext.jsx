/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let toastId = 0;

const ICON_MAP = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const MAX_TOASTS = 4;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.map(t =>
      t.id === id ? { ...t, exiting: true } : t
    ));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, []);

  const addToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => {
      let next = [...prev, { id, message, type, duration, exiting: false }];
      if (next.length > MAX_TOASTS) {
        next = next.slice(1);
      }
      return next;
    });
    const timer = setTimeout(() => {
      removeToast(id);
    }, duration);
    timersRef.current[id] = timer;
  }, [removeToast]);

  const handleClose = useCallback((id) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    removeToast(id);
  }, [removeToast]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, toasts, removeToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => {
          const IconComp = ICON_MAP[t.type] || Info;
          const iconColor = {
            success: 'var(--green)',
            error: 'var(--red)',
            warning: 'var(--amber)',
            info: 'var(--blue)',
          }[t.type] || 'var(--blue)';
          return (
            <div key={t.id} className={`toast toast-${t.type}${t.exiting ? ' exiting' : ''}`}>
              <div className="toast-content">
                <IconComp size={18} color={iconColor} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ flex: 1 }}>{t.message}</span>
                <button className="toast-close" onClick={() => handleClose(t.id)} aria-label="Cerrar">
                  <X size={14} />
                </button>
              </div>
              <div className="toast-progress">
                <div
                  className="toast-progress-bar"
                  style={{ animationDuration: `${t.duration}ms` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
}
