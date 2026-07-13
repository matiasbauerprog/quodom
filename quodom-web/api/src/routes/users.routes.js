const express = require('express');
const router = express.Router();
const Joi = require('joi');
const auth = require('../middleware/auth');
const Controler = require('../controllers/users.controller');
const validateRequest = require('../middleware/validate-request');
const jwt = require('jsonwebtoken');

router.get('/validateEmail/:token', validateEmail);
router.get('/validateReset/:token', validateReset);
router.get('/infoComprador/:idquodom', auth.verifyToken(), getInfoComprador);
router.get('/dire/', auth.verifyToken(), getUserDirecciones);
router.get('/direcciondefault/', auth.verifyToken(), getUserDireccionDefault);
router.get('/', auth.isAdmin(), getAll);
router.get('/current', auth.verifyToken(), getCurrent);
router.get('/currentFoto', auth.verifyToken(), getCurrentFoto);
router.get('/:id', auth.verifyToken(), getById);
router.post('/signin', signinSchema, authenticate);
router.post('/signup', signupSchema, register);
router.post('/reset', resetSchema, resetPass);
router.post('/reenviar', resetSchema, reenviar);
router.post('/changePass', changePassSchema, cambiarPass);
router.put('/', auth.verifyToken(), updateSchema, update);
router.put('/cambiarFoto/:id', auth.verifyToken(), fotoSchema, updateFoto);
router.delete('/:id', auth.isAdmin(), _delete);

module.exports = router;

function updateSchema(req, res, next) {
  const schema = Joi.object({
    username: Joi.string(),
    email: Joi.string().email(),
    nombre: Joi.string(),
    apellido: Joi.string(),
    dni: Joi.string().empty(''),
    codArea: Joi.string(),
    telefono: Joi.string(),
    password: Joi.string().min(6)
  });
  validateRequest(req, next, schema);
}

function fotoSchema(req, res, next) {
  const schema = Joi.object({
    foto: Joi.string().empty(''),
    refreshFoto: Joi.string()
  });
  validateRequest(req, next, schema);
}

function signinSchema(req, res, next) {
  const schema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
  });
  validateRequest(req, next, schema);
}

function signupSchema(req, res, next) {
  const schema = Joi.object({
    username: Joi.string().required(),
    email: Joi.string().email().required(),
    nombre: Joi.string().required(),
    apellido: Joi.string(),
    password: Joi.string().min(6).required(),
    dni: Joi.string(),
    codArea: Joi.string().required(),
    telefono: Joi.string().required()
  });
  validateRequest(req, next, schema);
}

function resetSchema(req, res, next) {
  const schema = Joi.object({
    email: Joi.string().required()
  });
  validateRequest(req, next, schema);
}

function changePassSchema(req, res, next) {
  const schema = Joi.object({
    password: Joi.string().min(6).required(),
    token: Joi.string().required()
  });
  validateRequest(req, next, schema);
}

function authenticate(req, res, next) {
  Controler.authenticate(req.body)
    .then(user => res.json({
      res: true,
      username: user.username,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      id: user.id,
      role: user.role,
      refreshFoto: user.refreshFoto,
      token: user.token
    }))
    .catch(next);
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
  Controler.getInfoComprador(req.params.idquodom)
    .then(data => res.json(data))
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
  jwt.verify(req.params.token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.json({ res: false, message: 'El token no es valido o ha expirado.' });
    }
    Controler.validateEmail(decoded.sub)
      .then(() => res.status(200).json({ res: true, message: 'Correo validado' }))
      .catch(next);
  });
}

function validateReset(req, res, next) {
  jwt.verify(req.params.token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.message === 'jwt expired') {
        return res.json({ res: false, message: 'El token ha expirado, genere uno nuevo ingresando a ¿Olvidaste tu clave?' });
      }
      return res.json({ res: false, message: 'El token no es valido.' });
    }
    if (decoded.action !== 'resetpass') {
      return res.json({ res: false, message: 'El token no es valido para esta operacion, genere uno nuevo ingresando a ¿Olvidaste tu clave?' });
    }
    res.status(200).json({ res: true });
  });
}

function cambiarPass(req, res, next) {
  jwt.verify(req.body.token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.message === 'jwt expired') {
        return res.json({ res: false, message: 'El token ha expirado, genere uno nuevo ingresando a ¿Olvidaste tu clave?' });
      }
      return res.json({ res: false, message: 'El token no es valido.' });
    }
    if (decoded.action !== 'resetpass') {
      return res.json({ res: false, message: 'El token no es valido para esta operacion, genere uno nuevo ingresando a ¿Olvidaste tu clave?' });
    }
    Controler.changePass(decoded.sub, req.body)
      .then(() => res.json({ res: true, message: 'La contraseña ha sido modificado con exito, ya puedes volver a ingresar a QUODOM.' }))
      .catch(next);
  });
}
