const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const { httpError } = require('../helpers/http-error');
const Controler = require('../controllers/lugares.controller');

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

// Un problema de Google es 503 y no 500: es un servicio de afuera que no está
// disponible, no un error nuestro. El código viaja para que la app pueda
// distinguir "falta la clave" de "Google tardó".
//
// Se convierte a httpError (objeto plano) en vez de ponerle .status al Error:
// el manejador serializa con spread, y el `message` de un Error no es
// enumerable, así que la respuesta saldría sin mensaje.
function mapear(e) {
  if (e && e.name === 'PlacesError') {
    // Sin esto el único rastro es el `ERROR LOG: [object Object]` del
    // error-handler, que serializa objetos planos: ni el código ni el mensaje
    // quedan en el log, y quien mire producción no tiene con qué empezar.
    console.warn('lugares: places fallo. codigo=' + e.codigo + ' mensaje=' + e.message);
    return httpError(503, e.codigo || 'google_error', e.message);
  }
  return e;
}
