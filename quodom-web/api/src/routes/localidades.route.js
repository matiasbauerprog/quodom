const express = require('express');
const router = express.Router();
const Controler = require('../controllers/localidades.controller');

router.get('/prov', getLocalidadProv);

module.exports = router;

function getLocalidadProv(req, res, next) {
    Controler.getLocalidadProv(req.query.idprovincia)
        .then(datas => res.json(datas))
        .catch(next);
}
