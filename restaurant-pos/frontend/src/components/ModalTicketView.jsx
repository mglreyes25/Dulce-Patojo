import { Printer, Download, X } from 'lucide-react';

const tipoLabel = {
  en_mesa: 'En Mesa', para_llevar: 'Para Llevar',
  para_recoger: 'Para Recoger', domicilio: 'Domicilio',
};
const pagoLabel = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', qr: 'QR',
  billetera_digital: 'Billetera Digital', transferencia: 'Transferencia',
};

export default function ModalTicketView({ pedido, onClose }) {
  const items = pedido.pedido_items || pedido.items_resumen || [];
  const total = Number(pedido.total_con_iva || pedido.total || 0);
  const propina = Number(pedido.pagos?.[0]?.propina || 0);
  const metodoPago = pedido.pagos?.[0]?.metodo || '';

  const generarTicketHTML = () => {
    const itemsHtml = items.map(item =>
      `<tr><td style="text-align:left">${item.cantidad}x ${item.nombre}</td><td style="text-align:right">$${(Number(item.precio_unitario || item.precio || 0) * item.cantidad).toFixed(2)}</td></tr>`
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
    <tr><td>Subtotal</td><td>$${Number(pedido.subtotal || 0).toFixed(2)}</td></tr>
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

  const imprimirTicket = () => {
    const html = generarTicketHTML();
    const win = window.open('', '_blank', 'width=400,height=600');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 500);
    }
  };

  const descargarTicket = () => {
    const html = generarTicketHTML();
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

  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div className="pos-ticket-modal" onClick={e => e.stopPropagation()}>
        <div className="pos-ticket-header-row">
          <h2 className="pos-ticket-brand">Dulce Patojo</h2>
          <button className="pos-cart-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <p className="pos-ticket-subtitle">Sistema POS — Ticket de Venta</p>
        <div className="pos-ticket-divider" />
        <p className="pos-ticket-number">#{String(pedido.numero_ticket).padStart(3, '0')}</p>
        <p className="pos-ticket-date">{new Date(pedido.creado_en).toLocaleString('es-SV')}</p>

        <div className="pos-ticket-items pos-ticket-divider">
          {items.map((item, i) => (
            <div key={i} className="pos-ticket-item">
              <span>{item.cantidad}x {item.nombre}</span>
              <span>${(Number(item.precio_unitario || item.precio || 0) * item.cantidad).toFixed(2)}</span>
            </div>
          ))}
          {items.length === 0 && (
            <p className="pos-ticket-empty">Sin items</p>
          )}
        </div>

        <div className="pos-ticket-totals">
          <div className="pos-ticket-total-row">
            <span>Subtotal</span>
            <span>${Number(pedido.subtotal || 0).toFixed(2)}</span>
          </div>
          {Number(pedido.descuento) > 0 && (
            <div className="pos-ticket-total-row pos-ticket-total-row--discount">
              <span>Descuento</span>
              <span>-${Number(pedido.descuento).toFixed(2)}</span>
            </div>
          )}
          {Number(pedido.iva || 0) > 0 && (
            <div className="pos-ticket-total-row pos-ticket-total-row--muted">
              <span>IVA 13%</span>
              <span>${Number(pedido.iva).toFixed(2)}</span>
            </div>
          )}
          {propina > 0 && (
            <div className="pos-ticket-total-row pos-ticket-total-row--muted">
              <span>Propina</span>
              <span>$${propina.toFixed(2)}</span>
            </div>
          )}
          <div className="pos-ticket-grand-total">
            <span>TOTAL</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        <div className="pos-ticket-footer">
          <p>Tipo: {tipoLabel[pedido.tipo] || pedido.tipo}</p>
          {pedido.cliente_nombre && <p>Cliente: {pedido.cliente_nombre}</p>}
          {(pedido.mesa_numero || pedido.mesa?.numero) && <p>Mesa: {pedido.mesa_numero || pedido.mesa?.numero}</p>}
        </div>

        <div className="pos-ticket-actions">
          <button className="pos-btn-ticket pos-btn-ticket--print" onClick={imprimirTicket}>
            <Printer size={16} /> Imprimir
          </button>
          <button className="pos-btn-ticket pos-btn-ticket--download" onClick={descargarTicket}>
            <Download size={16} /> Descargar
          </button>
        </div>
        <button className="pos-btn-close-ticket" onClick={onClose}>
          Cerrar Ticket
        </button>
      </div>
    </div>
  );
}
