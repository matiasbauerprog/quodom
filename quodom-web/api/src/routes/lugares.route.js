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

// Y un tope por día, que es el que acota la factura. El de por minuto acota el
// RITMO y no el TOTAL: por este balde pasan el autocompletado y el pin
// arrastrable, y 40/min sostenidos son 57.600 consultas pagas en un día. No
// hace falta mala intención — un bucle de recarga en caliente, en desarrollo,
// llega solo y nadie lo nota hasta la factura.
const MAX_POR_DIA = () => Number(process.env.LUGARES_RATE_LIMIT_PER_DAY) || 300;

// El mensaje por defecto del middleware es el del chat de IA ("Muchos mensajes
// muy rápido"), y acá el usuario estaba tipeando una dirección: mandarlo a
// buscar el problema entre sus mensajes es mandarlo al lugar equivocado. El
// scope ya separaba el balde; el texto también tiene que separarse.
const MENSAJE_TOPE = 'Estás buscando direcciones muy seguido. Esperá un momento y probá de nuevo.';

// El tope diario no se arregla esperando un rato, así que no puede decir lo
// mismo; y nombra la salida, porque cargar la dirección a mano sigue andando.
const MENSAJE_TOPE_DIARIO = 'Llegaste al tope de búsquedas de direcciones de hoy. '
  + 'Podés cargar la dirección a mano, o probar de nuevo mañana.';

// El de por minuto va primero en las tres: si corta, no consume el cupo del día.
const topes = [
  (req, res, next) => rateLimit.perUserPerMinute(MAX_RPM(), 'lugares', MENSAJE_TOPE)(req, res, next),
  (req, res, next) => rateLimit.perUserPerDay(MAX_POR_DIA(), 'lugares', MENSAJE_TOPE_DIARIO)(req, res, next)
];

router.get('/sugerencias', auth.verifyToken(), topes, getSugerencias);
// `/punto` va ANTES de `/:placeid`, que si no se lo come y lo trataría como un
// identificador de lugar: Google contestaría que no existe y el pin diría que
// no hay dirección en ninguna parte. Es la misma trampa que `/quodom/proveedores`
// contra `/quodom/:id`.
router.get('/punto', auth.verifyToken(), topes, getPunto);
router.get('/:placeid', auth.verifyToken(), topes, getDireccion);

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

