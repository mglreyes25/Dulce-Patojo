import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useInactividad } from '../hooks/useInactividad';
import { useToast } from '../context/ToastContext';
import Sidebar from '../components/Sidebar';
import CobrosPendientesModal from '../components/CobrosPendientesModal';
import useCobrosSocket from '../hooks/useCobrosSocket';
import useSocket from '../hooks/useSocket';
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
  Receipt,
  Printer,
  Download,
} from 'lucide-react';

import API from '../utils/api';

const TIPOS_PROMO = {
  descuento_porcentaje: { label: 'Descuento %', icon: Tag, tone: 'blue' },
  dos_x_uno: { label: '2x1', icon: Crosshair, tone: 'purple' },
  tres_x_dos: { label: '3x2', icon: Gift, tone: 'orange' },
  happy_hour: { label: 'Happy Hour', icon: Clock, tone: 'green' },
};

const calcularDescuentoPromocion = (promo, carrito) => {
  if (!promo.activo) return 0;

  const itemsElegibles = carrito.filter(item => {
    if (item.tipo !== 'producto') return false;
    if (promo.producto_id && Number(item.id) !== Number(promo.producto_id)) return false;
    if (promo.categoria_id && item.categoria_id !== undefined && Number(item.categoria_id) !== Number(promo.categoria_id)) return false;
    return true;
  });

  if (itemsElegibles.length === 0) return 0;

  switch (promo.tipo) {
    case 'descuento_porcentaje': {
      const pct = Number(promo.valor || 0) / 100;
      return itemsElegibles.reduce((sum, item) =>
        sum + Number(item.precio || 0) * item.cantidad * pct, 0
      );
    }
    case 'happy_hour': {
      const pctHH = Number(promo.valor || 0) / 100;
      const maxHH = promo.cantidad_maxima ? Number(promo.cantidad_maxima) : Infinity;
      let countHH = 0;
      return itemsElegibles.reduce((sum, item) => {
        const aplicar = Math.min(item.cantidad, maxHH - countHH);
        countHH += aplicar;
        return sum + Number(item.precio || 0) * aplicar * pctHH;
      }, 0);
    }
    case 'dos_x_uno': {
      const totalItems2x1 = itemsElegibles.reduce((sum, item) => sum + item.cantidad, 0);
      if (totalItems2x1 < 2) return 0;
      const masBarato2x1 = itemsElegibles.reduce((min, item) =>
        Math.min(min, Number(item.precio || 0)), Infinity
      );
      return masBarato2x1 === Infinity ? 0 : masBarato2x1;
    }
    case 'tres_x_dos': {
      const totalItems3x2 = itemsElegibles.reduce((sum, item) => sum + item.cantidad, 0);
      if (totalItems3x2 < 3) return 0;
      const masBarato3x2 = itemsElegibles.reduce((min, item) =>
        Math.min(min, Number(item.precio || 0)), Infinity
      );
      return masBarato3x2 === Infinity ? 0 : masBarato3x2;
    }
    default:
      return 0;
  }
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
  const [pedidosPorCobrar, setPedidosPorCobrar] = useState([]);
  const [cargandoCobros, setCargandoCobros] = useState(false);
  const [cobrosModalOpen, setCobrosModalOpen] = useState(false);
  const [busquedaCobros, setBusquedaCobros] = useState('');
  const [filtroMesaCobros, setFiltroMesaCobros] = useState('');
  const [paginaCobros, setPaginaCobros] = useState(1);
  const [totalCobros, setTotalCobros] = useState(0);
  const [totalPaginasCobros, setTotalPaginasCobros] = useState(1);
  const [bloqueandoCobro, setBloqueandoCobro] = useState(null);
  const [errorCobro, setErrorCobro] = useState('');
  const [refetchCobros, setRefetchCobros] = useState(0);
  const [descExpandida, setDescExpandida] = useState(null);
  const navigate = useNavigate();
  const { addToast } = useToast();

  const token = localStorage.getItem('token');
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const headers = { Authorization: `Bearer ${token}` };

  useInactividad(300000, () => navigate('/login'));

  const IVA_TASA = 0.13;

  // Retorna null si el combo tiene stock suficiente,
  // o un string con el nombre del primer producto faltante
  const comboProductoFaltante = (combo, multiplicador = 1) => {
    if (!combo.items || combo.items.length === 0) return 'El combo no tiene productos';
    for (const item of combo.items) {
      const stock = Number(item.productos?.stock ?? 0);
      const necesita = item.cantidad * multiplicador;
      const nombre = item.productos?.nombre || 'Producto';
      if (stock <= 0) return nombre;
      if (stock < necesita) return nombre;
    }
    return null;
  };

  const subtotal = carrito.reduce((sum, item) => sum + (Number(item.precio_final || item.precio || 0) * item.cantidad), 0);
  const descuentoTotal = carrito.reduce((sum, item) => sum + (Number(item.descuento || 0) * item.cantidad), 0);
  const total = Math.max(0, subtotal - descuentoTotal);

  const iva = Math.round(carrito.reduce((sum, item) => {
    if (item.exento_iva) return sum;
    const precio = Number(item.precio_final || item.precio || 0);
    return sum + precio * item.cantidad * IVA_TASA;
  }, 0) * 100) / 100;

  const totalConIva = Math.max(0, Math.round((total + iva) * 100) / 100);

  const montoPago = pedidoActual ? Number(pedidoActual.total_con_iva || pedidoActual.total) : totalConIva;
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

  useEffect(() => {
    let cancelled = false;
    const fetchCobros = async () => {
      setCargandoCobros(true);
      setErrorCobro('');
      try {
        const params = { page: paginaCobros, limit: 20 };
        if (busquedaCobros) params.search = busquedaCobros;
        if (filtroMesaCobros) params.mesa = filtroMesaCobros;
        const res = await axios.get(`${API}/api/caja/cobros-pendientes`, { params, headers });
        if (cancelled) return;
        setPedidosPorCobrar(res.data.data || []);
        setTotalCobros(res.data.total || 0);
        setTotalPaginasCobros(res.data.totalPages || 1);
      } catch {
        if (!cancelled) setErrorCobro('Error al cargar cobros pendientes');
      } finally {
        if (!cancelled) setCargandoCobros(false);
      }
    };
    fetchCobros();
    return () => { cancelled = true; };
  }, [paginaCobros, busquedaCobros, filtroMesaCobros, refetchCobros]);

  const handlePromosActualizadas = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/promociones`, { headers });
      setPromociones(data || []);
      setCarrito(prev => {
        const idsEnCartel = prev.filter(i => i.tipo === 'promocion').map(p => p.id);
        const ahora = new Date().toTimeString().slice(0, 5);
        let cart = [...prev];
        for (const promo of (data || [])) {
          if (!promo.activo || !promo.automatica) continue;
          if (idsEnCartel.includes(promo.id)) continue;
          if (promo.tipo === 'happy_hour' && promo.hora_inicio && promo.hora_fin) {
            if (ahora < promo.hora_inicio || ahora > promo.hora_fin) continue;
          }
          const descuento = calcularDescuentoPromocion(promo, cart);
          if (descuento > 0) {
            cart = [...cart, { ...promo, tipo: 'promocion', cantidad: 1, precio: 0, precio_final: 0, descuento }];
          }
        }
        return cart;
      });
    } catch {}
  }, []);

  useSocket({
    promociones_actualizadas: handlePromosActualizadas,
  });

  useCobrosSocket({
    onCobroIniciado: (data) => {
      setPedidosPorCobrar(prev =>
        prev.map(p => p.id === data.pedido_id ? {
          ...p, bloqueo_usuario_id: data.usuario_id,
          bloqueado_por_nombre: data.usuario_nombre,
          bloqueo_iniciado_en: data.iniciado_en,
        } : p)
      );
    },
    onBloqueoLiberado: (data) => {
      setPedidosPorCobrar(prev =>
        prev.map(p => p.id === data.pedido_id ? {
          ...p, bloqueo_usuario_id: null,
          bloqueado_por_nombre: null,
          bloqueo_iniciado_en: null,
        } : p)
      );
    },
    onPedidoPagado: (data) => {
      setPedidosPorCobrar(prev => prev.filter(p => p.id !== data.id));
    },
    onCambioEstado: (data) => {
      if (data.estado === 'listo' || data.estado === 'entregado') {
        setRefetchCobros(prev => prev + 1);
      }
      if (data.estado === 'pagado' || data.estado === 'cancelado') {
        setPedidosPorCobrar(prev => prev.filter(p => p.pedido_id === data.pedido_id));
      }
    },
  });

  const agregarAutoPromos = (cart, esProducto) => {
    if (!esProducto) return cart;

    const idsEnCartel = cart.filter(i => i.tipo === 'promocion').map(p => p.id);
    const ahora = new Date().toTimeString().slice(0, 5);

    for (const promo of promociones) {
      if (!promo.activo || !promo.automatica) continue;
      if (idsEnCartel.includes(promo.id)) continue;
      if (promo.tipo === 'happy_hour' && promo.hora_inicio && promo.hora_fin) {
        if (ahora < promo.hora_inicio || ahora > promo.hora_fin) continue;
      }

      const descuento = calcularDescuentoPromocion(promo, cart);
      if (descuento > 0) {
        cart = [...cart, { ...promo, tipo: 'promocion', cantidad: 1, precio: 0, precio_final: 0, descuento }];
      }
    }
    return cart;
  };

  const agregarAlCarrito = (item, tipo) => {
    if (tipo === 'producto' && item.stock !== undefined && Number(item.stock) <= 0) {
      addToast(`"${item.nombre}" no tiene stock disponible`, 'error');
      return;
    }
    if (tipo === 'combo') {
      const faltante = comboProductoFaltante(item);
      if (faltante) {
        addToast(`"${faltante}" no tiene stock suficiente para el combo`, 'error');
        return;
      }
    }

    const idx = carrito.findIndex(i => i.id === item.id && i.tipo === tipo);
    if (idx >= 0) {
      if (tipo === 'promocion') {
        addToast('La promocion ya esta en el carrito', 'info');
        return;
      }
      if (tipo === 'producto' && item.stock !== undefined && (carrito[idx].cantidad + 1) > Number(item.stock)) {
        addToast('No puedes excederte del stock actual', 'error');
        return;
      }
      if (tipo === 'combo') {
        const nuevaCantidad = carrito[idx].cantidad + 1;
        const faltante = comboProductoFaltante(item, nuevaCantidad);
        if (faltante) {
          addToast(`Stock insuficiente para ${nuevaCantidad} combo(s): falta "${faltante}"`, 'error');
          return;
        }
      }
      const nuevo = [...carrito];
      nuevo[idx] = { ...nuevo[idx], cantidad: nuevo[idx].cantidad + 1 };
      if (tipo === 'producto') {
        const idsAuto = promociones.filter(p => p.automatica).map(p => p.id);
        const sinAuto = nuevo.filter(i => i.tipo !== 'promocion' || !idsAuto.includes(i.id));
        setCarrito(agregarAutoPromos(sinAuto, true));
      } else {
        setCarrito(nuevo);
      }
      return;
    }

    if (tipo === 'promocion') {
      const descuento = calcularDescuentoPromocion(item, carrito);
      if (descuento <= 0) {
        addToast('No hay productos elegibles para esta promoción', 'info');
        return;
      }
      addToast(`Promoción aplicada: $${descuento.toFixed(2)} de descuento`, 'success');
      setCarrito([...carrito, { ...item, tipo, cantidad: 1, precio: 0, precio_final: 0, descuento }]);
      return;
    }

    setCarrito(agregarAutoPromos([...carrito, { ...item, tipo, cantidad: 1 }], tipo === 'producto'));
  };

  const cambiarCantidad = (idx, delta) => {
    const item = carrito[idx];
    if (!item) return;

    if (item.tipo === 'promocion') {
      if (delta < 0) setCarrito(prev => prev.filter((_, i) => i !== idx));
      return;
    }

    const val = (item.cantidad || 1) + delta;
    if (val <= 0) {
      setCarrito(prev => prev.filter((_, i) => i !== idx));
      return;
    }

    if (delta > 0 && item.stock !== undefined && val > Number(item.stock)) {
      addToast('No puedes excederte del stock actual', 'error');
      return;
    }

    if (delta > 0 && item.tipo === 'combo') {
      const faltante = comboProductoFaltante(item, val);
      if (faltante) {
        addToast(`Stock insuficiente para ${val} combo(s): falta "${faltante}"`, 'error');
        return;
      }
    }

    const nuevo = [...carrito];
    nuevo[idx] = { ...nuevo[idx], cantidad: val };
    if (item.tipo === 'producto') {
      const idsAuto = promociones.filter(p => p.automatica).map(p => p.id);
      const sinAuto = nuevo.filter(i => i.tipo !== 'promocion' || !idsAuto.includes(i.id));
      setCarrito(agregarAutoPromos(sinAuto, true));
    } else {
      setCarrito(nuevo);
    }
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
      const promocionesAplicadas = carrito
        .filter(i => i.tipo === 'promocion')
        .map(i => ({
          promocion_id: i.id,
          monto: i.descuento || 0,
          nombre: i.nombre,
        }));

      const body = {
        items: carrito.map(i => ({
          id: i.id,
          tipo: i.tipo,
          nombre: i.nombre,
          precio: i.precio_final || i.precio || 0,
          descuento: i.descuento || 0,
          cantidad: i.cantidad,
        })),
        promociones_aplicadas: promocionesAplicadas.length > 0 ? promocionesAplicadas : undefined,
        tipo: tipoPedido,
        mesa_id: mesaId || null,
        cliente_nombre: clienteNombre || null,
        notas: notas || null,
      };
      const res = await axios.post(`${API}/pedidos`, body, { headers });
      setPedidoActual(res.data);
      setCarrito([]);
      await recargarMesas();
      setModal(null);
      addToast(`Pedido #${res.data.numero_ticket} creado exitosamente`, 'success');
    } catch (err) {
      console.error('Error al crear pedido:', err);
      addToast(err.response?.data?.error || 'Error al crear pedido', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleIniciarCobro = async (pedido) => {
    setBloqueandoCobro(pedido.id);
    setErrorCobro('');
    try {
      await axios.post(`${API}/api/caja/iniciar-cobro`, {
        pedido_id: pedido.id,
      }, { headers });
      setPedidosPorCobrar(prev =>
        prev.map(p => p.id === pedido.id ? {
          ...p, bloqueo_usuario_id: usuario.id || 1,
          bloqueado_por_nombre: usuario.nombre || 'Cajero',
          bloqueo_iniciado_en: new Date().toISOString(),
        } : p)
      );
      addToast(`Cobro iniciado para pedido #${pedido.numero_ticket}`, 'success');
    } catch (err) {
      const data = err.response?.data;
      if (data?.bloqueado_por_nombre) {
        addToast(`El pedido #${pedido.numero_ticket} ya está siendo cobrado por ${data.bloqueado_por_nombre}`, 'error');
        setPedidosPorCobrar(prev =>
          prev.map(p => p.id === pedido.id ? {
            ...p, bloqueo_usuario_id: data.bloqueado_por,
            bloqueado_por_nombre: data.bloqueado_por_nombre,
            bloqueo_iniciado_en: data.bloqueo_iniciado_en,
          } : p)
        );
      } else if (data?.error && err.response?.status && err.response.status < 500) {
        addToast(data.error, 'error');
      } else {
        console.warn('Error al iniciar cobro (no crítico):', err.response?.status, data?.error || '', err);
      }
    } finally {
      setBloqueandoCobro(null);
    }
  };

  const handleLiberarBloqueo = async (pedido) => {
    try {
      await axios.post(`${API}/api/caja/liberar-bloqueo`, {
        pedido_id: pedido.id,
      }, { headers });
      setPedidosPorCobrar(prev =>
        prev.map(p => p.id === pedido.id ? {
          ...p, bloqueo_usuario_id: null,
          bloqueado_por_nombre: null,
          bloqueo_iniciado_en: null,
        } : p)
      );
      addToast(`Bloqueo liberado para pedido #${pedido.numero_ticket}`, 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Error al liberar bloqueo', 'error');
    }
  };

  const handlePagoExitoso = () => {
    setRefetchCobros(prev => prev + 1);
  };

  const tiempoDesdeCreado = (fecha) => {
    if (!fecha) return '';
    const segs = Math.floor((Date.now() - new Date(fecha).getTime()) / 1000);
    if (segs < 60) return `${segs}s`;
    if (segs < 3600) return `${Math.floor(segs / 60)}m`;
    return `${Math.floor(segs / 3600)}h ${Math.floor((segs % 3600) / 60)}m`;
  };

  const esMioElBloqueo = (pedido) => {
    return pedido.bloqueo_usuario_id && (pedido.bloqueo_usuario_id === usuario.id || usuario.rol === 'Admin');
  };

  const estadoLabel = {
    listo: 'Listo', entregado: 'Entregado',
    pagando: 'En proceso',
  };

  const estadoBadgeClass = {
    listo: 'badge-warning', entregado: 'badge-primary',
    pagando: 'badge badge--pagando',
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
      setPedidosPorCobrar(prev => prev.filter(p => p.id !== pedidoActual.id));
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

  const generarTicketHTML = (pedido) => {
    const tipoLabel = {
      en_mesa: 'En Mesa', para_llevar: 'Para Llevar',
      para_recoger: 'Para Recoger', domicilio: 'Domicilio',
    };
    const pagoLabel = {
      efectivo: 'Efectivo', tarjeta: 'Tarjeta', qr: 'QR',
      billetera_digital: 'Billetera Digital', transferencia: 'Transferencia',
    };
    const total = Number(pedido.total_con_iva || pedido.total);
    const propina = Number(pedido.pagos?.[0]?.propina || 0);
    const metodoPago = pedido.pagos?.[0]?.metodo || '';
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
    ${propina > 0 ? `<tr><td>Propina</td><td>$${propina.toFixed(2)}</td></tr>` : ''}
    <tr><td>TOTAL</td><td>$${total.toFixed(2)}</td></tr>
  </table>
  <div class="footer">
    <p>Tipo: ${tipoLabel[pedido.tipo] || pedido.tipo}</p>
    ${pedido.cliente_nombre ? `<p>Cliente: ${pedido.cliente_nombre}</p>` : ''}
    ${metodoPago ? `<p>Pago: ${pagoLabel[metodoPago] || metodoPago}</p>` : ''}
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

  const renderItem = (item, tipo) => {
    let sinStock = false;
    let stockBajo = false;
    if (tipo === 'producto') {
      sinStock = item.stock !== undefined && Number(item.stock) <= 0;
      stockBajo = item.stock !== undefined && Number(item.stock) <= Number(item.stock_minimo) && Number(item.stock) > 0;
    } else if (tipo === 'combo') {
      sinStock = comboProductoFaltante(item) !== null;
    }
    return (
      <div
        key={`${tipo}-${item.id}`}
        className={`pos-product-card${sinStock ? ' pos-product-card--disabled' : ''}`}
        onClick={() => agregarAlCarrito(item, tipo)}
      >
        {item.imagen_url ? (
          <img src={item.imagen_url} alt={item.nombre} className="pos-product-img" loading="lazy" />
        ) : (
          <div className="pos-product-img-placeholder" />
        )}
        <div className="pos-product-header">
          <span className="pos-product-name">{item.nombre}</span>
          {(sinStock || stockBajo) && (
            <span className={`pos-stock-badge ${sinStock ? 'pos-stock-badge--out' : 'pos-stock-badge--low'}`}>
              {sinStock ? 'Sin stock' : 'Stock bajo'}
            </span>
          )}
        </div>
        {item.descripcion && (() => {
          const descKey = `${tipo}-${item.id}`;
          return (
            <span
              className={`pos-product-desc${descExpandida === descKey ? ' expanded' : ''}`}
              title={item.descripcion}
              onClick={(e) => { e.stopPropagation(); setDescExpandida(prev => prev === descKey ? null : descKey); }}
            >
              {item.descripcion}
            </span>
          );
        })()}
        <div className="pos-product-footer">
          <span className="pos-product-price">
            ${Number(item.precio).toFixed(2)}
          </span>
          {tipo === 'producto' && item.stock !== undefined && Number(item.stock) > Number(item.stock_minimo) && (
            <span className="pos-stock-count">{item.stock} uds</span>
          )}
        </div>
      </div>
    );
  };

  const renderPromo = (promo) => {
    const info = TIPOS_PROMO[promo.tipo] || { label: promo.tipo, icon: PartyPopper, tone: 'neutral' };
    const IconComp = info.icon;
    let descText = promo.valor && (promo.tipo === 'descuento_porcentaje' || promo.tipo === 'happy_hour')
      ? ` - ${promo.valor}% OFF` : '';
    if (promo.cantidad_maxima) descText += ` (max ${promo.cantidad_maxima} uds)`;
    const inactiva = !promo.activo;
    return (
      <div
        key={`promo-${promo.id}`}
        className={`pos-promo-card pos-promo-card--${info.tone}${inactiva ? ' pos-promo-card--inactive' : ''}`}
        onClick={() => !inactiva && agregarAlCarrito(promo, 'promocion')}
      >
        {inactiva && <span className="pos-promo-card__badge">NO DISPONIBLE</span>}
        <span className="pos-promo-name">
          <IconComp size={18} /> {promo.nombre}
        </span>
        <span className="pos-promo-desc">
          {info.label}{descText}
        </span>
        <span className="pos-promo-price">
          {info.label}
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
        <main className="main-content">
          <div className="pos-header">
            <div>
              <span className="skeleton" style={{display:'inline-block', width:200, height:24, borderRadius:6}}>&nbsp;</span>
            </div>
          </div>
          <div className="pos-tabs">
            <span className="skeleton" style={{display:'inline-block', width:100, height:36, borderRadius:6}}>&nbsp;</span>
            <span className="skeleton" style={{display:'inline-block', width:100, height:36, borderRadius:6}}>&nbsp;</span>
            <span className="skeleton" style={{display:'inline-block', width:100, height:36, borderRadius:6}}>&nbsp;</span>
          </div>
          <div className="pos-search-bar">
            <span className="skeleton" style={{flex:1, height:48, borderRadius:8}}>&nbsp;</span>
            <span className="skeleton" style={{width:160, height:48, borderRadius:8}}>&nbsp;</span>
          </div>
          <div className="pos-grid" style={{padding:'0 24px'}}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="skeleton-card" style={{padding:12, gap:8}}>
                <span className="skeleton skeleton-img">&nbsp;</span>
                <span className="skeleton skeleton-line skeleton-line--md">&nbsp;</span>
                <span className="skeleton skeleton-line skeleton-line--sm">&nbsp;</span>
              </div>
            ))}
          </div>
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

        <CobrosPendientesModal
          open={cobrosModalOpen}
          onClose={() => setCobrosModalOpen(false)}
          pedidosPorCobrar={pedidosPorCobrar}
          cargandoCobros={cargandoCobros}
          totalCobros={totalCobros}
          paginaCobros={paginaCobros}
          totalPaginasCobros={totalPaginasCobros}
          errorCobro={errorCobro}
          busquedaCobros={busquedaCobros}
          filtroMesaCobros={filtroMesaCobros}
          bloqueandoCobro={bloqueandoCobro}
          onSearchChange={(val) => { setBusquedaCobros(val); setPaginaCobros(1); }}
          onFilterMesaChange={(val) => { setFiltroMesaCobros(val); setPaginaCobros(1); }}
          onPageChange={setPaginaCobros}
          onRefresh={() => setRefetchCobros(prev => prev + 1)}
          onIniciarCobro={handleIniciarCobro}
          onLiberarBloqueo={handleLiberarBloqueo}
          procesandoPago={procesandoPago}
          setProcesandoPago={setProcesandoPago}
          usuario={usuario}
          esMioElBloqueo={esMioElBloqueo}
          tiempoDesdeCreado={tiempoDesdeCreado}
          estadoLabel={estadoLabel}
          estadoBadgeClass={estadoBadgeClass}
        />

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
              <div className="pos-tabs-spacer" />
              <button
                className="pos-tab-btn pos-tab-btn--cobros"
                onClick={() => setCobrosModalOpen(true)}
                title="Cobros Pendientes"
              >
                <Receipt size={18} />
                <span>Cobros pendientes</span>
                {totalCobros > 0 && (
                  <span className="pos-tab-badge">{totalCobros}</span>
                )}
              </button>
            </div>

            <div className="pos-search-bar">
              <input
                type="text"
                className="pos-search-input"
                placeholder="Buscar productos..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                autoFocus
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
        </div>

        {carrito.length > 0 && (
          <div className="pos-cart-bar" onClick={() => setCartOpen(true)} role="button" tabIndex={0} aria-label="Abrir carrito">
            <div className="pos-cart-bar-left">
              <ShoppingBag size={18} />
              <span className="pos-cart-bar-count">{carrito.reduce((s, i) => s + i.cantidad, 0)} items</span>
            </div>
            <div className="pos-cart-bar-right">
              <span className="pos-cart-bar-total">${totalConIva.toFixed(2)}</span>
              <span className="pos-cart-bar-arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </span>
            </div>
          </div>
        )}

        <div className={`pos-cart-drawer-overlay${cartOpen ? ' open' : ''}`} onClick={() => setCartOpen(false)} />

        <div className={`pos-cart-drawer${cartOpen ? ' open' : ''}`} aria-live="polite">
          <div className="pos-cart-drawer-header">
            <span className="pos-cart-drawer-title">
              Carrito ({carrito.reduce((s, i) => s + i.cantidad, 0)} items)
            </span>
            <button className="pos-cart-drawer-close" onClick={() => setCartOpen(false)} aria-label="Cerrar carrito">
              <X size={20} />
            </button>
          </div>

          <div className="pos-cart-drawer-items">
            {carrito.length === 0 ? (
              <div className="pos-cart-empty">
                <ShoppingBag size={40} style={{opacity:0.3, marginBottom:8}} />
                <span>Agrega productos para iniciar el pedido</span>
              </div>
            ) : (
              carrito.map((item, idx) => (
                <div key={idx} className="pos-cart-item">
                  {item.imagen_url ? (
                    <img src={item.imagen_url} alt={item.nombre} className="pos-cart-item-img" loading="lazy" />
                  ) : (
                    <div className="pos-cart-item-img-placeholder" />
                  )}
                  <div className="pos-cart-item-info">
                    <span className="pos-cart-item-name">{item.nombre}</span>
                    <span className="pos-cart-item-price">
                      ${(Number(item.precio_final || item.precio || 0) * item.cantidad).toFixed(2)}
                    </span>
                  </div>
                  <div className="pos-cart-qty">
                    <button className="pos-qty-btn" onClick={() => cambiarCantidad(idx, -1)} aria-label="Restar">−</button>
                    <span className="pos-qty-count">{item.cantidad}</span>
                    <button className="pos-qty-btn" onClick={() => cambiarCantidad(idx, 1)} aria-label="Sumar">+</button>
                    <button className="pos-qty-btn pos-qty-btn--remove" onClick={() => quitarDelCarrito(idx)} aria-label="Quitar">
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {carrito.length > 0 && (
            <div className="pos-cart-drawer-footer">
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
                <div className="pos-totals-row">
                  <span>IVA 13%</span>
                  <span>${iva.toFixed(2)}</span>
                </div>
                <div className="pos-totals-row pos-totals-row--total">
                  <span>Total</span>
                  <span>${totalConIva.toFixed(2)}</span>
                </div>
              </div>
              <button className="pos-btn-process" onClick={abrirModalTipo} disabled={carrito.length === 0}>
                Procesar Pedido &mdash; ${totalConIva.toFixed(2)}
              </button>
            </div>
          )}
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
                <div className="pos-totals-row">
                  <span>IVA 13%</span>
                  <span>${iva.toFixed(2)}</span>
                </div>
                <div className="pos-totals-row pos-totals-row--total">
                  <span>Total con IVA</span>
                  <span>${totalConIva.toFixed(2)}</span>
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

              <label className="pos-label">Propina (voluntaria)</label>
              <div className="pos-tip-group">
                <button
                  className={`pos-tip-btn${propina === 0 ? ' active' : ''}`}
                  onClick={() => setPropina(0)}
                >
                  Sin propina
                </button>
                <div className="pos-tip-input-wrap">
                  <span className="pos-tip-currency">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={propina || ''}
                    onChange={e => setPropina(Number(e.target.value) || 0)}
                    className="pos-input"
                    placeholder="0.00"
                  />
                </div>
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

              <div className="pos-ticket-actions">
                <button className="pos-btn-ticket pos-btn-ticket--print" onClick={() => imprimirTicket(pedidoActual)}>
                  <Printer size={16} /> Imprimir
                </button>
                <button className="pos-btn-ticket pos-btn-ticket--download" onClick={() => descargarTicket(pedidoActual)}>
                  <Download size={16} /> Descargar
                </button>
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
