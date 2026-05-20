import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useInactividad } from '../hooks/useInactividad';
import { API_URL, SOCKET_URL } from '../utils/api';
import Sidebar from '../components/Sidebar';
import { useToast } from '../context/ToastContext';

const ESTADOS = {
  pendiente:      { label: 'Pendiente',     color: '#f1c40f', icon: '⏳' },
  recibido:       { label: 'Recibido',      color: '#3498db', icon: '📥' },
  en_preparacion: { label: 'En Preparación', color: '#e67e22', icon: '👨‍🍳' },
  listo:          { label: 'Listo',          color: '#27ae60', icon: '✅' },
  entregado:      { label: 'Entregado',      color: '#8a8070', icon: '🚚' },
};

function Cocina() {
  const [usuario, setUsuario] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sondeoActivo, setSondeoActivo] = useState(true);
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
      // Error silencioso para polling
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!usuario) return;
    cargarPedidos();
    const interval = setInterval(cargarPedidos, 8000);
    return () => clearInterval(interval);
  }, [usuario]);

  useEffect(() => {
    if (!usuario) return;
    const socket = io(SOCKET_URL);
    socket.emit('join', 'Cocinero');

    socket.on('nuevo_pedido', (pedido) => {
      setPedidos(prev => [pedido, ...prev]);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    });

    socket.on('cambio_estado', ({ pedido_id, estado }) => {
      setPedidos(prev => prev.map(p => p.id === pedido_id ? { ...p, estado } : p));
    });

    return () => socket.close();
  }, [usuario]);

  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      await axios.patch(`${API_URL}/pedidos/${id}/estado`, { estado: nuevoEstado }, { headers });
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado: nuevoEstado } : p));
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

  if (!usuario) return null;

  const pedidosPendientes = pedidos.filter(p => p.estado === 'recibido' || p.estado === 'pendiente');
  const pedidosEnPreparacion = pedidos.filter(p => p.estado === 'en_preparacion');
  const pedidosListos = pedidos.filter(p => p.estado === 'listo');

  return (
    <div className="dashboard-page">
      <Sidebar usuario={usuario} activeRoute="cocina" />

      <main className="main-content" style={{ padding: '24px 28px' }}>
        <div className="page-header" style={{ marginBottom: 24 }}>
          <div>
            <h2>👨‍🍳 Cocina</h2>
            <p>Pedidos en tiempo real — {pedidos.length} activo(s)</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {sondeoActivo ? '🟢 En vivo' : '🔴 Sin conexión'}
            </span>
          </div>
        </div>

        <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f4B/f3+AgH9/f3+AgH+AgH9/f4CAf39/f4B/f3+AgH9/gH9/f3+AgH+AgH+AgH9/f39/gH9/f3+AgH9/gH9/f3+Af3+Af39/f39/gH9/f4B/f3+Af3+Af3+Af4B/f3+AgH9/f4B/f4B/f39/f3+Af38=" preload="auto" />

        {loading ? (
          <div className="loading-text">Cargando pedidos...</div>
        ) : (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {/* Columna: Pendientes */}
            <div style={{ flex: 1, minWidth: 300 }}>
              <h3 style={{ fontSize: 14, color: '#f1c40f', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                ⏳ Pendientes ({pedidosPendientes.length})
              </h3>
              {pedidosPendientes.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>Sin pedidos pendientes</p>
              )}
              {pedidosPendientes.map(p => (
                <PedidoCard key={p.id} pedido={p} onEstado={cambiarEstado} tiempoFn={tiempoTranscurrido} />
              ))}
            </div>

            {/* Columna: En Preparación */}
            <div style={{ flex: 1, minWidth: 300 }}>
              <h3 style={{ fontSize: 14, color: '#e67e22', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                🔥 En Preparación ({pedidosEnPreparacion.length})
              </h3>
              {pedidosEnPreparacion.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>Sin pedidos en preparación</p>
              )}
              {pedidosEnPreparacion.map(p => (
                <PedidoCard key={p.id} pedido={p} onEstado={cambiarEstado} tiempoFn={tiempoTranscurrido} />
              ))}
            </div>

            {/* Columna: Listos */}
            <div style={{ flex: 1, minWidth: 300 }}>
              <h3 style={{ fontSize: 14, color: '#27ae60', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                ✅ Listos ({pedidosListos.length})
              </h3>
              {pedidosListos.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>Sin pedidos listos</p>
              )}
              {pedidosListos.map(p => (
                <PedidoCard key={p.id} pedido={p} onEstado={cambiarEstado} tiempoFn={tiempoTranscurrido} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function PedidoCard({ pedido, onEstado, tiempoFn }) {
  const info = ESTADOS[pedido.estado] || ESTADOS.pendiente;

  return (
    <div style={{
      background: 'var(--bg2)', border: `1px solid ${info.color}44`,
      borderRadius: 12, padding: 20, marginBottom: 12,
      borderLeft: `4px solid ${info.color}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: 'var(--gold-light)' }}>
          #{(pedido.numero_ticket || pedido.id).toString().padStart(4, '0')}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {tiempoFn(pedido.creado_en)}
        </span>
      </div>

      {pedido.cliente_nombre && (
        <p style={{ fontSize: 12, color: 'var(--caramel)', marginBottom: 8 }}>🧑 {pedido.cliente_nombre}</p>
      )}

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 12 }}>
        {(pedido.pedido_items || []).map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 13 }}>
            <span style={{ color: 'var(--text)' }}>
              {item.cantidad}x {item.nombre}
            </span>
            {item.notas && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>📝 {item.notas}</span>}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {(pedido.estado === 'recibido' || pedido.estado === 'pendiente') && (
          <button className="btn-small" style={{ background: 'rgba(230,126,34,0.2)', color: '#e67e22', border: '1px solid rgba(230,126,34,0.3)' }}
            onClick={() => onEstado(pedido.id, 'en_preparacion')}>
            🔥 Iniciar
          </button>
        )}
        {pedido.estado === 'en_preparacion' && (
          <button className="btn-small btn-success" onClick={() => onEstado(pedido.id, 'listo')}>
            ✅ Marcar Listo
          </button>
        )}
        {pedido.estado === 'listo' && (
          <span className="badge badge-success">Listo para entregar</span>
        )}
      </div>
    </div>
  );
}

export default Cocina;
