const express = require('express');
const { login, logout, verificarToken, registroPublico } = require('../controllers/authController');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/login',           login);
router.post('/registro-publico', registroPublico);
router.post('/logout',          auth, logout);
router.get('/verify',           auth, verificarToken);

module.exports = router;