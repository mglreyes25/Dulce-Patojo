const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');
const {
  obtenerInventario,
  obtenerMovimientos,
  registrarEntrada,
  registrarSalida,
  ajustarStock,
  actualizarStockMinimo,
} = require('../controllers/inventarioController');

router.get('/',                  auth, requireAdmin, obtenerInventario);
router.get('/movimientos/:producto_id', auth, requireAdmin, obtenerMovimientos);
router.post('/entrada',          auth, requireAdmin, registrarEntrada);
router.post('/salida',           auth, requireAdmin, registrarSalida);
router.post('/ajuste',           auth, requireAdmin, ajustarStock);
router.put('/stock-minimo',      auth, requireAdmin, actualizarStockMinimo);

module.exports = router;
