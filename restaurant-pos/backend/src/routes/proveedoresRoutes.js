const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRol } = require('../middleware/auth');
const ctrl = require('../controllers/proveedoresController');

router.get('/',    auth, ctrl.listar);
router.post('/',   auth, requireRol('Admin'), ctrl.crear);
router.put('/:id', auth, requireRol('Admin'), ctrl.actualizar);
router.delete('/:id', auth, requireRol('Admin'), ctrl.eliminar);

module.exports = router;
