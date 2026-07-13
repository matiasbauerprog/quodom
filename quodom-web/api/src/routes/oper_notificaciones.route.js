const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Controler = require('../controllers/oper_notificaciones.controller');
const Joi = require('joi');
const validateRequest = require('../middleware/validate-request');

router.get('/', auth.verifyToken(), getAll);
router.get('/count', auth.verifyToken(), getCount);
router.put('/:id', auth.verifyToken(), updateSchema, update);

module.exports = router;

function updateSchema(req, res, next) {
  const schema = Joi.object({
    leida: Joi.number().integer()
  });
  validateRequest(req, next, schema);
}

function getAll(req, res, next) {
  Controler.getAll(req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function getCount(req, res, next) {
  Controler.getCount(req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function update(req, res, next) {
  Controler.update(req.params.id, req.body, req.user.id)
    .then(() => res.json({ res: true }))
    .catch(next);
}
