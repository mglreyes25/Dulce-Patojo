const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRol } = require('../middleware/auth');
const { registrarPago } = require('../controllers/pagosController');

router.post('/', auth, requireRol('Admin', 'Cajero'), registrarPago);

module.exports = router;
