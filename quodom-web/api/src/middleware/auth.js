const jwt = require('express-jwt');
const db = require('../helpers/db');

module.exports = {
  verifyToken,
  isAdmin
};

function verifyToken() {
  return [
    jwt({ secret: process.env.JWT_SECRET, algorithms: ['HS256'] }),

    async (req, res, next) => {
      const user = await db.User.findByPk(req.user.sub);

      if (!user)
        return res.status(401).json({ res: false, message: 'No autorizado.' });

      if (!user.activo)
        return res.status(401).json({ res: false, message: 'No autorizado.' });

      if (!user.emailValidado)
        return res.status(401).json({ res: false, message: 'Validar correo electronico.' });

      req.user = user.get();
      next();
    }
  ];
}

function isAdmin() {
  return [
    jwt({ secret: process.env.JWT_SECRET, algorithms: ['HS256'] }),

    async (req, res, next) => {
      const user = await db.User.findByPk(req.user.sub);

      if (!user)
        return res.status(401).json({ res: false, message: 'No autorizado.' });

      if (!user.activo)
        return res.status(401).json({ res: false, message: 'No autorizado.' });

      if (user.role !== 'admin')
        return res.status(401).json({ res: false, message: 'No autorizado solo admins.' });

      req.user = user.get();
      next();
    }
  ];
}
