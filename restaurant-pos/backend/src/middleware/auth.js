const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Token requerido.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'clave_secreta_temporal');
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sesión expirada. Inicia sesión nuevamente.', expired: true });
    }
    return res.status(401).json({ error: 'Token inválido.' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.rol !== 'Admin') {
    return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
  }
  next();
};

const requireRol = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.rol)) {
    return res.status(403).json({ error: `Acceso denegado. Roles permitidos: ${roles.join(', ')}.` });
  }
  next();
};

module.exports = authMiddleware;
module.exports.requireAdmin = requireAdmin;
module.exports.requireRol = requireRol;