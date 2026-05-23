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

      <main className="main-content dispatch-page">
        <div className="page-header dispatch-header">
          <div>
            <h2>Despacho</h2>
            <p>Pedidos listos para entregar — {listos.length} pendiente(s)</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-text">Cargando pedidos...</div>
        ) : (
          <>
            <h3 className="dispatch-section-title">
              Listos para entregar ({listos.length})
            </h3>
            {listos.length === 0 ? (
              <p className="dispatch-empty">No hay pedidos listos</p>
            ) : (
              <div className="dispatch-grid">
                {listos.map(p => (
                  <div key={p.id} className="dispatch-card">
                    <div className="dispatch-card-header">
                      <span className="dispatch-ticket">
                        #{(p.numero_ticket || p.id).toString().padStart(4, '0')}
                      </span>
                      {p.cliente_nombre && (
                        <span className="dispatch-client">{p.cliente_nombre}</span>
                      )}
                    </div>
                    <div className="dispatch-items">
                      {(p.pedido_items || []).map((item, i) => (
                        <div key={i} className="dispatch-item">
                          {item.cantidad}x {item.nombre}
                        </div>
                      ))}
                    </div>
                    <button className="dispatch-btn" onClick={() => entregar(p.id)}>
                      Entregado
                    </button>
                  </div>
                ))}
              </div>
            )}

            {entregados.length > 0 && (
              <>
                <h3 className="dispatch-section-subtitle">
                  Entregados recientes ({entregados.length})
                </h3>
                <div className="dispatch-recent">
                  {entregados.slice(0, 10).map(p => (
                    <div key={p.id} className="dispatch-recent-row">
                      <span className="dispatch-recent-ticket">#{p.numero_ticket || p.id}</span>
                      <span className="dispatch-recent-time">
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
