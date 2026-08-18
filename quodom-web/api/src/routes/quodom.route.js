const express = require('express');
const router = express.Router();
const Joi = require('joi');
const auth = require('../middleware/auth');
const Controler = require('../controllers/quodom.controller');
const validateRequest = require('../middleware/validate-request');
const { httpError } = require('../helpers/http-error');

router.get('/getQuodomCreados', auth.verifyToken(), getQuodomCreados);
router.get('/misQuodom/', auth.verifyToken(), getMyQuodoms);
router.get('/porccompletado/:id', auth.verifyToken(), getPorcById);
router.get('/whatsapp/:id', auth.verifyToken(), whatsappLink);
router.get('/activo/:idrubro', auth.verifyToken(), getActivo);
router.get('/:id', auth.verifyToken(), getById);
router.post('/create', auth.verifyToken(), createSchema, create);
router.post('/repetir/:id', auth.verifyToken(), repetir);
router.put('/:id', auth.verifyToken(), updateSchema, update);
router.delete('/:id', auth.verifyToken(), _delete);

module.exports = router;

function createSchema(req, res, next) {
  const schema = Joi.object({
    descripcion: Joi.string().required(),
    idrubro: Joi.number().integer().required(),
    iddireccion: Joi.number().integer().empty(null)
  });
  validateRequest(req, next, schema);
}

function updateSchema(req, res, next) {
  const schema = Joi.object({
    descripcion: Joi.string(),
    iddireccion: Joi.number().integer().empty(null)
  });
  validateRequest(req, next, schema);
}

function create(req, res, next) {
  Controler.create(req.body, req.user.id)
    .then((id) => res.json({ res: true, idquodom: id }))
    .catch(next);
}

function getMyQuodoms(req, res, next) {
  Controler.getMyQuodoms(req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function getPorcById(req, res, next) {
  Controler.getPorcById(req.user.id, req.params.id)
    .then(data => res.json(data))
    .catch(next);
}

function getById(req, res, next) {
  Controler.getById(req.params.id, req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function update(req, res, next) {
  Controler.update(req.params.id, req.body, req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function _delete(req, res, next) {
  Controler.delete(req.params.id, req.user.id)
    .then(() => res.json({ res: true, message: 'Eliminado.' }))
    .catch(next);
}

function getActivo(req, res, next) {
  const idrubro = parseInt(req.params.idrubro, 10);
  if (!/^\d+$/.test(req.params.idrubro) || idrubro <= 0) {
    return next(httpError(400, 'idrubro_invalido', 'El rubro indicado no es válido.'));
  }
  Controler.getActivoPorRubro(req.user.id, idrubro)
    .then((data) => res.json({ res: true, data }))
    .catch(next);
}

function getQuodomCreados(req, res, next) {
  Controler.getQuodomCreados(req.user.id)
    .then((data) => res.json({ res: (data.length !== 0 ? true : false), data }))
    .catch(next);
}

function whatsappLink(req, res, next) {
  Controler.whatsappLink(req.params.id, req.user.id)
    .then(link => res.json({ res: true, link }))
    .catch(next);
}

function repetir(req, res, next) {
  Controler.repetir(req.params.id, req.user.id)
    .then(idquodom => res.json({ res: true, idquodom }))
    .catch(next);
}
