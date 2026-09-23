const jwt = require('express-jwt');
const db = require('../helpers/db');
const { readToken } = require('../helpers/session');

module.exports = {
  verifyToken,
  isAdmin
};

function verifyToken() {
  return [
    jwt({ secret: process.env.JWT_SECRET, algorithms: ['HS256'], getToken: readToken }),

    async (req, res, next) => {
      try {
        // Reset and email-validation links are signed with the same secret;
        // only a token minted at sign-in (no `action`) opens a session.
        if (req.user.action)
          return res.status(401).json({ res: false, message: 'No autorizado.' });

        const user = await db.User.findByPk(req.user.sub);

        if (!user)
          return res.status(401).json({ res: false, message: 'No autorizado.' });

        if (!user.activo)
          return res.status(401).json({ res: false, message: 'No autorizado.' });

        if (!user.emailValidado)
          return res.status(401).json({ res: false, message: 'Validar correo electronico.' });

        req.user = user.get();
        next();
      } catch (err) {
        next(err);
      }
    }
  ];
}

function isAdmin() {
  return [
    jwt({ secret: process.env.JWT_SECRET, algorithms: ['HS256'], getToken: readToken }),

    async (req, res, next) => {
      try {
        // Reset and email-validation links are signed with the same secret;
        // only a token minted at sign-in (no `action`) opens a session.
        if (req.user.action)
          return res.status(401).json({ res: false, message: 'No autorizado.' });

        const user = await db.User.findByPk(req.user.sub);

        if (!user)
          return res.status(401).json({ res: false, message: 'No autorizado.' });

        if (!user.activo)
          return res.status(401).json({ res: false, message: 'No autorizado.' });

        if (user.role !== 'admin')
          return res.status(401).json({ res: false, message: 'No autorizado solo admins.' });

        req.user = user.get();
        next();
      } catch (err) {
        next(err);
      }
    }
  ];
}
