import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useInactividad } from '../hooks/useInactividad';
import { useToast } from '../context/ToastContext';
import Sidebar from '../components/Sidebar';
import {
  Apple,
  Cookie,
  PartyPopper,
  Tag,
  Crosshair,
  Gift,
  Clock,
  X,
  ShoppingBag,
  CreditCard,
  Banknote,
  QrCode,
  Smartphone,
  Building2,
  Utensils,
  Truck,
  ShoppingBasket,
  Store,
  Loader2,
} from 'lucide-react';

import API from '../utils/api';

const TIPOS_PROMO = {
  descuento_porcentaje: { label: 'Descuento %', icon: Tag, tone: 'blue' },
  dos_x_uno: { label: '2x1', icon: Crosshair, tone: 'purple' },
  tres_x_dos: { label: '3x2', icon: Gift, tone: 'orange' },
  happy_hour: { label: 'Happy Hour', icon: Clock, tone: 'green' },
};

const MODAL_PAGO = 'pago';
const MODAL_TICKET = 'ticket';
const MODAL_TIPO = 'tipo';

const TABS = [
  { key: 'productos', icon: Apple, label: 'Productos' },
  { key: 'combos', icon: Cookie, label: 'Combos' },
  { key: 'promociones', icon: PartyPopper, label: 'Promociones' },
];

