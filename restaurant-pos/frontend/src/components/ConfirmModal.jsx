import { useEffect, useRef } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

const TYPE_CONFIG = {
  danger: {
    icon: AlertTriangle,
    iconColor: 'var(--red)',
    headerBg: 'var(--red-bg)',
    confirmBg: 'var(--red)',
    confirmColor: '#fff',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'var(--amber)',
    headerBg: 'var(--amber-bg)',
    confirmBg: 'var(--amber)',
    confirmColor: '#0f0d0a',
  },
  info: {
    icon: Info,
    iconColor: 'var(--blue)',
    headerBg: 'var(--blue-bg)',
    confirmBg: 'var(--blue)',
    confirmColor: '#fff',
  },
  default: {
    icon: null,
    iconColor: null,
    headerBg: null,
    confirmBg: 'var(--gold)',
    confirmColor: '#0f0d0a',
  },
};

export default function ConfirmModal({
  open, title, message, onConfirm, onCancel,
  confirmText, cancelText, type, danger,
}) {
  const resolvedType = type || (danger ? 'danger' : 'default');
  const cancelRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => cancelRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Tab') {
        const focusable = cancelRef.current?.parentElement?.querySelectorAll('button');
        if (focusable && focusable.length > 0) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  const config = TYPE_CONFIG[resolvedType] || TYPE_CONFIG.default;
  const IconComp = config.icon;

  return (
    <div
      className="modal-overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div
          className="modal-header"
          style={config.headerBg ? { background: config.headerBg, borderBottom: '1px solid var(--border)', borderRadius: '14px 14px 0 0' } : undefined}
        >
          {IconComp && (
            <div className="modal-header-icon" style={config.headerBg ? { background: config.headerBg } : undefined}>
              <IconComp size={20} color={config.iconColor} />
            </div>
          )}
          <h3 id="modal-title">{title || 'Confirmar'}</h3>
          <button className="modal-close-btn" onClick={onCancel} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            {message}
          </p>
        </div>
        <div className="modal-footer">
          <button
            ref={cancelRef}
            className="btn"
            style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            onClick={onCancel}
          >
            {cancelText || 'Cancelar'}
          </button>
          <button
            className="btn"
            style={{
              background: config.confirmBg,
              color: config.confirmColor,
            }}
            onClick={onConfirm}
          >
            {confirmText || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
