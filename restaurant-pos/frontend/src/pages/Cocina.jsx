import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useInactividad } from '../hooks/useInactividad';
import { API_URL } from '../utils/api';
import Sidebar from '../components/Sidebar';
import { useToast } from '../context/ToastContext';
import useSocket from '../hooks/useSocket';
import { Clock, Flame, CheckCircle2, ChefHat, Loader2 } from 'lucide-react';

function Cocina() {
  const [usuario, setUsuario] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sondeoActivo, setSondeoActivo] = useState(true);
  const [recetaModal, setRecetaModal] = useState(null);
  const [recetaData, setRecetaData] = useState([]);
  const [cargandoReceta, setCargandoReceta] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToast();
  const audioRef = useRef(null);
  useInactividad(300000, () => navigate('/login'));

  useEffect(() => {
    const u = localStorage.getItem('usuario');
    if (!u) { navigate('/login'); return; }
    const user = JSON.parse(u);
    if (!['Admin', 'Cocinero'].includes(user.rol)) { navigate('/dashboard'); return; }
    setUsuario(user);
  }, [navigate]);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const cargarPedidos = async () => {
    try {
      const res = await axios.get(`${API_URL}/pedidos`, {
        params: { estado: ['recibido', 'en_preparacion', 'listo'].join(',') },
        headers,
      });
      setPedidos(res.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!usuario) return;
    cargarPedidos();
    const interval = setInterval(cargarPedidos, 15000);
    return () => clearInterval(interval);
  }, [usuario]);

  useSocket({
    nuevo_pedido: (pedido) => {
      const timestamped = { ...pedido, _receivedAt: Date.now() };
      setPedidos(prev => [timestamped, ...prev]);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    },
    cambio_estado: ({ pedido_id, estado }) => {
      setPedidos(prev => prev.map(p => p.id === pedido_id ? { ...p, estado } : p));
    },
  });

  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      await axios.patch(`${API_URL}/pedidos/${id}/estado`, { estado: nuevoEstado }, { headers });
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado: nuevoEstado } : p));
      addToast('Estado actualizado', 'success');
    } catch {
      addToast('Error al cambiar estado', 'error');
    }
  };

  const tiempoTranscurrido = (creadoEn) => {
    const diff = Date.now() - new Date(creadoEn).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return '< 1 min';
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)}h ${min % 60}m`;
  };

  const verReceta = async (productoNombre, productoId) => {
    if (!productoId) return;
    setCargandoReceta(true);
    setRecetaModal(productoNombre);
    try {
      const res = await axios.get(`${API_URL}/recetas`, {
        params: { producto_id: productoId },
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecetaData(res.data || []);
    } catch {
      setRecetaData([]);
    } finally {
      setCargandoReceta(false);
    }
  };

  const cerrarReceta = () => {
    setRecetaModal(null);
    setRecetaData([]);
  };

  if (!usuario) return null;

  const pedidosPendientes = pedidos.filter(p => p.estado === 'recibido' || p.estado === 'pendiente');
  const pedidosEnPreparacion = pedidos.filter(p => p.estado === 'en_preparacion');
  const pedidosListos = pedidos.filter(p => p.estado === 'listo');

  return (
    <div className="dashboard-page">
      <Sidebar usuario={usuario} activeRoute="cocina" />

      <main className="main-content kitchen-page">
        <div className="kitchen-header">
          <div>
            <h2>Cocina</h2>
            <p>Pedidos en tiempo real — {pedidos.length} activo(s)</p>
          </div>
          <div className="kitchen-live">
            <span className={`kitchen-live-dot${sondeoActivo ? ' active' : ''}`} />
            <span className="kitchen-live-text">{sondeoActivo ? 'En vivo' : 'Sin conexión'}</span>
          </div>
        </div>

        <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f4B/f3+AgH9/f3+AgH+AgH9/f4CAf39/f4B/f3+AgH9/gH9/f3+AgH+AgH+AgH9/f39/gH9/f3+AgH9/gH9/f3+Af3+Af39/f39/gH9/f4B/f3+Af3+Af3+Af4B/f3+AgH9/f4B/f4B/f39/f3+Af38=" preload="auto" />

        {/* ── Modal Receta ── */}
        {recetaModal && (
          <div className="modal-overlay" onClick={cerrarReceta} role="dialog" aria-modal="true">
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <ChefHat size={20} style={{ color: 'var(--gold-light)' }} />
                <h3 className="modal-title">Receta: {recetaModal}</h3>
                <button className="modal-close-btn" onClick={cerrarReceta} aria-label="Cerrar">
                  <ChefHat size={18} />
                </button>
              </div>
              <div className="modal-body">
                {cargandoReceta ? (
                  <p className="loading-text"><Loader2 size={18} className="spin" /> Cargando receta...</p>
                ) : recetaData.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                    Este producto no tiene receta registrada
                  </p>
                ) : (
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Ingrediente</th>
                          <th>Cantidad</th>
                          <th>Unidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recetaData.map((r, i) => (
                          <tr key={r.id || i}>
                            <td>{r.ingredientes?.nombre || '—'}</td>
                            <td>{Number(r.cantidad)}</td>
                            <td style={{ color: 'var(--text-muted)' }}>{r.ingredientes?.unidad || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={cerrarReceta}>Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-text"><Loader2 size={20} className="spin" /> Cargando pedidos...</div>
        ) : (
          <div className="kitchen-board">
            <div className="kitchen-column">
              <div className="kitchen-column-header pending">
                <div className="kitchen-column-title">
                  <Clock size={18} /> Pendientes
                </div>
                <span className="kitchen-column-count">{pedidosPendientes.length}</span>
              </div>
              {pedidosPendientes.length === 0 && (
                <p className="kitchen-empty">Sin pedidos pendientes</p>
              )}
              <div className="kitchen-column-body">
                {pedidosPendientes.map(p => (
                  <PedidoCard
                    key={p.id} pedido={p} onEstado={cambiarEstado}
                    tiempoFn={tiempoTranscurrido} onVerReceta={verReceta}
                  />
                ))}
              </div>
            </div>

            <div className="kitchen-column">
              <div className="kitchen-column-header cooking">
                <div className="kitchen-column-title">
                  <Flame size={18} /> En Preparación
                </div>
                <span className="kitchen-column-count">{pedidosEnPreparacion.length}</span>
              </div>
              {pedidosEnPreparacion.length === 0 && (
                <p className="kitchen-empty">Sin pedidos en preparación</p>
              )}
              <div className="kitchen-column-body">
                {pedidosEnPreparacion.map(p => (
                  <PedidoCard
                    key={p.id} pedido={p} onEstado={cambiarEstado}
                    tiempoFn={tiempoTranscurrido} onVerReceta={verReceta}
                  />
                ))}
              </div>
            </div>

            <div className="kitchen-column">
              <div className="kitchen-column-header ready">
                <div className="kitchen-column-title">
                  <CheckCircle2 size={18} /> Listos
                </div>
                <span className="kitchen-column-count">{pedidosListos.length}</span>
              </div>
              {pedidosListos.length === 0 && (
                <p className="kitchen-empty">Sin pedidos listos</p>
              )}
              <div className="kitchen-column-body">
                {pedidosListos.map(p => (
                  <PedidoCard
                    key={p.id} pedido={p} onEstado={cambiarEstado}
                    tiempoFn={tiempoTranscurrido} onVerReceta={verReceta}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function PedidoCard({ pedido, onEstado, tiempoFn, onVerReceta }) {
  const isNew = ['recibido', 'pendiente'].includes(pedido.estado)
    && pedido._receivedAt
    && (Date.now() - pedido._receivedAt) <= 10000;

  const getProductoId = (item) => {
    if (item.tipo_item === 'producto' && item.producto_id) return item.producto_id;
    return null;
  };

  const mins = pedido.creado_en ? Math.floor((Date.now() - new Date(pedido.creado_en).getTime()) / 60000) : 0;
  const demorado = mins > 15;

  return (
    <div className={`kitchen-card kitchen-card--${pedido.estado}${isNew ? ' kitchen-card--new' : ''}`}>
      <div className="kitchen-card-header">
        <span className="kitchen-ticket">
          #{(pedido.numero_ticket || pedido.id).toString().padStart(4, '0')}
        </span>
        <span className={`kitchen-time${demorado ? ' kitchen-time--alert' : ''}`}>
          {tiempoFn(pedido.creado_en)}
        </span>
      </div>

      {demorado && (
        <span className="badge badge-danger" style={{ alignSelf: 'flex-start' }}>
          Demorado
        </span>
      )}

      {pedido.cliente_nombre && (
        <p className="kitchen-client">{pedido.cliente_nombre}</p>
      )}

      {pedido.notas && (
        <div style={{
          background: 'var(--caramel-dim)', borderRadius: '6px', padding: '8px 10px',
          marginBottom: '10px', fontSize: '13px', border: '1px solid rgba(212,163,115,0.25)'
        }}>
          <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--caramel)', marginBottom: '2px' }}>
            Notas del pedido
          </div>
          {pedido.notas}
        </div>
      )}

      <div className="kitchen-items">
        {(pedido.pedido_items || []).map((item, i) => (
          <div key={i} className="kitchen-item-row">
            <span className="kitchen-item-name">
              {item.cantidad}x {item.nombre}
            </span>
            {item.notas && <span className="kitchen-note">{item.notas}</span>}
            {onVerReceta && getProductoId(item) && (
              <button
                className="kitchen-recipe-btn"
                onClick={() => onVerReceta(item.nombre, getProductoId(item))}
                title="Ver receta"
              >
                <ChefHat size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="kitchen-actions">
        {(pedido.estado === 'recibido' || pedido.estado === 'pendiente') && (
          <button className="kitchen-btn kitchen-btn-start" onClick={() => onEstado(pedido.id, 'en_preparacion')}>
            Iniciar Preparación
          </button>
        )}
        {pedido.estado === 'en_preparacion' && (
          <button className="kitchen-btn kitchen-btn-ready" onClick={() => onEstado(pedido.id, 'listo')}>
            Marcar Listo
          </button>
        )}
        {pedido.estado === 'listo' && (
          <span className="badge badge-success" style={{ textAlign: 'center', display: 'block' }}>
            Listo para entregar
          </span>
        )}
      </div>
    </div>
  );
}

export default Cocina;
