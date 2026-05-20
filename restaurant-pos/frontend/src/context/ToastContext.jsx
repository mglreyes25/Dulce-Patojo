/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, toasts, removeToast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360,
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '12px 16px', borderRadius: 8, fontSize: 13,
            fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
            background: t.type === 'success' ? 'rgba(39,174,96,0.95)' :
                        t.type === 'error' ? 'rgba(192,57,43,0.95)' :
                        t.type === 'warning' ? 'rgba(212,163,115,0.95)' :
                        'rgba(42,38,31,0.95)',
            color: t.type === 'warning' ? '#0f0d0a' : '#f0ead8',
            border: `1px solid ${
              t.type === 'success' ? 'rgba(39,174,96,0.3)' :
              t.type === 'error' ? 'rgba(192,57,43,0.3)' :
              t.type === 'warning' ? 'rgba(212,163,115,0.3)' :
              'rgba(58,53,40,0.3)'
            }`,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            animation: 'slideInRight 0.25s ease-out',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }} onClick={() => removeToast(t.id)}>
            <span style={{ fontSize: 16 }}>
              {t.type === 'success' ? '✓' : t.type === 'error' ? '✗' : t.type === 'warning' ? '⚠' : 'ℹ'}
            </span>
            {t.message}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
}
