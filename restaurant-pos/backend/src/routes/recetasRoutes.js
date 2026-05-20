const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRol } = require('../middleware/auth');
const ctrl = require('../controllers/recetasController');

router.get('/',  auth, ctrl.listar);
router.post('/', auth, requireRol('Admin'), ctrl.guardar);

module.exports = router;
