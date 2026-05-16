import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useInactividad } from '../hooks/useInactividad';
import Sidebar from '../components/Sidebar';

const API = 'http://localhost:5000';

const btnCantidad = {
  width: '24px', height: '24px', borderRadius: '5px',
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', cursor: 'pointer', fontSize: '15px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  lineHeight: 1, padding: 0,
};

const TIPOS_PROMO = {
  descuento_porcentaje: { label: 'Descuento %', icon: '\uD83C\uDFF7\uFE0F', color: '#3498db', bg: 'rgba(52,152,219,0.15)' },
  dos_x_uno: { label: '2x1', icon: '\uD83C\uDFAF', color: '#9b59b6', bg: 'rgba(155,89,182,0.15)' },
  tres_x_dos: { label: '3x2', icon: '\uD83C\uDF81', color: '#e67e22', bg: 'rgba(230,126,34,0.15)' },
  happy_hour: { label: 'Happy Hour', icon: '\u23F0', color: '#27ae60', bg: 'rgba(39,174,60,0.15)' },
};

const MODAL_PAGO = 'pago';
const MODAL_TICKET = 'ticket';
const MODAL_TIPO = 'tipo';

const styleScroll = {
  maxHeight: 'calc(100vh - 100px)', overflowY: 'auto',
  scrollbarWidth: 'thin', scrollbarColor: 'var(--gold-light) transparent',
};

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
  const [procesandoPago, setProcesandoPago] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const headers = { Authorization: `Bearer ${token}` };

  useInactividad(300000, () => navigate('/login'));

  const total = carrito.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  const descuentoTotal = carrito.reduce((sum, item) => sum + (item.descuento || 0) * item.cantidad, 0);
  const subtotal = total + descuentoTotal;

  const montoPago = pedidoActual ? Number(pedidoActual.total) : total;
  const cambio = Math.max(0, Number(montoRecibido || 0) - montoPago);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resProd, resCat, resPromo, resMesas, resCombos] = await Promise.all([
          axios.get(`${API}/productos`, { headers }),
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

  const agregarAlCarrito = (item, tipo) => {
    setCarrito(prev => {
      const idx = prev.findIndex(i => i.id === item.id && i.tipo === tipo);
      if (idx >= 0) {
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
          precio: i.precio_final || i.precio,
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
      setModal(MODAL_PAGO);
    } catch (err) {
      console.error('Error al crear pedido:', err);
      alert(err.response?.data?.error || 'Error al crear pedido');
    } finally {
      setSubmitting(false);
    }
  };

  const procesarPago = async () => {
    if (metodoPago === 'efectivo' && Number(montoRecibido) < montoPago) {
      alert(`Monto insuficiente. Total: $${montoPago.toFixed(2)}, Recibido: $${Number(montoRecibido).toFixed(2)}`);
      return;
    }
    setProcesandoPago(true);
    try {
      const res = await axios.post(
        `${API}/pedidos/${pedidoActual.id}/pagar`,
        { metodo_pago: metodoPago, monto_recibido: Number(montoRecibido) || null },
        { headers }
      );
      setPedidoActual(res.data.pedido);
      setModal(MODAL_TICKET);
    } catch (err) {
      console.error('Error al procesar pago:', err);
      alert(err.response?.data?.error || 'Error al procesar pago');
    } finally {
      setProcesandoPago(false);
    }
  };

  const cerrarModal = () => {
    setModal(null);
    setPedidoActual(null);
    setMetodoPago('efectivo');
    setMontoRecibido('');
  };

  const renderItem = (item, tipo) => (
    <div
      key={`${tipo}-${item.id}`}
      onClick={() => agregarAlCarrito(item, tipo)}
      style={{
        background: 'var(--card)',
        borderRadius: '12px',
        padding: '12px',
        cursor: 'pointer',
        border: '1px solid var(--border)',
        transition: 'all .2s',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        minHeight: '100px',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold-light)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{item.nombre}</span>
      {item.descripcion && (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', flex: 1 }}>{item.descripcion}</span>
      )}
      <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--gold-light)' }}>
        ${Number(item.precio).toFixed(2)}
      </span>
    </div>
  );

  const renderPromo = (promo) => {
    const info = TIPOS_PROMO[promo.tipo] || { label: promo.tipo, icon: '\uD83C\uDF89', color: '#666', bg: 'rgba(0,0,0,0.05)' };
    return (
      <div
        key={`promo-${promo.id}`}
        onClick={() => agregarAlCarrito(promo, 'promocion')}
        style={{
          background: info.bg,
          borderRadius: '12px',
          padding: '12px',
          cursor: 'pointer',
          border: `2px solid ${info.color}`,
          transition: 'all .2s',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          minHeight: '100px',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
          {info.icon} {promo.nombre}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', flex: 1 }}>
          {info.label}{promo.descuento_porcentaje ? ` - ${promo.descuento_porcentaje}% OFF` : ''}
        </span>
        <span style={{ fontSize: '15px', fontWeight: 800, color: info.color }}>
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
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar usuario={usuario} activeRoute="caja" />
      <main className="main-content" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <Sidebar usuario={usuario} activeRoute="caja" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--card)',
        }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>
            \uD83D\uDCCB Punto de Venta
          </h1>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {usuario?.nombre || 'Cajero'}
          </span>
        </div>

        {/* Tabs: Productos, Combos, Promociones */}
        <div style={{
          display: 'flex', gap: '8px', padding: '12px 24px',
          borderBottom: '1px solid var(--border)', background: 'var(--surface)',
        }}>
          {[
            { key: 'productos', label: '\uD83C\uDF4E Productos' },
            { key: 'combos', label: '\uD83C\uDF70 Combos' },
            { key: 'promociones', label: '\uD83C\uDF89 Promociones' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                background: tab === t.key ? 'var(--gold-light)' : 'var(--card)',
                color: tab === t.key ? '#000' : 'var(--text)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Buscador + filtro categorias */}
        <div style={{ padding: '12px 24px', display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder="Buscar..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--card)',
              color: 'var(--text)', fontSize: '13px',
            }}
          />
          <select
            value={filtroCategoria}
            onChange={e => setFiltroCategoria(e.target.value)}
            style={{
              padding: '10px 14px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--card)',
              color: 'var(--text)', fontSize: '13px', maxWidth: '200px',
            }}
          >
            <option value="">Todas las categorías</option>
            {categorias.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.nombre}</option>
            ))}
          </select>
        </div>

        {/* Grid de items */}
        <div style={{ flex: 1, padding: '0 24px 24px', overflowY: 'auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '12px',
          }}>
            {tab === 'productos' && itemsFiltrados(productos).map(item => renderItem(item, 'producto'))}
            {tab === 'combos' && itemsFiltrados(combos).map(item => renderItem(item, 'combo'))}
            {tab === 'promociones' && itemsFiltrados(promociones).map(promo => renderPromo(promo))}
          </div>
        </div>

        {/* Carrito - barra inferior */}
        {carrito.length > 0 && (
          <div style={{
            borderTop: '2px solid var(--gold-light)',
            background: 'var(--card)',
            padding: '12px 24px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                Carrito ({carrito.reduce((s, i) => s + i.cantidad, 0)} items)
              </span>
              <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--gold-light)' }}>
                ${total.toFixed(2)}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px', maxHeight: '120px', overflowY: 'auto' }}>
              {carrito.map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'var(--surface)', borderRadius: '8px',
                  padding: '6px 10px', fontSize: '12px',
                }}>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>
                    {item.nombre}
                  </span>
                  <span style={{ color: 'var(--gold-light)', fontWeight: 700 }}>
                    ${(item.precio * item.cantidad).toFixed(2)}
                  </span>
                  <button onClick={() => cambiarCantidad(idx, -1)} style={btnCantidad}>-</button>
                  <span style={{ fontWeight: 700, color: 'var(--text)', minWidth: '16px', textAlign: 'center' }}>
                    {item.cantidad}
                  </span>
                  <button onClick={() => cambiarCantidad(idx, 1)} style={btnCantidad}>+</button>
                  <button
                    onClick={() => quitarDelCarrito(idx)}
                    style={{ ...btnCantidad, color: '#e74c3c', borderColor: '#e74c3c' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={abrirModalTipo}
              style={{
                width: '100%', padding: '14px', borderRadius: '10px',
                border: 'none', background: 'var(--gold-light)', color: '#000',
                fontWeight: 700, fontSize: '15px', cursor: 'pointer',
              }}
            >
              Procesar Pedido — ${total.toFixed(2)}
            </button>
          </div>
        )}

        {/* MODAL: Tipo de Pedido / Mesa / Cliente */}
        {modal === MODAL_TIPO && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }} onClick={cerrarModal}>
            <div style={{
              background: 'var(--card)', borderRadius: '16px', padding: '24px',
              width: '420px', maxWidth: '90vw',
            }} onClick={e => e.stopPropagation()}>
              <h3 style={{ margin: '0 0 16px', color: 'var(--text)' }}>Tipo de Pedido</h3>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {[
                  { value: 'en_mesa', label: 'En Mesa' },
                  { value: 'para_llevar', label: 'Para Llevar' },
                  { value: 'recoger', label: 'Recoger' },
                ].map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTipoPedido(t.value)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '10px',
                      border: tipoPedido === t.value ? '2px solid var(--gold-light)' : '1px solid var(--border)',
                      background: tipoPedido === t.value ? 'rgba(201,168,76,0.15)' : 'var(--surface)',
                      color: 'var(--text)', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {tipoPedido === 'en_mesa' && mesas.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Seleccionar Mesa
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {mesas.filter(m => m.estado === 'disponible').map(mesa => (
                      <button
                        key={mesa.id}
                        onClick={() => setMesaId(mesa.id)}
                        style={{
                          padding: '8px 16px', borderRadius: '8px',
                          border: mesaId === mesa.id ? '2px solid var(--gold-light)' : '1px solid var(--border)',
                          background: mesaId === mesa.id ? 'rgba(201,168,76,0.15)' : 'var(--surface)',
                          color: 'var(--text)', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                        }}
                      >
                        Mesa {mesa.numero}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Nombre del cliente (opcional)
              </label>
              <input
                type="text"
                value={clienteNombre}
                onChange={e => setClienteNombre(e.target.value)}
                style={{
                  width: '100%', padding: '10px', borderRadius: '8px',
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text)', marginBottom: '12px', fontSize: '13px',
                }}
                placeholder="Cliente..."
              />
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Notas (opcional)
              </label>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                rows={2}
                style={{
                  width: '100%', padding: '10px', borderRadius: '8px',
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text)', marginBottom: '16px', resize: 'none',
                  fontFamily: 'inherit', fontSize: '13px',
                }}
                placeholder="Notas para cocina..."
              />

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Subtotal</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>${subtotal.toFixed(2)}</span>
                </div>
                {descuentoTotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', color: '#2ecc71' }}>Descuentos</span>
                    <span style={{ fontSize: '13px', color: '#2ecc71' }}>-${descuentoTotal.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '16px', color: 'var(--gold-light)' }}>
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={cerrarModal}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '10px',
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    color: 'var(--text)', cursor: 'pointer', fontWeight: 600,
                  }}>
                  Cancelar
                </button>
                <button onClick={confirmarTipoPedido} disabled={submitting}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
                    background: submitting ? 'var(--surface)' : 'var(--gold-light)',
                    color: '#000', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 700,
                  }}>
                  {submitting ? 'Creando...' : 'Confirmar Pedido'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Pago */}
        {modal === MODAL_PAGO && pedidoActual && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }} onClick={cerrarModal}>
            <div style={{
              background: 'var(--card)', borderRadius: '16px', padding: '24px',
              width: '420px', maxWidth: '90vw',
            }} onClick={e => e.stopPropagation()}>
              <h3 style={{ margin: '0 0 16px', color: 'var(--text)' }}>Procesar Pago</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Pedido #{pedidoActual.numero_ticket} &mdash; Total a pagar
              </p>
              <p style={{
                fontSize: '28px', fontWeight: 800, color: 'var(--gold-light)',
                textAlign: 'center', margin: '0 0 20px',
              }}>
                ${Number(pedidoActual.total).toFixed(2)}
              </p>

              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Método de pago
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {[
                  { value: 'efectivo', label: 'Efectivo' },
                  { value: 'tarjeta', label: 'Tarjeta (POS)' },
                ].map(m => (
                  <button key={m.value} onClick={() => { setMetodoPago(m.value); setMontoRecibido(''); }}
                    style={{
                      flex: 1, padding: '12px', borderRadius: '10px',
                      border: metodoPago === m.value ? '2px solid var(--gold-light)' : '1px solid var(--border)',
                      background: metodoPago === m.value ? 'rgba(201,168,76,0.15)' : 'var(--surface)',
                      color: 'var(--text)', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                      transition: 'all .2s',
                    }}>
                    {m.label}
                  </button>
                ))}
              </div>

              {metodoPago === 'efectivo' && (
                <>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Monto recibido
                  </label>
                  <input type="number" step="0.01" min={montoPago} value={montoRecibido}
                    onChange={e => setMontoRecibido(e.target.value)}
                    style={{
                      width: '100%', padding: '12px', borderRadius: '8px',
                      border: '1px solid var(--border)', background: 'var(--surface)',
                      color: 'var(--text)', fontSize: '18px', fontWeight: 700, marginBottom: '12px',
                    }} />
                  {Number(montoRecibido || 0) >= montoPago && (
                    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Cambio: </span>
                      <span style={{ fontSize: '20px', fontWeight: 700, color: '#2ecc71' }}>
                        ${cambio.toFixed(2)}
                      </span>
                    </div>
                  )}
                </>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={cerrarModal}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '10px',
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    color: 'var(--text)', cursor: 'pointer', fontWeight: 600,
                  }}>
                  Cancelar
                </button>
                <button onClick={procesarPago} disabled={procesandoPago}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
                    background: procesandoPago ? 'var(--surface)' : '#27ae60',
                    color: '#fff', cursor: procesandoPago ? 'not-allowed' : 'pointer', fontWeight: 700,
                  }}>
                  {procesandoPago ? 'Procesando...' : 'Pagar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Ticket */}
        {modal === MODAL_TICKET && pedidoActual && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }} onClick={cerrarModal}>
            <div style={{
              background: '#fff', borderRadius: '16px', padding: '32px',
              width: '380px', maxWidth: '90vw', color: '#000',
            }} onClick={e => e.stopPropagation()}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 800 }}>Dulce Patojo</h2>
                <p style={{ margin: 0, fontSize: '11px', color: '#666' }}>Sistema POS &mdash; Ticket de Venta</p>
                <div style={{ borderTop: '1px dashed #ccc', margin: '12px 0' }} />
                <h1 style={{ margin: 0, fontSize: '36px', fontWeight: 800, color: '#000', letterSpacing: '2px' }}>
                  #{String(pedidoActual.numero_ticket).padStart(3, '0')}
                </h1>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#666' }}>
                  {new Date(pedidoActual.creado_en).toLocaleString('es-SV')}
                </p>
              </div>

              <div style={{ borderTop: '1px dashed #ccc', paddingTop: '12px', marginBottom: '12px' }}>
                {pedidoActual.pedido_items?.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: '12px', marginBottom: '6px',
                  }}>
                    <span style={{ flex: 1 }}>{item.cantidad}x {item.nombre}</span>
                    <span style={{ fontWeight: 600 }}>
                      ${Number(item.precio_unitario * item.cantidad).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px dashed #ccc', paddingTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Subtotal</span>
                  <span>${Number(pedidoActual.subtotal).toFixed(2)}</span>
                </div>
                {Number(pedidoActual.descuento) > 0 && (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: '12px', marginBottom: '4px', color: '#2ecc71',
                  }}>
                    <span>Descuento</span>
                    <span>-${Number(pedidoActual.descuento).toFixed(2)}</span>
                  </div>
                )}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: '16px', fontWeight: 800,
                  borderTop: '1px solid #ccc', paddingTop: '8px', marginTop: '8px',
                }}>
                  <span>TOTAL</span>
                  <span>${Number(pedidoActual.total).toFixed(2)}</span>
                </div>
              </div>

              <div style={{
                borderTop: '1px dashed #ccc', marginTop: '12px', paddingTop: '12px',
                textAlign: 'center', fontSize: '10px', color: '#999',
              }}>
                <p style={{ margin: 0 }}>
                  Tipo: {pedidoActual.tipo === 'en_mesa' ? 'En mesa' : pedidoActual.tipo === 'para_llevar' ? 'Para llevar' : 'Para recoger'}
                </p>
                {pedidoActual.cliente_nombre && (
                  <p style={{ margin: '4px 0 0' }}>Cliente: {pedidoActual.cliente_nombre}</p>
                )}
                <p style={{ margin: '4px 0 0' }}>Gracias por tu preferencia!</p>
              </div>

              <button onClick={cerrarModal}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px',
                  border: 'none', background: '#000', color: '#fff',
                  fontWeight: 700, cursor: 'pointer', marginTop: '16px',
                }}>
                Cerrar Ticket
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
