const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const omitEmpty = require('../middleware/omitEmpty');
const Controler = require('../controllers/users.controller');
const rateLimit = require('../middleware/rateLimit');
const jwt = require('jsonwebtoken');
const session = require('../helpers/session');

const MIN = 60_000;
const envInt = (name, fallback) => () => parseInt(process.env[name], 10) || fallback;
const byIp = req => req.ip;
// The field is called `email` but also accepts a username; either way it names
// the inbox that receives the mail, so the cap follows it across addresses.
const byInbox = req => String((req.body && req.body.email) || '').trim().toLowerCase();

const limitSignin = rateLimit.perRequest(
  { name: 'signin-ip', limit: envInt('AUTH_LIMIT_SIGNIN_PER_IP', 10), windowMs: 15 * MIN, key: byIp }
);
const limitSignup = rateLimit.perRequest(
  { name: 'signup-ip', limit: envInt('AUTH_LIMIT_SIGNUP_PER_IP', 5), windowMs: 60 * MIN, key: byIp }
);
const limitMail = rateLimit.perRequest(
  { name: 'mail-ip', limit: envInt('AUTH_LIMIT_RESET_PER_IP', 5), windowMs: 60 * MIN, key: byIp },
  { name: 'mail-inbox', limit: envInt('AUTH_LIMIT_RESET_PER_EMAIL', 3), windowMs: 60 * MIN, key: byInbox }
);
const limitResetToken = rateLimit.perRequest(
  { name: 'resettoken-ip', limit: envInt('AUTH_LIMIT_RESET_TOKEN_PER_IP', 10), windowMs: 15 * MIN, key: byIp }
);

router.get('/validateEmail/:token', validateEmail);
router.get('/validateReset/:token', limitResetToken, validateReset);
router.get('/infoComprador/:idquodom', auth.verifyToken(), getInfoComprador);
router.get('/dire/', auth.verifyToken(), getUserDirecciones);
router.get('/direcciondefault/', auth.verifyToken(), getUserDireccionDefault);
router.get('/', auth.isAdmin(), getAll);
router.get('/current', auth.verifyToken(), getCurrent);
router.get('/currentFoto', auth.verifyToken(), getCurrentFoto);
router.get('/:id', auth.verifyToken(), getById);
router.post('/signin', limitSignin, authenticate);
router.post('/signout', signout);
router.post('/signup', limitSignup, register);
router.post('/reset', limitMail, resetPass);
router.post('/reenviar', limitMail, reenviar);
router.post('/changePass', limitResetToken, cambiarPass);
router.put('/', auth.verifyToken(), omitEmpty(['dni']), update);
router.put('/cambiarFoto/:id', auth.verifyToken(), omitEmpty(['foto']), updateFoto);
router.delete('/:id', auth.isAdmin(), _delete);

module.exports = router;

function authenticate(req, res, next) {
  Controler.authenticate(req.body)
    .then(user => {
      session.setSession(req, res, user.token);
      res.json({
        res: true,
        username: user.username,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        id: user.id,
        role: user.role,
        refreshFoto: user.refreshFoto
      });
    })
    .catch(next);
}

function signout(req, res) {
  session.clearSession(req, res);
  res.json({ res: true });
}

function register(req, res, next) {
  Controler.create(req.body)
    .then(response => res.json(response))
    .catch(next);
}

function getAll(req, res, next) {
  Controler.getAll()
    .then(users => res.json(users))
    .catch(next);
}

function getCurrent(req, res, next) {
  res.json({
    id: req.user.id,
    username: req.user.username,
    email: req.user.email,
    nombre: req.user.nombre,
    apellido: req.user.apellido,
    dni: req.user.dni,
    refreshFoto: req.user.refreshFoto,
    telefono: req.user.telefono,
    codArea: req.user.codArea
  });
}

function getCurrentFoto(req, res, next) {
  res.json({
    id: req.user.id,
    foto: req.user.foto,
    refreshFoto: req.user.refreshFoto
  });
}

function getById(req, res, next) {
  if (req.user.id == req.params.id) {
    Controler.getById(req.params.id)
      .then(user => res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido
      }))
      .catch(next);
  } else {
    res.status(401).json({ res: false, message: 'Error de Id.' });
  }
}

function getUserDirecciones(req, res, next) {
  Controler.getUserDirecciones(req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function getUserDireccionDefault(req, res, next) {
  Controler.getUserDireccionDefault(req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function getInfoComprador(req, res, next) {
  Controler.getInfoComprador(req.user.id, req.params.idquodom)
    .then(data => data
      ? res.json(data)
      : res.status(404).json({ res: false, message: 'Quodom no encontrado.' }))
    .catch(next);
}

function update(req, res, next) {
  Controler.update(req.user.id, req.body)
    .then(() => res.status(200).json({ res: true, message: 'Actualizado.' }))
    .catch(next);
}

function updateFoto(req, res, next) {
  if (req.user.id == req.params.id) {
    Controler.updateFoto(req.params.id, req.body)
      .then(data => res.json({ res: true, refresh: data }))
      .catch(next);
  } else {
    res.status(401).json({ res: false, message: 'Error de Id.' });
  }
}

function _delete(req, res, next) {
  Controler.delete(req.params.id)
    .then(() => res.status(200).json({ res: true, message: 'Eliminado.' }))
    .catch(next);
}

function resetPass(req, res, next) {
  Controler.reset(req.body)
    .then(response => res.json(response))
    .catch(next);
}

function reenviar(req, res, next) {
  Controler.reenviar(req.body)
    .then(response => res.json(response))
    .catch(next);
}

function validateEmail(req, res, next) {
  jwt.verify(req.params.token, process.env.JWT_SECRET, { algorithms: ['HS256'] }, (err, decoded) => {
    if (err || decoded.action !== 'validar') {
      return res.json({ res: false, message: 'El token no es valido o ha expirado.' });
    }
    Controler.validateEmail(decoded.sub)
      .then(() => res.status(200).json({ res: true, message: 'Correo validado' }))
      .catch(next);
  });
}

// Token problems answer 200 with res:false, as before, so the screen shows
// the message in place instead of treating it as a server error.
function validateReset(req, res, next) {
  Controler.verifyResetToken(req.params.token)
    .then(() => res.status(200).json({ res: true }))
    .catch(err => typeof err === 'string' ? res.json({ res: false, message: err }) : next(err));
}

function cambiarPass(req, res, next) {
  Controler.changePass(req.body.token, req.body)
    .then(() => res.json({ res: true, message: 'La contraseña ha sido modificado con exito, ya puedes volver a ingresar a QUODOM.' }))
    .catch(err => typeof err === 'string' ? res.json({ res: false, message: err }) : next(err));
}
