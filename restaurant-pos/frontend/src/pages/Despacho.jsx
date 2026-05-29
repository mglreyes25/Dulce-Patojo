import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useInactividad } from '../hooks/useInactividad';
import { API_URL } from '../utils/api';
import Sidebar from '../components/Sidebar';
import { useToast } from '../context/ToastContext';
import useSocket from '../hooks/useSocket';
import { X, Printer, Download, Receipt, Loader2 } from 'lucide-react';

function Despacho() {
  const [usuario, setUsuario] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ticketModal, setTicketModal] = useState(null);
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
    pedido_listo: (pedido) => {
      setPedidos(prev => [pedido, ...prev]);
      addToast(`Pedido #${pedido.numero_ticket} listo para entregar`, 'success');
    },
    cambio_estado: ({ pedido_id, estado }) => {
      setPedidos(prev => prev.map(p => p.id === pedido_id ? { ...p, estado } : p));
    },
  });

  const entregar = async (id) => {
    try {
      await axios.patch(`${API_URL}/pedidos/${id}/estado`, { estado: 'entregado' }, { headers });
      addToast('Pedido marcado como entregado', 'success');
    } catch {
      addToast('Error al entregar pedido', 'error');
    }
  };

  const generarTicketHTML = (pedido) => {
    const tipoLabel = { en_mesa: 'En Mesa', para_llevar: 'Para Llevar', para_recoger: 'Para Recoger', domicilio: 'Domicilio' };
    const total = Number(pedido.total_con_iva || pedido.total);
    const itemsHtml = (pedido.pedido_items || []).map(item =>
      `<tr><td style="text-align:left">${item.cantidad}x ${item.nombre}</td><td style="text-align:right">$${Number(item.precio_unitario * item.cantidad).toFixed(2)}</td></tr>`
    ).join('');
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Ticket #${pedido.numero_ticket}</title>
<style>
  @page { margin: 0; size: 80mm auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', Courier, monospace; width: 80mm; margin: 0 auto; padding: 8px; background: #fff; color: #000; font-size: 11px; line-height: 1.3; }
  .header { text-align: center; margin-bottom: 10px; }
  .header h1 { font-size: 18px; font-weight: 800; margin-bottom: 2px; }
  .header p { font-size: 10px; color: #666; margin: 1px 0; }
  .divider { border-top: 1px dashed #999; margin: 8px 0; }
  .ticket-no { font-size: 28px; font-weight: 800; text-align: center; letter-spacing: 2px; margin: 4px 0; }
  .date { text-align: center; font-size: 10px; color: #666; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { padding: 2px 0; }
  .totals { margin-top: 8px; }
  .totals tr:last-child td { border-top: 1px solid #000; font-weight: 800; font-size: 14px; padding-top: 4px; }
  .totals td:last-child { text-align: right; }
  .footer { text-align: center; margin-top: 10px; padding-top: 8px; border-top: 1px dashed #999; font-size: 10px; color: #999; }
  .footer p { margin: 2px 0; }
  @media print { body { padding: 4px; } }
</style></head>
<body>
  <div class="header"><h1>Dulce Patojo</h1><p>Sistema POS — Ticket de Venta</p></div>
  <div class="divider"></div>
  <div class="ticket-no">#${String(pedido.numero_ticket).padStart(3, '0')}</div>
  <div class="date">${new Date(pedido.creado_en).toLocaleString('es-SV')}</div>
  <div class="divider"></div>
  <table><thead><tr><th style="text-align:left">Item</th><th style="text-align:right">Total</th></tr></thead><tbody>${itemsHtml}</tbody></table>
  <div class="divider"></div>
  <table class="totals">
    <tr><td>Subtotal</td><td>$${Number(pedido.subtotal).toFixed(2)}</td></tr>
    ${Number(pedido.descuento) > 0 ? `<tr><td>Descuento</td><td>-$${Number(pedido.descuento).toFixed(2)}</td></tr>` : ''}
    ${Number(pedido.iva || 0) > 0 ? `<tr><td>IVA 13%</td><td>$${Number(pedido.iva).toFixed(2)}</td></tr>` : ''}
    <tr><td>TOTAL</td><td>$${total.toFixed(2)}</td></tr>
  </table>
  <div class="footer">
    <p>Tipo: ${tipoLabel[pedido.tipo] || pedido.tipo}</p>
    ${pedido.cliente_nombre ? `<p>Cliente: ${pedido.cliente_nombre}</p>` : ''}
    <p>Gracias por tu preferencia!</p>
  </div>
</body></html>`;
  };

  const imprimirTicket = (pedido) => {
    const html = generarTicketHTML(pedido);
    const win = window.open('', '_blank', 'width=400,height=600');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 500);
    }
  };

  const descargarTicket = (pedido) => {
    const html = generarTicketHTML(pedido);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket-${pedido.numero_ticket}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
            <h2>Despacho</h2>
            <p>Pedidos listos para entregar — <strong style={{color:'var(--green)'}}>{listos.length}</strong> pendiente(s)</p>
          </div>
          <div className="kitchen-live">
            <span className="kitchen-live-dot active" />
            <span className="kitchen-live-text">En vivo</span>
          </div>
        </div>

        {loading ? (
          <div className="loading-text" style={{paddingTop:'60px'}}>
            <Loader2 size={20} className="spin" /> Cargando pedidos...
          </div>
        ) : (
          <div className="dispatch-body">
            <div className="dispatch-main">
              <h3 className="dispatch-section-title">
                Listos para entregar ({listos.length})
              </h3>
              {listos.length === 0 ? (
                <p className="dispatch-empty">Sin pedidos pendientes de entrega</p>
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
                          {p.tipo === 'en_mesa' ? `Mesa ${p.mesa?.numero || ''}` : p.tipo === 'para_llevar' ? 'Para llevar' : p.tipo === 'domicilio' ? 'Domicilio' : 'Para recoger'}
                        </div>
                      )}

                      {p.notas && (
                        <div style={{
                          background: 'var(--caramel-dim)', borderRadius: '6px', padding: '8px 10px',
                          marginTop: '8px', fontSize: '13px', border: '1px solid rgba(212,163,115,0.25)'
                        }}>
                          <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--caramel)', marginBottom: '2px' }}>
                            Notas del pedido
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
                                fontSize:'11px', color:'var(--amber)', background:'var(--amber-bg)',
                                padding:'2px 8px', borderRadius:'6px', border:'1px solid rgba(240,180,41,0.3)',
                                whiteSpace:'nowrap'
                              }}>
                                {item.notas}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="dispatch-card-actions">
                        <button className="dispatch-btn-secondary" onClick={() => setTicketModal(p)}>
                          <Receipt size={14} /> Ver Ticket
                        </button>
                        <button className="dispatch-btn" onClick={() => entregar(p.id)}>
                          Marcar Entregado
                        </button>
                      </div>
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
                    <div key={p.id} className="dispatch-recent-row" onClick={() => setTicketModal(p)} style={{cursor:'pointer'}}>
                      <div>
                        <span className="dispatch-recent-ticket">#{(p.numero_ticket || p.id).toString().padStart(4,'0')}</span>
                        {p.cliente_nombre && <div style={{fontSize:'11px',color:'var(--text-dim)',marginTop:'2px'}}>{p.cliente_nombre}</div>}
                      </div>
                      <div style={{textAlign:'right'}}>
                        <span className="dispatch-recent-time">
                          {new Date(p.actualizado_en || p.creado_en).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div style={{fontSize:'10px',color:'var(--green)',marginTop:'2px'}}>Entregado</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </aside>
          </div>
        )}
      </main>

      {ticketModal && (
        <div className="modal-overlay" onClick={() => setTicketModal(null)} role="dialog" aria-modal="true">
          <div className="pos-ticket-modal" onClick={e => e.stopPropagation()}>
            <div className="pos-ticket-header">
              <h2>Dulce Patojo</h2>
              <p>Sistema POS — Ticket de Venta</p>
              <div className="pos-ticket-divider" />
              <p className="pos-ticket-number">
                #{String(ticketModal.numero_ticket).padStart(3, '0')}
              </p>
              <p className="pos-ticket-date">
                {new Date(ticketModal.creado_en).toLocaleString('es-SV')}
              </p>
            </div>

            <div className="pos-ticket-items pos-ticket-divider">
              {ticketModal.pedido_items?.map((item, i) => (
                <div key={i} className="pos-ticket-item">
                  <span>{item.cantidad}x {item.nombre}</span>
                  <span>${Number(item.precio_unitario * item.cantidad).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="pos-ticket-totals">
              <div className="pos-ticket-total-row">
                <span>Subtotal</span>
                <span>${Number(ticketModal.subtotal).toFixed(2)}</span>
              </div>
              {Number(ticketModal.descuento) > 0 && (
                <div className="pos-ticket-total-row pos-ticket-total-row--discount">
                  <span>Descuento</span>
                  <span>-${Number(ticketModal.descuento).toFixed(2)}</span>
                </div>
              )}
              {Number(ticketModal.iva || 0) > 0 && (
                <div className="pos-ticket-total-row pos-ticket-total-row--muted">
                  <span>IVA 13%</span>
                  <span>${Number(ticketModal.iva).toFixed(2)}</span>
                </div>
              )}
              <div className="pos-ticket-grand-total">
                <span>TOTAL</span>
                <span>${Number(ticketModal.total_con_iva || ticketModal.total).toFixed(2)}</span>
              </div>
            </div>

            <div className="pos-ticket-footer">
              <p>
                Tipo: {ticketModal.tipo === 'en_mesa' ? 'En mesa' : ticketModal.tipo === 'para_llevar' ? 'Para llevar' : ticketModal.tipo === 'domicilio' ? 'Domicilio' : 'Para recoger'}
              </p>
              {ticketModal.cliente_nombre && (
                <p>Cliente: {ticketModal.cliente_nombre}</p>
              )}
              <p>Gracias por tu preferencia!</p>
            </div>

            <div className="pos-ticket-actions">
              <button className="pos-btn-ticket pos-btn-ticket--print" onClick={() => { imprimirTicket(ticketModal); setTicketModal(null); }}>
                <Printer size={16} /> Imprimir
              </button>
              <button className="pos-btn-ticket pos-btn-ticket--download" onClick={() => { descargarTicket(ticketModal); setTicketModal(null); }}>
                <Download size={16} /> Descargar
              </button>
            </div>
            <button className="pos-btn-close-ticket" onClick={() => setTicketModal(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Despacho;
