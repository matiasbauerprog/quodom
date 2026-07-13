const express = require('express');
const router = express.Router();
const Joi = require('joi');
const auth = require('../middleware/auth');
const Controler = require('../controllers/user_direcciones.controller');
const validateRequest = require('../middleware/validate-request');

router.get('/direcciondefault', auth.verifyToken(), getDireccionDefault);
router.get('/:id', auth.verifyToken(), getById);
router.post('/create', auth.verifyToken(), direccionSchema, create);
router.put('/prin/:id', auth.verifyToken(), updatePrincipal);
router.put('/:id', auth.verifyToken(), direccionSchema, update);
router.delete('/:id', auth.verifyToken(), _delete);

module.exports = router;

function direccionSchema(req, res, next) {
  const schema = Joi.object({
    alias: Joi.string(),
    calle: Joi.string(),
    numero: Joi.string(),
    piso: Joi.string().empty(''),
    cp: Joi.string(),
    localidad: Joi.string(),
    direccion: Joi.string().empty(''),
    observaciones: Joi.string().empty(''),
    idprovincia: Joi.number().integer(),
    default: Joi.boolean()
  });
  validateRequest(req, next, schema);
}

function getById(req, res, next) {
  Controler.getById(req.params.id, req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function getDireccionDefault(req, res, next) {
  Controler.getDireccionDefault(req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function create(req, res, next) {
  Controler.create(req.body, req.user.id)
    .then(() => res.json({ res: true, message: 'Creado.' }))
    .catch(next);
}

function update(req, res, next) {
  Controler.update(req.params.id, req.body, req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function updatePrincipal(req, res, next) {
  Controler.updatePrincipal(req.params.id, req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function _delete(req, res, next) {
  Controler.delete(req.params.id, req.user.id)
    .then(() => res.json({ res: true, message: 'Eliminado.' }))
    .catch(next);
}
