const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRol } = require('../middleware/auth');
const {
  obtenerPedidos, obtenerPedidoPorId, obtenerProximoTicket,
  crearPedido, cambiarEstadoPedido,
  procesarPago, obtenerTicket, reimprimirTicket,
} = require('../controllers/pedidosController');

router.get('/contador-ticket', auth, obtenerProximoTicket);
router.get('/',                 auth, obtenerPedidos);
router.get('/:id',              auth, obtenerPedidoPorId);
router.post('/',                auth, requireRol('Admin', 'Cajero'), crearPedido);
router.patch('/:id/estado',     auth, cambiarEstadoPedido);
router.post('/:id/pagar',       auth, requireRol('Admin', 'Cajero'), procesarPago);
router.get('/:id/ticket',       auth, obtenerTicket);
router.post('/:id/reimprimir',  auth, requireRol('Admin', 'Cajero'), reimprimirTicket);

module.exports = router;
