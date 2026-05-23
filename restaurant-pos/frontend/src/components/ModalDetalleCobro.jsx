import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Loader2, Banknote, CreditCard, QrCode, Smartphone, Building2, Clock, History } from 'lucide-react';
import API from '../utils/api';
import { useToast } from '../context/ToastContext';

const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo', icon: Banknote },
  { value: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
  { value: 'qr', label: 'QR', icon: QrCode },
  { value: 'billetera_digital', label: 'Billetera', icon: Smartphone },
  { value: 'transferencia', label: 'Transferencia', icon: Building2 },
];

export default function ModalDetalleCobro({
  pedido,
  onClose,
  onPagoExitoso,
  procesandoPago,
  setProcesandoPago,
}) {
  const [tab, setTab] = useState('detalle');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [propina, setPropina] = useState(0);
  const [logEstados, setLogEstados] = useState([]);
  const [cargandoLog, setCargandoLog] = useState(false);
  const [errorPago, setErrorPago] = useState('');
  const { addToast } = useToast();

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

  const totalPagar = Number(pedido.total_con_iva || pedido.total || 0);
  const totalConPropina = totalPagar + propina;
  const cambio = Math.max(0, Number(montoRecibido || 0) - totalConPropina);

  useEffect(() => {
    if (tab === 'historial') {
      cargarLog();
    }
  }, [tab]);

  const cargarLog = async () => {
    setCargandoLog(true);
    try {
      const res = await axios.get(`${API}/api/caja/pedidos/${pedido.id}/log`, { headers });
      setLogEstados(res.data || []);
    } catch {
      setLogEstados([]);
    } finally {
      setCargandoLog(false);
    }
  };

  const handleConfirmarPago = async () => {
    setErrorPago('');

    if (metodoPago === 'efectivo' && Number(montoRecibido) < totalConPropina) {
      setErrorPago(`Monto insuficiente. Total: $${totalConPropina.toFixed(2)}, Recibido: $${Number(montoRecibido).toFixed(2)}`);
      return;
    }

    setProcesandoPago(true);
    try {
      const res = await axios.post(`${API}/pagos`, {
        pedido_id: pedido.id,
        metodo_pago: metodoPago,
        monto_recibido: metodoPago === 'efectivo' ? Number(montoRecibido) : totalConPropina,
        propina: propina || 0,
      }, { headers });

      addToast(`Pago registrado exitosamente`, 'success');
      if (onPagoExitoso) onPagoExitoso(res.data);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al procesar pago';
      setErrorPago(msg);
      addToast(msg, 'error');
    } finally {
      setProcesandoPago(false);
    }
  };

  if (!pedido) return null;

  const estadoLabel = {
    listo: 'Listo', entregado: 'Entregado',
    recibido: 'Recibido', en_preparacion: 'Preparación',
    pagado: 'Pagado', cancelado: 'Cancelado',
  };

  const estadoColor = {
    listo: 'badge-warning', entregado: 'badge-primary',
    pagado: 'badge-success', cancelado: 'badge-danger',
  };

  const tiempoDesde = (fecha) => {
    if (!fecha) return '';
    const segs = Math.floor((Date.now() - new Date(fecha).getTime()) / 1000);
    if (segs < 60) return `${segs}s`;
    if (segs < 3600) return `${Math.floor(segs / 60)}m`;
    return `${Math.floor(segs / 3600)}h ${Math.floor((segs % 3600) / 60)}m`;
  };

  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div className="cobros-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cobros-detail-header">
          <div>
            <h3 className="cobros-detail-title">
              Pedido #{String(pedido.numero_ticket || pedido.id).padStart(4, '0')}
            </h3>
            <p className="cobros-detail-subtitle">
              {pedido.cliente_nombre && `Cliente: ${pedido.cliente_nombre}`}
              {pedido.mesa_numero && ` — Mesa ${pedido.mesa_numero}`}
              {pedido.tipo && ` — ${pedido.tipo}`}
            </p>
          </div>
          <button className="pos-cart-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="cobros-detail-tabs">
          <button
            className={`cobros-detail-tab${tab === 'detalle' ? ' active' : ''}`}
            onClick={() => setTab('detalle')}
          >
            Detalle
          </button>
          <button
            className={`cobros-detail-tab${tab === 'historial' ? ' active' : ''}`}
            onClick={() => setTab('historial')}
          >
            <History size={14} /> Historial
          </button>
        </div>

        {tab === 'detalle' && (
          <div className="cobros-detail-body">
            <div className="cobros-detail-items">
              <h4 className="cobros-detail-section-title">Items</h4>
              {pedido.items_resumen?.map((item, i) => (
                <div key={item.id || i} className="cobros-detail-item">
                  <span className="cobros-detail-item-name">
                    {item.cantidad}x {item.nombre}
                  </span>
                  <span className="cobros-detail-item-price">
                    ${(Number(item.precio_unitario) * Number(item.cantidad)).toFixed(2)}
                  </span>
                </div>
              ))}
              {(!pedido.items_resumen || pedido.items_resumen.length === 0) && (
                <p className="cobros-detail-empty">Sin items</p>
              )}
            </div>

            <div className="cobros-detail-totals">
              <div className="cobros-detail-total-row">
                <span>Subtotal</span>
                <span>${Number(pedido.subtotal || 0).toFixed(2)}</span>
              </div>
              {Number(pedido.descuento) > 0 && (
                <div className="cobros-detail-total-row cobros-detail-total-row--discount">
                  <span>Descuento</span>
                  <span>-${Number(pedido.descuento).toFixed(2)}</span>
                </div>
              )}
              {Number(pedido.iva || 0) > 0 && (
                <div className="cobros-detail-total-row cobros-detail-total-row--muted">
                  <span>IVA 13%</span>
                  <span>${Number(pedido.iva).toFixed(2)}</span>
                </div>
              )}
              <div className="cobros-detail-total-row cobros-detail-total-row--total">
                <span>Total</span>
                <span>${totalPagar.toFixed(2)}</span>
              </div>
            </div>

            <div className="cobros-detail-pago">
              <h4 className="cobros-detail-section-title">Procesar Pago</h4>

              <label className="pos-label">Método de pago</label>
              <div className="cobros-detail-grid-pago">
                {METODOS_PAGO.map((m) => {
                  const IconComp = m.icon;
                  return (
                    <button
                      key={m.value}
                      className={`pos-selection-tile${metodoPago === m.value ? ' active' : ''}`}
                      onClick={() => { setMetodoPago(m.value); setMontoRecibido(''); }}
                    >
                      <IconComp size={18} /> {m.label}
                    </button>
                  );
                })}
              </div>

              <label className="pos-label">Propina</label>
              <div className="cobros-detail-grid-tips">
                {[0, 0.50, 1.00, 2.00, 5.00].map((tip) => (
                  <button
                    key={tip}
                    className={`pos-selection-tile${propina === tip ? ' active' : ''}`}
                    onClick={() => setPropina(tip)}
                  >
                    {tip === 0 ? 'Sin propina' : `$${tip.toFixed(2)}`}
                  </button>
                ))}
              </div>

              {metodoPago === 'efectivo' && (
                <>
                  <label className="pos-label">Monto recibido</label>
                  <input
                    type="number"
                    step="0.01"
                    min={totalConPropina}
                    value={montoRecibido}
                    onChange={(e) => setMontoRecibido(e.target.value)}
                    className="pos-input pos-input-amount"
                    placeholder="0.00"
                  />
                  {Number(montoRecibido || 0) >= totalConPropina && (
                    <div className="pos-cambio">
                      <span className="pos-cambio-label">Cambio: </span>
                      <span className="pos-cambio-value">${cambio.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}

              {errorPago && (
                <div className="cobros-detail-error">{errorPago}</div>
              )}

              <div className="cobros-detail-actions">
                <button className="pos-btn pos-btn-cancel" onClick={onClose}>
                  Cancelar
                </button>
                <div className="cobros-detail-total-label">
                  Total: <strong>${totalConPropina.toFixed(2)}</strong>
                  {propina > 0 && <span className="cobros-detail-tip-note">(incl. ${propina.toFixed(2)} propina)</span>}
                </div>
                <button
                  className="cobros-detail-btn-pay"
                  onClick={handleConfirmarPago}
                  disabled={procesandoPago}
                >
                  {procesandoPago ? (
                    <span className="btn-content">
                      <Loader2 size={18} className="btn-spinner" />
                      Procesando...
                    </span>
                  ) : 'Confirmar Pago'}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'historial' && (
          <div className="cobros-detail-body">
            <h4 className="cobros-detail-section-title">
              <Clock size={14} /> Historial de Cambios
            </h4>
            {cargandoLog ? (
              <p className="cobros-detail-empty">Cargando historial...</p>
            ) : logEstados.length === 0 ? (
              <p className="cobros-detail-empty">Sin historial disponible</p>
            ) : (
              <div className="cobros-timeline">
                {logEstados.map((log, i) => (
                  <div key={log.id || i} className="cobros-timeline-item">
                    <div className="cobros-timeline-dot" />
                    <div className="cobros-timeline-content">
                      <div className="cobros-timeline-states">
                        <span className={`badge ${estadoColor[log.estado_anterior] || 'badge-warning'}`}>
                          {estadoLabel[log.estado_anterior] || log.estado_anterior}
                        </span>
                        <span className="cobros-timeline-arrow">→</span>
                        <span className={`badge ${estadoColor[log.estado_nuevo] || 'badge-primary'}`}>
                          {estadoLabel[log.estado_nuevo] || log.estado_nuevo}
                        </span>
                      </div>
                      <div className="cobros-timeline-meta">
                        <span>{log.usuarios?.nombre || 'Sistema'}</span>
                        <span>{new Date(log.creado_en).toLocaleString('es-SV')}</span>
                        <span className="cobros-timeline-timeago">{tiempoDesde(log.creado_en)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="cobros-detail-footer">
          <span className={`badge ${estadoColor[pedido.estado] || 'badge-warning'}`}>
            {estadoLabel[pedido.estado] || pedido.estado}
          </span>
          <span className="cobros-detail-creado">
            Creado {tiempoDesde(pedido.creado_en)} atrás
          </span>
        </div>
      </div>
    </div>
  );
}
