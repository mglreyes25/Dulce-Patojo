const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');
const {
  obtenerCategorias, crearCategoria,
  obtenerProductos, obtenerProductoPorId, crearProducto, actualizarProducto,
  toggleDisponible, obtenerHistorialPrecios,
  actualizarPreciosMasivo, revertirUltimoPrecio,
  obtenerCombos, crearCombo, actualizarCombo, toggleCombo,
  eliminarProducto
} = require('../controllers/productosController');
const { subirImagen } = require('../controllers/uploadController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten archivos de imagen'), false);
  },
});

// ── Upload ─────────────────────────────────────────────────────────
router.post('/upload-imagen', auth, requireAdmin, upload.single('imagen'), subirImagen);

// ── Categorías ─────────────────────────────────────────────────────
router.get('/categorias',  auth, obtenerCategorias);
router.post('/categorias', auth, requireAdmin, crearCategoria);

// ── Precios masivos (antes de /:id para evitar conflicto) ──────────
router.post('/precios/masivo',      auth, requireAdmin, actualizarPreciosMasivo);

// ── Combos (antes de /:id) ─────────────────────────────────────────
router.get('/combos/lista',          auth, obtenerCombos);
router.post('/combos',               auth, requireAdmin, crearCombo);
router.put('/combos/:id',            auth, requireAdmin, actualizarCombo);
router.patch('/combos/:id/toggle',   auth, requireAdmin, toggleCombo);

// ── Productos ──────────────────────────────────────────────────────
router.get('/',                      auth, obtenerProductos);
router.get('/:id',                   auth, obtenerProductoPorId);
router.post('/',                     auth, requireAdmin, crearProducto);
router.put('/:id',                   auth, requireAdmin, actualizarProducto);
router.patch('/:id/toggle',          auth, requireAdmin, toggleDisponible);
router.delete('/:id',                auth, requireAdmin, eliminarProducto);
router.get('/:id/historial',         auth, requireAdmin, obtenerHistorialPrecios);
router.post('/:id/revertir-precio',  auth, requireAdmin, revertirUltimoPrecio);

module.exports = router;