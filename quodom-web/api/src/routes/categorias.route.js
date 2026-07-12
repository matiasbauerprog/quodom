const express = require('express');
const router = express.Router();
const Controler = require('../controllers/categorias.controller');

router.get('/Sub/:idcategoriapadre', getSub);
router.get('/', getAll);
router.get('/:id', getById);

module.exports = router;

function getAll(req, res, next) {
  Controler.getAll()
    .then(datas => res.json(datas))
    .catch(next);
}

function getSub(req, res, next) {
  Controler.getSub(req.params.idcategoriapadre)
    .then(datas => res.json(datas))
    .catch(next);
}

function getById(req, res, next) {
  Controler.getById(req.params.id)
    .then(data => res.json(data))
    .catch(next);
}