export default function Caja() {
  const [tab, setTab] = useState('productos');
  const [productos, setProductos] = useState([]);
  const [combos, setCombos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [promociones, setPromociones] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [carrito, setCarrito] = useState([]);
  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [tipoPedido, setTipoPedido] = useState('en_mesa');
  const [mesaId, setMesaId] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [notas, setNotas] = useState('');
  const [pedidoActual, setPedidoActual] = useState(null);
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [propina, setPropina] = useState(0);
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToast();

  const token = localStorage.getItem('token');
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const headers = { Authorization: `Bearer ${token}` };

  useInactividad(300000, () => navigate('/login'));

  const total = carrito.reduce((sum, item) => sum + (Number(item.precio_final || item.precio || 0) * item.cantidad), 0);
  const descuentoTotal = carrito.reduce((sum, item) => sum + (Number(item.descuento || 0) * item.cantidad), 0);
  const subtotal = total + descuentoTotal;

  const montoPago = pedidoActual ? Number(pedidoActual.total_con_iva || pedidoActual.total) : total;
  const cambio = Math.max(0, Number(montoRecibido || 0) - montoPago);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resProd, resCat, resPromo, resMesas, resCombos] = await Promise.all([
          axios.get(`${API}/productos?disponible=true`, { headers }),
          axios.get(`${API}/productos/categorias`, { headers }),
          axios.get(`${API}/promociones`, { headers }),
          axios.get(`${API}/mesas`, { headers }),
          axios.get(`${API}/productos/combos/lista`, { headers }),
        ]);
        setProductos(resProd.data);
        setCombos(resCombos.data);
        setCategorias(resCat.data);
        setPromociones(resPromo.data);
        setMesas(resMesas.data);
      } catch (err) {
        console.error('Error al cargar datos:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (carrito.length > 0) {
      setCartOpen(true);
    }
  }, [carrito.length]);

  const agregarAlCarrito = (item, tipo) => {
    if (tipo === 'producto' && item.stock !== undefined && Number(item.stock) <= 0) {
      addToast(`"${item.nombre}" no tiene stock disponible`, 'error');
      return;
    }
    setCarrito(prev => {
      const idx = prev.findIndex(i => i.id === item.id && i.tipo === tipo);
      if (idx >= 0) {
        if (tipo === 'promocion') {
          addToast('La promocion ya esta en el carrito', 'info');
          return prev;
        }
        const nuevo = [...prev];
        nuevo[idx] = { ...nuevo[idx], cantidad: nuevo[idx].cantidad + 1 };
        return nuevo;
      }
      return [...prev, { ...item, tipo, cantidad: 1 }];
    });
  };

  const cambiarCantidad = (idx, delta) => {
    setCarrito(prev => {
      const nuevo = [...prev];
      if (nuevo[idx]?.tipo === 'promocion') {
        if (delta < 0) return prev.filter((_, i) => i !== idx);
        return prev;
      }
      const val = (nuevo[idx].cantidad || 1) + delta;
      if (val <= 0) return prev.filter((_, i) => i !== idx);
      nuevo[idx] = { ...nuevo[idx], cantidad: val };
      return nuevo;
    });
  };

  const quitarDelCarrito = (idx) => {
    setCarrito(prev => prev.filter((_, i) => i !== idx));
  };

  const abrirModalTipo = () => {
    if (carrito.length === 0) return;
    setMesaId('');
    setClienteNombre('');
    setNotas('');
    setModal(MODAL_TIPO);
  };

  const confirmarTipoPedido = async () => {
    if (tipoPedido === 'en_mesa' && !mesaId) return;
    setSubmitting(true);
    try {
      const body = {
        items: carrito.map(i => ({
          id: i.id,
          tipo: i.tipo,
          nombre: i.nombre,
          precio: i.precio_final || i.precio || 0,
          descuento: i.descuento || 0,
          cantidad: i.cantidad,
        })),
        tipo: tipoPedido,
        mesa_id: mesaId || null,
        cliente_nombre: clienteNombre || null,
        notas: notas || null,
      };
      const res = await axios.post(`${API}/pedidos`, body, { headers });
      setPedidoActual(res.data);
      setCarrito([]);
      await recargarMesas();
      setModal(MODAL_PAGO);
    } catch (err) {
      console.error('Error al crear pedido:', err);
      addToast(err.response?.data?.error || 'Error al crear pedido', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const procesarPago = async () => {
    const totalConPropina = montoPago + propina;
    if (metodoPago === 'efectivo' && Number(montoRecibido) < totalConPropina) {
      addToast(`Monto insuficiente. Total: $${totalConPropina.toFixed(2)}, Recibido: $${Number(montoRecibido).toFixed(2)}`, 'error');
      return;
    }
    setProcesandoPago(true);
    try {
      const res = await axios.post(
        `${API}/pedidos/${pedidoActual.id}/pagar`,
        { metodo_pago: metodoPago, monto_recibido: Number(montoRecibido) || null, propina: propina || 0 },
        { headers }
      );
      setPedidoActual(res.data.pedido);
      await recargarMesas();
      setModal(MODAL_TICKET);
    } catch (err) {
      console.error('Error al procesar pago:', err);
      addToast(err.response?.data?.error || 'Error al procesar pago', 'error');
    } finally {
      setProcesandoPago(false);
    }
  };

  const recargarMesas = async () => {
    try {
      const { data } = await axios.get(`${API}/mesas`, { headers });
      setMesas(data || []);
    } catch {}
  };

  const cerrarModal = () => {
    setModal(null);
    setPedidoActual(null);
    setMetodoPago('efectivo');
    setPropina(0);
    setMontoRecibido('');
    recargarMesas();
  };

  const renderItem = (item, tipo) => {
    const sinStock = tipo === 'producto' && item.stock !== undefined && Number(item.stock) <= 0;
    return (
      <div
        key={`${tipo}-${item.id}`}
        className={`pos-product-card${sinStock ? ' pos-product-card--disabled' : ''}`}
        onClick={() => agregarAlCarrito(item, tipo)}
      >
        <div className="pos-product-header">
          <span className="pos-product-name">{item.nombre}</span>
          {item.stock !== undefined && Number(item.stock) <= Number(item.stock_minimo) && (
            <span className={`pos-stock-badge ${Number(item.stock) <= 0 ? 'pos-stock-badge--out' : 'pos-stock-badge--low'}`}>
              {Number(item.stock) <= 0 ? 'Sin stock' : 'Stock bajo'}
            </span>
          )}
        </div>
        {item.descripcion && (
          <span className="pos-product-desc">{item.descripcion}</span>
        )}
        <div className="pos-product-footer">
          <span className="pos-product-price">
            ${Number(item.precio).toFixed(2)}
          </span>
          {item.stock !== undefined && Number(item.stock) > Number(item.stock_minimo) && (
            <span className="pos-stock-count">{item.stock} uds</span>
          )}
        </div>
      </div>
    );
  };

  const renderPromo = (promo) => {
    const info = TIPOS_PROMO[promo.tipo] || { label: promo.tipo, icon: PartyPopper, tone: 'neutral' };
    const IconComp = info.icon;
    return (
      <div
        key={`promo-${promo.id}`}
        className={`pos-promo-card pos-promo-card--${info.tone}`}
        onClick={() => agregarAlCarrito(promo, 'promocion')}
      >
        <span className="pos-promo-name">
          <IconComp size={18} /> {promo.nombre}
        </span>
        <span className="pos-promo-desc">
          {info.label}{promo.descuento_porcentaje ? ` - ${promo.descuento_porcentaje}% OFF` : ''}
        </span>
        <span className="pos-promo-price">
          ${Number(promo.precio_final || promo.precio || 0).toFixed(2)}
        </span>
      </div>
    );
  };

  const itemsFiltrados = (items) => {
    let result = [...items];
    if (filtroCategoria) result = result.filter(i => String(i.categoria_id) === filtroCategoria);
    if (busqueda) result = result.filter(i =>
      i.nombre?.toLowerCase().includes(busqueda.toLowerCase())
    );
    return result;
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <Sidebar usuario={usuario} activeRoute="caja" />
        <main className="main-content pos-loading">
          <p className="pos-loading-text">Cargando...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <Sidebar usuario={usuario} activeRoute="caja" />
      <div className="pos-layout">
        <div className="pos-header">
          <div>
            <h1 className="pos-header-title">Punto de Venta</h1>
            <span className="pos-header-user">{usuario?.nombre || 'Cajero'}</span>
          </div>
          <div className="pos-header-actions">
            <button
              className="pos-cart-toggle"
              onClick={() => setCartOpen(true)}
              aria-label="Abrir carrito"
            >
              <ShoppingBag size={20} />
              <span>{carrito.reduce((s, i) => s + i.cantidad, 0)}</span>
            </button>
          </div>
        </div>

        <div className="pos-content">
          <section className="pos-catalog">
            <div className="pos-tabs">
              {TABS.map(t => {
                const IconComp = t.icon;
                return (
                  <button
                    key={t.key}
                    className={`pos-tab-btn${tab === t.key ? ' active' : ''}`}
                    onClick={() => setTab(t.key)}
                  >
                    <IconComp size={18} /> {t.label}
                  </button>
                );
              })}
            </div>

            <div className="pos-search-bar">
              <input
                type="text"
                className="pos-search-input"
                placeholder="Buscar..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
              <select
                className="pos-search-select"
                value={filtroCategoria}
                onChange={e => setFiltroCategoria(e.target.value)}
              >
                <option value="">Todas las categorías</option>
                {categorias.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                ))}
              </select>
            </div>

            <div className="pos-grid-wrapper">
              <div className="pos-grid">
                {tab === 'productos' && itemsFiltrados(productos).map(item => renderItem(item, 'producto'))}
                {tab === 'combos' && itemsFiltrados(combos).map(item => renderItem(item, 'combo'))}
                {tab === 'promociones' && itemsFiltrados(promociones).map(promo => renderPromo(promo))}
              </div>
            </div>
          </section>

          <aside className="pos-cart" aria-live="polite">
            <div className="pos-cart-header">
              <span className="pos-cart-title">
                Carrito ({carrito.reduce((s, i) => s + i.cantidad, 0)} items)
              </span>
              <span className="pos-cart-total">${total.toFixed(2)}</span>
            </div>
            <div className="pos-cart-items">
              {carrito.length === 0 && (
                <div className="pos-cart-empty">Agrega productos para iniciar el pedido.</div>
              )}
              {carrito.map((item, idx) => (
                <div key={idx} className="pos-cart-item">
                  <div className="pos-cart-item-info">
                    <span className="pos-cart-item-name">{item.nombre}</span>
                    <span className="pos-cart-item-price">
                      ${(Number(item.precio_final || item.precio || 0) * item.cantidad).toFixed(2)}
                    </span>
                  </div>
                  <div className="pos-cart-qty">
                    <button className="pos-qty-btn" onClick={() => cambiarCantidad(idx, -1)} aria-label="Restar">-</button>
                    <span className="pos-qty-count">{item.cantidad}</span>
                    <button className="pos-qty-btn" onClick={() => cambiarCantidad(idx, 1)} aria-label="Sumar">+</button>
                    <button className="pos-qty-btn pos-qty-btn--remove" onClick={() => quitarDelCarrito(idx)} aria-label="Quitar">
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button className="pos-btn-process" onClick={abrirModalTipo} disabled={carrito.length === 0}>
              Procesar Pedido — ${total.toFixed(2)}
            </button>
          </aside>
        </div>

        <button
          className="pos-cart-fab"
          onClick={() => setCartOpen(true)}
          aria-label="Ver carrito"
        >
          <ShoppingBag size={22} />
          <span>${total.toFixed(2)}</span>
        </button>

        <div className={`pos-bottom-sheet${cartOpen ? ' open' : ''}`}>
          <div className="pos-bottom-sheet-handle" onClick={() => setCartOpen(false)} />
          <div className="pos-cart">
            <div className="pos-cart-header">
              <span className="pos-cart-title">
                Carrito ({carrito.reduce((s, i) => s + i.cantidad, 0)} items)
              </span>
              <button className="pos-cart-close" onClick={() => setCartOpen(false)} aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>
            <div className="pos-cart-items">
              {carrito.length === 0 && (
                <div className="pos-cart-empty">Agrega productos para iniciar el pedido.</div>
              )}
              {carrito.map((item, idx) => (
                <div key={idx} className="pos-cart-item">
                  <div className="pos-cart-item-info">
                    <span className="pos-cart-item-name">{item.nombre}</span>
                    <span className="pos-cart-item-price">
                      ${(Number(item.precio_final || item.precio || 0) * item.cantidad).toFixed(2)}
                    </span>
                  </div>
                  <div className="pos-cart-qty">
                    <button className="pos-qty-btn" onClick={() => cambiarCantidad(idx, -1)} aria-label="Restar">-</button>
                    <span className="pos-qty-count">{item.cantidad}</span>
                    <button className="pos-qty-btn" onClick={() => cambiarCantidad(idx, 1)} aria-label="Sumar">+</button>
                    <button className="pos-qty-btn pos-qty-btn--remove" onClick={() => quitarDelCarrito(idx)} aria-label="Quitar">
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button className="pos-btn-process" onClick={abrirModalTipo} disabled={carrito.length === 0}>
              Procesar Pedido — ${total.toFixed(2)}
            </button>
          </div>
        </div>

        {modal === MODAL_TIPO && (
          <div className="pos-modal-overlay" onClick={cerrarModal}>
            <div className="pos-slide-over" onClick={e => e.stopPropagation()}>
              <div className="pos-slide-header">
                <h3 className="pos-modal-title">Tipo de Pedido</h3>
                <button className="pos-cart-close" onClick={cerrarModal} aria-label="Cerrar">
                  <X size={20} />
                </button>
              </div>

              <div className="pos-selection-grid">
                {[
                  { value: 'en_mesa', label: 'En Mesa', icon: Utensils },
                  { value: 'para_llevar', label: 'Para Llevar', icon: ShoppingBasket },
                  { value: 'para_recoger', label: 'Recoger', icon: Store },
                  { value: 'domicilio', label: 'Domicilio', icon: Truck },
                ].map(t => {
                  const IconComp = t.icon;
                  return (
                    <button
                      key={t.value}
                      className={`pos-selection-tile${tipoPedido === t.value ? ' active' : ''}`}
                      onClick={() => setTipoPedido(t.value)}
                    >
                      <IconComp size={20} />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {tipoPedido === 'en_mesa' && mesas.length > 0 && (
                <div className="pos-block">
                  <label className="pos-label">Seleccionar Mesa</label>
                  <div className="pos-mesa-group">
                    {mesas.filter(m => m.estado === 'disponible').map(mesa => (
                      <button
                        key={mesa.id}
                        className={`pos-mesa-btn${mesaId === mesa.id ? ' active' : ''}`}
                        onClick={() => setMesaId(mesa.id)}
                      >
                        Mesa {mesa.numero}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <label className="pos-label">Nombre del cliente (opcional)</label>
              <input
                type="text"
                className="pos-input"
                value={clienteNombre}
                onChange={e => setClienteNombre(e.target.value)}
                placeholder="Cliente..."
              />
              <label className="pos-label">Notas (opcional)</label>
              <textarea
                className="pos-textarea"
                value={notas}
                onChange={e => setNotas(e.target.value)}
                rows={2}
                placeholder="Notas para cocina..."
              />

              <div className="pos-totals">
                <div className="pos-totals-row">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {descuentoTotal > 0 && (
                  <div className="pos-totals-row pos-totals-row--discount">
                    <span>Descuentos</span>
                    <span>-${descuentoTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="pos-totals-row pos-totals-row--total">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="pos-actions">
                <button className="pos-btn pos-btn-cancel" onClick={cerrarModal}>
                  Cancelar
                </button>
                <button className="pos-btn pos-btn-primary" onClick={confirmarTipoPedido} disabled={submitting}>
                  {submitting ? 'Creando...' : 'Confirmar Pedido'}
                </button>
              </div>
            </div>
          </div>
        )}

        {modal === MODAL_PAGO && pedidoActual && (
          <div className="pos-modal-overlay" onClick={cerrarModal}>
            <div className="pos-slide-over" onClick={e => e.stopPropagation()}>
              <div className="pos-slide-header">
                <h3 className="pos-modal-title">Procesar Pago</h3>
                <button className="pos-cart-close" onClick={cerrarModal} aria-label="Cerrar">
                  <X size={20} />
                </button>
              </div>
              <p className="pos-modal-caption">
                Pedido #{pedidoActual.numero_ticket} — Total a pagar
              </p>
              <p className="pos-pay-amount">
                ${Number(pedidoActual.total).toFixed(2)}
              </p>

              <label className="pos-label">Método de pago</label>
              <div className="pos-selection-grid">
                {[
                  { value: 'efectivo', label: 'Efectivo', icon: Banknote },
                  { value: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
                  { value: 'qr', label: 'QR', icon: QrCode },
                  { value: 'billetera_digital', label: 'Billetera', icon: Smartphone },
                  { value: 'transferencia', label: 'Transferencia', icon: Building2 },
                ].map(m => {
                  const IconComp = m.icon;
                  return (
                    <button
                      key={m.value}
                      className={`pos-selection-tile${metodoPago === m.value ? ' active' : ''}`}
                      onClick={() => { setMetodoPago(m.value); setMontoRecibido(''); }}
                    >
                      <IconComp size={20} />
                      {m.label}
                    </button>
                  );
                })}
              </div>

              <label className="pos-label">Propina</label>
              <div className="pos-selection-grid pos-selection-grid--tips">
                {[0, 0.50, 1.00, 2.00].map(tip => (
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
                    min={montoPago + propina}
                    value={montoRecibido}
                    onChange={e => setMontoRecibido(e.target.value)}
                    className="pos-input pos-input-amount"
                  />
                  {Number(montoRecibido || 0) >= (montoPago + propina) && (
                    <div className="pos-cambio">
                      <span className="pos-cambio-label">Cambio: </span>
                      <span className="pos-cambio-value">${cambio.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}

              <div className="pos-actions pos-actions-pay">
                <button className="pos-btn pos-btn-cancel" onClick={cerrarModal}>
                  Cancelar
                </button>
                <div className="pos-empty-cart-total">
                  Total: <strong>${(montoPago + propina).toFixed(2)}</strong>
                  {propina > 0 && <span className="pos-tip-note">(incl. ${propina.toFixed(2)} propina)</span>}
                </div>
                <button className="pos-btn pos-btn-pay" onClick={procesarPago} disabled={procesandoPago}>
                  {procesandoPago ? (
                    <span className="btn-content">
                      <Loader2 size={18} className="btn-spinner" />
                      Procesando...
                    </span>
                  ) : 'Pagar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {modal === MODAL_TICKET && pedidoActual && (
          <div className="pos-modal-overlay" onClick={cerrarModal}>
            <div className="pos-ticket-modal" onClick={e => e.stopPropagation()}>
              <div className="pos-ticket-header">
                <h2>Dulce Patojo</h2>
                <p>Sistema POS — Ticket de Venta</p>
                <div className="pos-ticket-divider" />
                <p className="pos-ticket-number">
                  #{String(pedidoActual.numero_ticket).padStart(3, '0')}
                </p>
                <p className="pos-ticket-date">
                  {new Date(pedidoActual.creado_en).toLocaleString('es-SV')}
                </p>
              </div>

              <div className="pos-ticket-items pos-ticket-divider">
                {pedidoActual.pedido_items?.map((item, i) => (
                  <div key={i} className="pos-ticket-item">
                    <span>{item.cantidad}x {item.nombre}</span>
                    <span>${Number(item.precio_unitario * item.cantidad).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="pos-ticket-totals">
                <div className="pos-ticket-total-row">
                  <span>Subtotal</span>
                  <span>${Number(pedidoActual.subtotal).toFixed(2)}</span>
                </div>
                {Number(pedidoActual.descuento) > 0 && (
                  <div className="pos-ticket-total-row pos-ticket-total-row--discount">
                    <span>Descuento</span>
                    <span>-${Number(pedidoActual.descuento).toFixed(2)}</span>
                  </div>
                )}
                {Number(pedidoActual.iva || 0) > 0 && (
                  <div className="pos-ticket-total-row pos-ticket-total-row--muted">
                    <span>IVA 13%</span>
                    <span>${Number(pedidoActual.iva).toFixed(2)}</span>
                  </div>
                )}
                {Number(pedidoActual.pagos?.[0]?.propina || 0) > 0 && (
                  <div className="pos-ticket-total-row pos-ticket-total-row--muted">
                    <span>Propina</span>
                    <span>$${Number(pedidoActual.pagos[0].propina).toFixed(2)}</span>
                  </div>
                )}
                <div className="pos-ticket-grand-total">
                  <span>TOTAL</span>
                  <span>${Number(pedidoActual.total_con_iva || pedidoActual.total).toFixed(2)}</span>
                </div>
              </div>

              <div className="pos-ticket-footer">
                <p>
                  Tipo: {pedidoActual.tipo === 'en_mesa' ? 'En mesa' : pedidoActual.tipo === 'para_llevar' ? 'Para llevar' : pedidoActual.tipo === 'domicilio' ? 'Domicilio' : 'Para recoger'}
                </p>
                {pedidoActual.cliente_nombre && (
                  <p>Cliente: {pedidoActual.cliente_nombre}</p>
                )}
                <p>Gracias por tu preferencia!</p>
              </div>

              <button className="pos-btn-close-ticket" onClick={cerrarModal}>
                Cerrar Ticket
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
