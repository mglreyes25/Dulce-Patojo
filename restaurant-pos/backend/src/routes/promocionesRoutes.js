const express = require('express');
const router  = express.Router();
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');
const {
  obtenerPromociones,
  obtenerPromocionesActivas,
  crearPromocion,
  actualizarPromocion,
  togglePromocion,
  eliminarPromocion
} = require('../controllers/promocionesController');

router.get('/',        auth, obtenerPromociones);
router.get('/activas', auth, obtenerPromocionesActivas);
router.post('/',       auth, requireAdmin, crearPromocion);
router.put('/:id',     auth, requireAdmin, actualizarPromocion);
router.patch('/:id/toggle', auth, requireAdmin, togglePromocion);
router.delete('/:id',  auth, requireAdmin, eliminarPromocion);

module.exports = router;
