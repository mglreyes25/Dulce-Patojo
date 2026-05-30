const express = require('express');
const {
  obtenerUsuarios, obtenerUsuarioPorId,
  crearUsuario, actualizarUsuario,
  inactivarUsuario, activarUsuario,
  eliminarUsuario, obtenerUsuariosOnline
} = require('../controllers/usuariosController');
const authMiddleware = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/',                  authMiddleware, requireAdmin, obtenerUsuarios);
router.get('/online',            authMiddleware, obtenerUsuariosOnline);
router.get('/:id',               authMiddleware, requireAdmin, obtenerUsuarioPorId);
router.post('/',                 authMiddleware, requireAdmin, crearUsuario);
router.put('/:id',               authMiddleware, requireAdmin, actualizarUsuario);
router.patch('/:id/inactivar',   authMiddleware, requireAdmin, inactivarUsuario);
router.patch('/:id/activar',     authMiddleware, requireAdmin, activarUsuario);
router.delete('/:id',            authMiddleware, requireAdmin, eliminarUsuario);

module.exports = router;