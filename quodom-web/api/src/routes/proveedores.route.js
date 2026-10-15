const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const { mapearPlacesError } = require('../helpers/places-http');
const Controler = require('../controllers/proveedores.controller');

const mapear = mapearPlacesError('proveedores');

// Cada búsqueda se le paga a Google. El scope separa este cupo del chat de IA:
// sin él comparten balde y buscar proveedores gasta el cupo del chat.
const MAX_RPM = () => Number(process.env.PROVEEDORES_RATE_LIMIT_PER_MINUTE) || 10;

// El tope se alcanza en uso honesto (cada apertura del popup es una consulta a
// Google, sin caché), así que el aviso tiene que nombrar lo que el usuario
// estaba haciendo: acá no mandó ningún mensaje.
const MENSAJE_TOPE = 'Estás buscando proveedores muy seguido. Esperá un momento y probá de nuevo.';

router.get('/:id', auth.verifyToken(),
  (req, res, next) => rateLimit.perUserPerMinute(MAX_RPM(), 'proveedores', MENSAJE_TOPE)(req, res, next),
  getProveedores);

// Sin cupo propio: no consulta a Google, sólo escribe lo que el comprador vio.
router.post('/:id/no-enviado', auth.verifyToken(), postNoEnviado);

module.exports = router;

function getProveedores(req, res, next) {
  Controler.listar(req.params.id, req.user.id)
    .then(data => res.json(data))
    .catch(e => next(mapear(e)));
}

function postNoEnviado(req, res, next) {
  Controler.noEnviado(req.params.id, req.user.id, req.body)
    .then(data => res.json(data))
    .catch(next);
}
