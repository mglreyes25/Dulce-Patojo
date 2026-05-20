export default function ConfirmModal({ open, title, message, onConfirm, onCancel, confirmText, cancelText, danger }) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <h3 style={{
          fontFamily: "'Playfair Display', serif", fontSize: 20,
          color: 'var(--text)', margin: 0, marginBottom: 16,
          borderBottom: '1px solid var(--border)', paddingBottom: 12,
        }}>
          {title || 'Confirmar'}
        </h3>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            className="btn"
            style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            onClick={onCancel}
          >
            {cancelText || 'Cancelar'}
          </button>
          <button
            className="btn"
            style={{
              background: danger ? 'var(--red)' : 'var(--gold)',
              color: danger ? '#fff' : '#0f0d0a',
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
