const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRol } = require('../middleware/auth');
const ctrl = require('../controllers/ingredientesController');

router.use(auth);

router.get('/',                    ctrl.listar);
router.get('/:id',                ctrl.obtener);
router.post('/',    requireRol('Admin'), ctrl.crear);
router.put('/:id',  requireRol('Admin'), ctrl.actualizar);
router.delete('/:id', requireRol('Admin'), ctrl.eliminar);
router.patch('/:id/stock', requireRol('Admin'), ctrl.ajustarStock);
router.get('/:id/movimientos',   ctrl.movimientos);

module.exports = router;
