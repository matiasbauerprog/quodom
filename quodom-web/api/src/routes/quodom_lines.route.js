const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const omitEmpty = require('../middleware/omitEmpty');
const Controler = require('../controllers/quodom_lines.controller');

router.get('/lines/:id', auth.verifyToken(), getById);
router.get('/atributos', getAtributos);
router.get('/:id', auth.verifyToken(), getAllbyIdQuodom);
router.post('/add', auth.verifyToken(), omitEmpty(['atributo1', 'atributo2']), add);
router.put('/:id', auth.verifyToken(), omitEmpty(['atributo1', 'atributo2']), update);
router.delete('/:id', auth.verifyToken(), _delete);

module.exports = router;

function add(req, res, next) {
  Controler.add(req.body, req.user.id)
    .then((id) => res.json({ res: true, id: id }))
    .catch(next);
}

function getAllbyIdQuodom(req, res, next) {
  // :id is the Quodom id here (PUT/DELETE /:id take a line id); one name so
  // the path is a single template in openapi.yaml.
  Controler.getAll(req.params.id, req.user.id)
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
