const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const reportesController = require('../controllers/reportesController');

router.get('/ventas', auth, reportesController.obtenerVentasPorPeriodo);
router.get('/productos', auth, reportesController.obtenerProductosMasVendidos);
router.get('/inventario', auth, reportesController.obtenerMovimientosInventario);
router.get('/caja', auth, reportesController.obtenerResumenCaja);

module.exports = router;
