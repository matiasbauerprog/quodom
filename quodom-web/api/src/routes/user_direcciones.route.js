const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const omitEmpty = require('../middleware/omitEmpty');

const EMPTY = omitEmpty(['piso', 'direccion', 'observaciones']);
const Controler = require('../controllers/user_direcciones.controller');

router.get('/direcciondefault', auth.verifyToken(), getDireccionDefault);
router.get('/:id', auth.verifyToken(), getById);
router.post('/create', auth.verifyToken(), EMPTY, create);
router.put('/prin/:id', auth.verifyToken(), updatePrincipal);
router.put('/:id', auth.verifyToken(), EMPTY, update);
router.delete('/:id', auth.verifyToken(), _delete);

module.exports = router;

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
