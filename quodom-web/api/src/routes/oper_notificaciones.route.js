const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Controler = require('../controllers/oper_notificaciones.controller');

router.get('/', auth.verifyToken(), getAll);
router.get('/count', auth.verifyToken(), getCount);
router.put('/:id', auth.verifyToken(), update);

module.exports = router;

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
