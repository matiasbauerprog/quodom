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

// El mensaje por defecto del middleware es el del chat de IA ("Muchos mensajes
// muy rápido"), y acá el usuario estaba tipeando una dirección: mandarlo a
// buscar el problema entre sus mensajes es mandarlo al lugar equivocado. El
// scope ya separaba el balde; el texto también tiene que separarse.
const MENSAJE_TOPE = 'Estás buscando direcciones muy seguido. Esperá un momento y probá de nuevo.';

router.get('/sugerencias', auth.verifyToken(),
  (req, res, next) => rateLimit.perUserPerMinute(MAX_RPM(), 'lugares', MENSAJE_TOPE)(req, res, next), getSugerencias);
// `/punto` va ANTES de `/:placeid`, que si no se lo come y lo trataría como un
// identificador de lugar: Google contestaría que no existe y el pin diría que
// no hay dirección en ninguna parte. Es la misma trampa que `/quodom/proveedores`
// contra `/quodom/:id`.
router.get('/punto', auth.verifyToken(),
  (req, res, next) => rateLimit.perUserPerMinute(MAX_RPM(), 'lugares', MENSAJE_TOPE)(req, res, next), getPunto);
router.get('/:placeid', auth.verifyToken(),
  (req, res, next) => rateLimit.perUserPerMinute(MAX_RPM(), 'lugares', MENSAJE_TOPE)(req, res, next), getDireccion);

module.exports = router;

function getSugerencias(req, res, next) {
  Controler.sugerencias(req.query.q, req.query.sesion)
    .then(data => res.json(data))
    .catch(e => next(mapear(e)));
}

function getPunto(req, res, next) {
  Controler.puntoADireccion(req.query.lat, req.query.lng)
    .then(data => res.json(data))
    .catch(e => next(mapear(e)));
}

function getDireccion(req, res, next) {
  Controler.direccion(req.params.placeid, req.query.sesion)
    .then(data => res.json(data))
    .catch(e => next(mapear(e)));
}

