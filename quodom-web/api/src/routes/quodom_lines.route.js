const express = require('express');
const router = express.Router();
const Joi = require('joi');
const auth = require('../middleware/auth');
const Controler = require('../controllers/quodom_lines.controller');
const validateRequest = require('../middleware/validate-request');

router.get('/lines/:id', auth.verifyToken(), getById);
router.get('/atributos', auth.verifyToken(), getAtributos);
router.get('/:idquodom', auth.verifyToken(), getAllbyIdQuodom);
router.post('/add', auth.verifyToken(), addSchema, add);
router.put('/:id', auth.verifyToken(), updateSchema, update);
router.delete('/:id', auth.verifyToken(), _delete);

module.exports = router;

function updateSchema(req, res, next) {
  const schema = Joi.object({
    cantidad: Joi.number().integer(),
    atributo1: Joi.string().empty(''),
    atributo2: Joi.string().empty('')
  });
  validateRequest(req, next, schema);
}

function addSchema(req, res, next) {
  const schema = Joi.object({
    idquodom: Joi.string().required(),
    idproducto: Joi.number().integer().required(),
    cantidad: Joi.number().integer().required(),
    nombreProducto: Joi.string(),
    atributo1: Joi.string().empty(''),
    atributo2: Joi.string().empty('')
  });
  validateRequest(req, next, schema);
}

function add(req, res, next) {
  Controler.add(req.body, req.user.id)
    .then((id) => res.json({ res: true, id: id }))
    .catch(next);
}

function getAllbyIdQuodom(req, res, next) {
  Controler.getAll(req.params.idquodom, req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function getAtributos(req, res, next) {
  Controler.getAtributos(req.query.idproducto, req.query.nombreatributo)
    .then(data => res.json(data))
    .catch(next);
}

function getById(req, res, next) {
  Controler.getById(req.params.id, req.user.id)
    .then(data => res.json({
      idproducto: data.idproducto,
      detalleProducto: data.detalleProducto,
      cantidad: data.cantidad
    }))
    .catch(next);
}

function update(req, res, next) {
  Controler.update(req.params.id, req.body, req.user.id)
    .then(data => res.json({ res: true, message: 'Producto actualizado.' }))
    .catch(next);
}

function _delete(req, res, next) {
  Controler.delete(req.params.id, req.user.id)
    .then(() => res.json({ res: true, message: 'Eliminado.' }))
    .catch(next);
}
