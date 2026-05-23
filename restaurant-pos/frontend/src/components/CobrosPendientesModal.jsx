import { useState } from 'react';
import { Search, X, Loader2, DollarSign, Eye, Lock, Clock } from 'lucide-react';
import Pagination from './Pagination';
import BloqueoTimer from './BloqueoTimer';
import ModalDetalleCobro from './ModalDetalleCobro';

export default function CobrosPendientesModal({
  open,
  onClose,
  pedidosPorCobrar,
  cargandoCobros,
  totalCobros,
  paginaCobros,
  totalPaginasCobros,
  errorCobro,
  busquedaCobros,
  filtroMesaCobros,
  bloqueandoCobro,
  onSearchChange,
  onFilterMesaChange,
  onPageChange,
  onRefresh,
  onIniciarCobro,
  onLiberarBloqueo,
  procesandoPago,
  setProcesandoPago,
  usuario,
  esMioElBloqueo,
  tiempoDesdeCreado,
  estadoLabel,
  estadoBadgeClass,
}) {
  const [cobroSeleccionado, setCobroSeleccionado] = useState(null);

  const handleVerDetalle = (pedido) => {
    setCobroSeleccionado(pedido);
  };

  const cerrarDetalle = () => {
    setCobroSeleccionado(null);
    onRefresh();
  };

  const handlePagoExitoso = (data) => {
    setCobroSeleccionado(null);
    onRefresh();
  };

  if (!open) return null;

  return (
    <div className="cobros-modal-overlay" onClick={onClose}>
      <div className="cobros-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cobros-modal-header">
          <div className="cobros-modal-header-left">
            <h2 className="cobros-modal-title">Cobros Pendientes</h2>
            <span className="cobros-modal-count">{totalCobros}</span>
          </div>
          <button className="cobros-modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="cobros-modal-filters">
          <div className="cobros-modal-search">
            <Search size={16} className="cobros-modal-search-icon" />
            <input
              type="text"
              className="cobros-modal-search-input"
              placeholder="Buscar por ticket o cliente..."
              value={busquedaCobros}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <input
            type="number"
            className="cobros-modal-filter-mesa"
            placeholder="Mesa #"
            value={filtroMesaCobros}
            onChange={(e) => onFilterMesaChange(e.target.value)}
            min="0"
          />
        </div>

        {errorCobro && (
          <div className="cobros-modal-error">{errorCobro}</div>
        )}

        <div className="cobros-modal-body">
          {cargandoCobros && pedidosPorCobrar.length === 0 ? (
            <div className="cobros-modal-loading">
              <Loader2 size={20} className="btn-spinner" /> Cargando cobros...
            </div>
          ) : pedidosPorCobrar.length === 0 ? (
            <div className="cobros-modal-empty">
              <DollarSign size={24} />
              <span>No hay pedidos pendientes de cobro</span>
            </div>
          ) : (
            <div className="cobros-modal-list">
              {pedidosPorCobrar.map((p) => {
                const bloqueado = !!p.bloqueo_usuario_id;
                const miBloqueo = esMioElBloqueo(p);
                return (
                  <div
                    key={p.id}
                    className={`cobros-modal-card${bloqueado ? ' cobros-modal-card--locked' : ''}`}
                  >
                    <div className="cobros-modal-card-header">
                      <div className="cobros-modal-card-left">
                        <span className="cobros-modal-ticket">
                          #{String(p.numero_ticket || p.id).padStart(4, '0')}
                        </span>
                        <span className={`badge ${estadoBadgeClass[p.estado] || 'badge-warning'}`}>
                          {estadoLabel[p.estado] || p.estado}
                        </span>
                      </div>
                      <span className="cobros-modal-total">
                        ${Number(p.total_con_iva || p.total).toFixed(2)}
                      </span>
                    </div>

                    <div className="cobros-modal-card-body">
                      <div className="cobros-modal-card-meta">
                        {p.mesa_numero && (
                          <span className="cobros-modal-mesa">Mesa {p.mesa_numero}</span>
                        )}
                        {p.cliente_nombre && (
                          <span className="cobros-modal-cliente">{p.cliente_nombre}</span>
                        )}
                        {p.tipo && (
                          <span className="cobros-modal-tipo">{p.tipo.replace('_', ' ')}</span>
                        )}
                        <span className="cobros-modal-time">
                          <Clock size={12} /> {tiempoDesdeCreado(p.creado_en)}
                        </span>
                      </div>

                      {p.items_resumen && p.items_resumen.length > 0 && (
                        <div className="cobros-modal-items-resumen">
                          {p.items_resumen.map((item, i) => (
                            <span key={i} className="cobros-modal-item-tag">
                              {item.cantidad}x {item.nombre}
                              {item.notas && (
                                <span className="cobros-modal-item-nota">📝 {item.notas}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}

                      {p.notas && (
                        <div style={{
                          fontSize: '12px', color: 'var(--caramel)', marginTop: '6px',
                          background: 'var(--caramel-dim)', padding: '6px 10px', borderRadius: '6px',
                        }}>
                          📝 {p.notas}
                        </div>
                      )}
                    </div>

                    <div className="cobros-modal-card-actions">
                      {bloqueado ? (
                        <div className="cobros-modal-bloqueo-info">
                          <Lock size={14} />
                          <span>{p.bloqueado_por_nombre || 'Otro cajero'}</span>
                          {p.bloqueo_iniciado_en && (
                            <BloqueoTimer
                              iniciadoEn={p.bloqueo_iniciado_en}
                              timeoutMinutos={5}
                              esAdmin={usuario.rol === 'Admin'}
                              onLiberar={miBloqueo || usuario.rol === 'Admin' ? () => onLiberarBloqueo(p) : null}
                            />
                          )}
                        </div>
                      ) : (
                        <button
                          className="cobros-modal-btn-iniciar"
                          onClick={() => onIniciarCobro(p)}
                          disabled={bloqueandoCobro === p.id}
                        >
                          {bloqueandoCobro === p.id ? (
                            <Loader2 size={16} className="btn-spinner" />
                          ) : (
                            <DollarSign size={16} />
                          )}
                          Iniciar Cobro
                        </button>
                      )}

                      <button
                        className="cobros-modal-btn-ver"
                        onClick={() => handleVerDetalle(p)}
                      >
                        <Eye size={16} /> Ver
                      </button>

                      {miBloqueo && (
                        <button
                          className="cobros-modal-btn-pagar"
                          onClick={() => handleVerDetalle(p)}
                        >
                          <DollarSign size={16} /> Cobrar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="cobros-modal-footer">
          {totalPaginasCobros > 1 && (
            <Pagination
              currentPage={paginaCobros}
              totalPages={totalPaginasCobros}
              onPageChange={onPageChange}
            />
          )}
        </div>

        {cobroSeleccionado && (
          <ModalDetalleCobro
            pedido={cobroSeleccionado}
            onClose={cerrarDetalle}
            onPagoExitoso={handlePagoExitoso}
            procesandoPago={procesandoPago}
            setProcesandoPago={setProcesandoPago}
          />
        )}
      </div>
    </div>
  );
}
