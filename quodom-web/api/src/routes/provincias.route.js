const express = require('express');
const router = express.Router();
const Controler = require('../controllers/provincias.controller');

router.get('/', getAll);

module.exports = router;

function getAll(req, res, next) {
    Controler.getAll()
        .then(datas => res.json(datas))
        .catch(next);
}
