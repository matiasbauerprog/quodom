const express = require('express');
const router = express.Router();
const Controler = require('../controllers/busqueda.controller');

router.get('/', getAll);

module.exports = router;

function getAll(req, res, next) {
    if (!req.query.b) return res.json([]);
    Controler.getAll(req.query.b)
        .then(datas => res.json(datas))
        .catch(next);
}
