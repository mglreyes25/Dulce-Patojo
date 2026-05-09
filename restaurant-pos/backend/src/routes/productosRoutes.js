const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');
const {
  obtenerCategorias, crearCategoria,
  obtenerProductos, obtenerProductoPorId, crearProducto, actualizarProducto,
  toggleDisponible, obtenerHistorialPrecios,
  obtenerCombos, crearCombo, actualizarCombo, toggleCombo
} = require('../controllers/productosController');
const { subirImagen } = require('../controllers/uploadController');

// multer en memoria — sin escribir en disco
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB máximo
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten archivos de imagen'), false);
  },
});

// ── Upload de imagen ───────────────────────────────────────────────
router.post('/upload-imagen', auth, requireAdmin, upload.single('imagen'), subirImagen);

// ── Categorías ─────────────────────────────────────────────────────
router.get('/categorias',  auth, obtenerCategorias);
router.post('/categorias', auth, requireAdmin, crearCategoria);

// ── Combos (declarados ANTES de /:id para evitar conflicto de rutas)
router.get('/combos/lista',      auth, obtenerCombos);
router.post('/combos',           auth, requireAdmin, crearCombo);
router.put('/combos/:id',        auth, requireAdmin, actualizarCombo);
router.patch('/combos/:id/toggle', auth, requireAdmin, toggleCombo);

// ── Productos ──────────────────────────────────────────────────────
router.get('/',              auth, obtenerProductos);
router.get('/:id',           auth, obtenerProductoPorId);
router.post('/',             auth, requireAdmin, crearProducto);
router.put('/:id',           auth, requireAdmin, actualizarProducto);
router.patch('/:id/toggle',  auth, requireAdmin, toggleDisponible);
router.get('/:id/historial', auth, requireAdmin, obtenerHistorialPrecios);

module.exports = router;