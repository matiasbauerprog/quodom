const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Controler = require('../controllers/productos.controller');

router.get('/categoriaQ/:idquodom/:idcategoria', auth.verifyToken(), getProductsByCatQuodom);
router.get('/categoria/:idcategoria', getByCategoria);
router.get('/:id', getById);

module.exports = router;

function getByCategoria(req, res, next) {
  Controler.getByCat(req.params.idcategoria)
    .then(datas => res.json(datas))
    .catch(next);
}

function getProductsByCatQuodom(req, res, next) {
  Controler.getProductsByCatQuodom(req.params.idquodom, req.params.idcategoria)
    .then(datas => res.json(datas))
    .catch(next);
}

function getById(req, res, next) {
  Controler.getById(req.params.id)
    .then(data => res.json(data))
    .catch(next);
}
