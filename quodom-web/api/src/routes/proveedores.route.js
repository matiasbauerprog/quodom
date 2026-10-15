const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const { httpError } = require('../helpers/http-error');
const Controler = require('../controllers/proveedores.controller');

// Cada búsqueda se le paga a Google. El scope separa este cupo del chat de IA:
// sin él comparten balde y buscar proveedores gasta el cupo del chat.
const MAX_RPM = () => Number(process.env.PROVEEDORES_RATE_LIMIT_PER_MINUTE) || 10;

router.get('/:id', auth.verifyToken(),
  (req, res, next) => rateLimit.perUserPerMinute(MAX_RPM(), 'proveedores')(req, res, next), getProveedores);

module.exports = router;

function getProveedores(req, res, next) {
  Controler.listar(req.params.id, req.user.id)
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
    console.warn('proveedores: places fallo. codigo=' + e.codigo + ' mensaje=' + e.message);
    return httpError(503, e.codigo || 'google_error', e.message);
  }
  return e;
}
