const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRol } = require('../middleware/auth');
const {
  obtenerCobrosPendientes,
  iniciarCobro,
  liberarBloqueo,
  obtenerLogEstados,
} = require('../controllers/cajaController');

router.get('/cobros-pendientes', auth, requireRol('Admin', 'Cajero'), obtenerCobrosPendientes);
router.post('/iniciar-cobro', auth, requireRol('Admin', 'Cajero'), iniciarCobro);
router.post('/liberar-bloqueo', auth, requireRol('Admin', 'Cajero'), liberarBloqueo);
router.get('/pedidos/:id/log', auth, requireRol('Admin', 'Cajero'), obtenerLogEstados);

module.exports = router;
