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

// Y un tope por día, que es el que acota la factura: el de por minuto acota el
// ritmo y no el total, y una cuenta sostenida en 10/min son 14.400 búsquedas
// pagas por día. Es el control que pide la spec (mitigación del Riesgo 4).
const MAX_POR_DIA = () => Number(process.env.PROVEEDORES_RATE_LIMIT_PER_DAY) || 100;

// El tope se alcanza en uso honesto (cada apertura del popup es una consulta a
// Google, sin caché), así que el aviso tiene que nombrar lo que el usuario
// estaba haciendo: acá no mandó ningún mensaje.
const MENSAJE_TOPE = 'Estás buscando proveedores muy seguido. Esperá un momento y probá de nuevo.';

// El tope diario no se arregla esperando un rato, así que no puede decir lo
// mismo; y nombra la salida, porque el comprador tiene que poder enviar igual.
const MENSAJE_TOPE_DIARIO = 'Llegaste al tope de búsquedas de proveedores de hoy. '
  + 'Podés enviar sin elegir proveedor, o probar de nuevo mañana.';

router.get('/:id', auth.verifyToken(),
  // El de por minuto va primero: si corta, no consume el cupo del día.
  (req, res, next) => rateLimit.perUserPerMinute(MAX_RPM(), 'proveedores', MENSAJE_TOPE)(req, res, next),
  (req, res, next) => rateLimit.perUserPerDay(MAX_POR_DIA(), 'proveedores', MENSAJE_TOPE_DIARIO)(req, res, next),
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
