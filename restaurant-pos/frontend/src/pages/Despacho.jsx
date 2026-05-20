import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useInactividad } from '../hooks/useInactividad';
import { API_URL, SOCKET_URL } from '../utils/api';
import Sidebar from '../components/Sidebar';
import { useToast } from '../context/ToastContext';

function Despacho() {
  const [usuario, setUsuario] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { addToast } = useToast();
  useInactividad(300000, () => navigate('/login'));

  useEffect(() => {
    const u = localStorage.getItem('usuario');
    if (!u) { navigate('/login'); return; }
    const user = JSON.parse(u);
    if (!['Admin', 'Despachador'].includes(user.rol)) { navigate('/dashboard'); return; }
    setUsuario(user);
  }, [navigate]);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const cargarPedidos = async () => {
    try {
      const res = await axios.get(`${API_URL}/pedidos`, {
        params: { estado: 'listo,entregado' },
        headers,
      });
      setPedidos(res.data || []);
    } catch {
      // Error silencioso
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
    socket.emit('join', 'Despachador');

    socket.on('pedido_listo', (pedido) => {
      setPedidos(prev => [pedido, ...prev]);
      addToast(`Pedido #${pedido.numero_ticket} listo para entregar`, 'success');
    });

    socket.on('cambio_estado', ({ pedido_id, estado }) => {
      setPedidos(prev => prev.map(p => p.id === pedido_id ? { ...p, estado } : p));
    });

    return () => socket.close();
  }, [usuario]);

  const entregar = async (id) => {
    try {
      await axios.patch(`${API_URL}/pedidos/${id}/estado`, { estado: 'entregado' }, { headers });
      addToast('Pedido marcado como entregado', 'success');
    } catch {
      addToast('Error al entregar pedido', 'error');
    }
  };

  if (!usuario) return null;

  const listos = pedidos.filter(p => p.estado === 'listo');
  const entregados = pedidos.filter(p => p.estado === 'entregado');

  return (
    <div className="dashboard-page">
      <Sidebar usuario={usuario} activeRoute="despacho" />

      <main className="main-content" style={{ padding: '24px 28px' }}>
        <div className="page-header" style={{ marginBottom: 24 }}>
          <div>
            <h2>🚀 Despacho</h2>
            <p>Pedidos listos para entregar — {listos.length} pendiente(s)</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-text">Cargando pedidos...</div>
        ) : (
          <>
            <h3 style={{ fontSize: 14, color: '#27ae60', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
              ✅ Listos para entregar ({listos.length})
            </h3>
            {listos.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>No hay pedidos listos</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 32 }}>
                {listos.map(p => (
                  <div key={p.id} style={{
                    background: 'var(--bg2)', border: '1px solid rgba(39,174,96,0.3)',
                    borderRadius: 12, padding: 24, borderLeft: '4px solid #27ae60',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: 'var(--gold-light)' }}>
                        #{(p.numero_ticket || p.id).toString().padStart(4, '0')}
                      </span>
                      {p.cliente_nombre && (
                        <span style={{ fontSize: 13, color: 'var(--caramel)' }}>🧑 {p.cliente_nombre}</span>
                      )}
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 16 }}>
                      {(p.pedido_items || []).map((item, i) => (
                        <div key={i} style={{ padding: '2px 0', fontSize: 13, color: 'var(--text)' }}>
                          {item.cantidad}x {item.nombre}
                        </div>
                      ))}
                    </div>
                    <button className="btn" style={{ width: '100%', background: '#27ae60', color: '#fff' }}
                      onClick={() => entregar(p.id)}>
                      🚚 Entregado
                    </button>
                  </div>
                ))}
              </div>
            )}

            {entregados.length > 0 && (
              <>
                <h3 style={{ fontSize: 14, color: '#8a8070', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                  📋 Entregados recientes ({entregados.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {entregados.slice(0, 10).map(p => (
                    <div key={p.id} style={{
                      background: 'var(--bg2)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between',
                      opacity: 0.6,
                    }}>
                      <span style={{ fontWeight: 600 }}>#{p.numero_ticket || p.id}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {new Date(p.actualizado_en || p.creado_en).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default Despacho;
