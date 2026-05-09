const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');
const {
  obtenerCategorias, crearCategoria,
  obtenerProductos, obtenerProductoPorId, crearProducto, actualizarProducto,
  toggleDisponible, obtenerHistorialPrecios,
  obtenerCombos, crearCombo, actualizarCombo, toggleCombo
} = require('../controllers/productosController');

// Categorías
router.get('/categorias', auth, obtenerCategorias);
router.post('/categorias', auth, requireAdmin, crearCategoria);

// Productos
router.get('/', auth, obtenerProductos);
router.get('/:id', auth, obtenerProductoPorId);
router.post('/', auth, requireAdmin, crearProducto);
router.put('/:id', auth, requireAdmin, actualizarProducto);
router.patch('/:id/toggle', auth, requireAdmin, toggleDisponible);
router.get('/:id/historial', auth, requireAdmin, obtenerHistorialPrecios);

// Combos
router.get('/combos/lista', auth, obtenerCombos);
router.post('/combos', auth, requireAdmin, crearCombo);
router.put('/combos/:id', auth, requireAdmin, actualizarCombo);
router.patch('/combos/:id/toggle', auth, requireAdmin, toggleCombo);

module.exports = router;
