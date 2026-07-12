const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Controler = require('../controllers/hist_busquedas.controller');

router.get('/', auth.verifyToken(), getRecent);
router.post('/create', auth.verifyToken(), create);

module.exports = router;

function getRecent(req, res, next) {
    Controler.getRecent(req.user.id)
        .then(datas => res.json(datas))
        .catch(next);
}

function create(req, res, next) {
    Controler.create(req.body.valor, req.user.id)
        .then(() => res.json({ res: true }))
        .catch(next);
}
