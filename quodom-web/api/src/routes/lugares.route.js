const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const { mapearPlacesError } = require('../helpers/places-http');
const Controler = require('../controllers/lugares.controller');

const mapear = mapearPlacesError('lugares');

// Cada consulta se le paga a Google, así que el tope no es antiabuso sino
// control de gasto: un bug de la app que dispare sugerencias en bucle se frena
// acá y no en la factura.
const MAX_RPM = () => Number(process.env.LUGARES_RATE_LIMIT_PER_MINUTE) || 40;

router.get('/sugerencias', auth.verifyToken(),
  (req, res, next) => rateLimit.perUserPerMinute(MAX_RPM(), 'lugares')(req, res, next), getSugerencias);
router.get('/:placeid', auth.verifyToken(),
  (req, res, next) => rateLimit.perUserPerMinute(MAX_RPM(), 'lugares')(req, res, next), getDireccion);

module.exports = router;

function getSugerencias(req, res, next) {
  Controler.sugerencias(req.query.q, req.query.sesion)
    .then(data => res.json(data))
    .catch(e => next(mapear(e)));
}

function getDireccion(req, res, next) {
  Controler.direccion(req.params.placeid, req.query.sesion)
    .then(data => res.json(data))
    .catch(e => next(mapear(e)));
}

