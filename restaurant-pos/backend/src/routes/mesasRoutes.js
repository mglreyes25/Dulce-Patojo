const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');
const {
  obtenerMesas, crearMesa, actualizarMesa, cambiarEstadoMesa,
} = require('../controllers/mesasController');

router.get('/',              auth, obtenerMesas);
router.post('/',             auth, requireAdmin, crearMesa);
router.put('/:id',           auth, requireAdmin, actualizarMesa);
router.patch('/:id/estado',  auth, cambiarEstadoMesa);

module.exports = router;
