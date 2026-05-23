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
        <div className="dispatch-header">
          <div>
            <h2>🚀 Despacho</h2>
            <p>Pedidos listos para entregar — <strong style={{color:'#2ecc71'}}>{listos.length}</strong> pendiente(s)</p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'8px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'20px',padding:'6px 14px'}}>
            <span style={{width:'8px',height:'8px',borderRadius:'50%',background:'#2ecc71',boxShadow:'0 0 6px #2ecc71',display:'inline-block'}}/>
            <span style={{fontSize:'12px',fontWeight:600,color:'var(--text-muted)'}}>En vivo</span>
          </div>
        </div>

        {loading ? (
          <div className="loading-text" style={{paddingTop:'60px'}}>Cargando pedidos...</div>
        ) : (
          <div className="dispatch-body">
            <div className="dispatch-main">
              <h3 className="dispatch-section-title">
                Listos para entregar ({listos.length})
              </h3>
              {listos.length === 0 ? (
                <p className="dispatch-empty">✅ Sin pedidos pendientes de entrega</p>
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
                      {p.tipo && (
                        <div style={{fontSize:'11px',fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'var(--text-muted)'}}>
                          {p.tipo === 'en_mesa' ? `🍽️ Mesa ${p.mesa?.numero || ''}` : p.tipo === 'para_llevar' ? '🛍️ Para llevar' : p.tipo === 'domicilio' ? '🚴 Domicilio' : '🏃 Para recoger'}
                        </div>
                      )}

                      {/* Notas adicionales del pedido */}
                      {p.notas && (
                        <div style={{
                          background: 'var(--caramel-dim)', borderRadius: '6px', padding: '8px 10px',
                          marginTop: '8px', fontSize: '13px', border: '1px solid rgba(212,163,115,0.25)'
                        }}>
                          <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--caramel)', marginBottom: '2px' }}>
                            📝 Notas del pedido
                          </div>
                          {p.notas}
                        </div>
                      )}

                      <div className="dispatch-items">
                        {(p.pedido_items || []).map((item, i) => (
                          <div key={i} className="dispatch-item">
                            <span style={{color:'var(--gold-light)',fontWeight:700,minWidth:'24px'}}>{item.cantidad}x</span>
                            <span style={{flex:1}}>{item.nombre}</span>
                            {item.notas && (
                              <span style={{
                                fontSize:'11px', color:'#f1c40f', background:'rgba(231,76,60,0.15)',
                                padding:'2px 8px', borderRadius:'6px', border:'1px solid rgba(231,76,60,0.3)',
                                whiteSpace:'nowrap'
                              }}>
                                📝 {item.notas}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <button className="dispatch-btn" onClick={() => entregar(p.id)}>
                        ✓ Marcar Entregado
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <aside className="dispatch-aside">
              <h3 className="dispatch-section-title" style={{color:'var(--text-muted)'}}>
                Entregados hoy ({entregados.length})
              </h3>
              {entregados.length === 0 ? (
                <p style={{color:'var(--text-dim)',fontSize:'13px',textAlign:'center',padding:'20px 0'}}>Sin entregas aún</p>
              ) : (
                <div className="dispatch-recent">
                  {entregados.slice(0, 20).map(p => (
                    <div key={p.id} className="dispatch-recent-row">
                      <div>
                        <span className="dispatch-recent-ticket">#{(p.numero_ticket || p.id).toString().padStart(4,'0')}</span>
                        {p.cliente_nombre && <div style={{fontSize:'11px',color:'var(--text-dim)',marginTop:'2px'}}>{p.cliente_nombre}</div>}
                      </div>
                      <div style={{textAlign:'right'}}>
                        <span className="dispatch-recent-time">
                          {new Date(p.actualizado_en || p.creado_en).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div style={{fontSize:'10px',color:'#2ecc71',marginTop:'2px'}}>✓ Entregado</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

export default Despacho;