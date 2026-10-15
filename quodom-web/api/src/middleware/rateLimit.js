const WINDOW_MS = 60_000;
const DAY_MS = 24 * 60 * 60_000;
const buckets = new Map();

// Sliding window over the timestamps stored under `key`. Returns false when
// the request would exceed `limit`, without recording it.
function take(key, limit, windowMs) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const arr = (buckets.get(key) || []).filter(t => t > cutoff);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    return false;
  }
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

// El texto del chat de IA, que es de donde salió este middleware. Sigue siendo
// el default para no tocar `ia.route.js`, pero una ruta que no manda mensajes
// tiene que pasar el suyo: el scope separa el balde y el mensaje separa la
// explicación, y con uno solo de los dos el usuario igual termina buscando el
// problema donde no está.
const MENSAJE_POR_DEFECTO = 'Muchos mensajes muy rápido. Esperá un momento y probá de nuevo.';

// `scope` separa el cupo de cada feature. Sin él, todas las rutas que usan
// este middleware comparten un balde por usuario: buscar direcciones gastaba
// el cupo del chat de IA, y el usuario recibía "Muchos mensajes muy rápido"
// sin haber mandado ningún mensaje. Es obligatorio en rutas nuevas.
function perUserPerMinute(limit, scope = '', mensaje = MENSAJE_POR_DEFECTO) {
  return function rateLimitMiddleware(req, res, next) {
    const userId = req.user && req.user.id;
    if (!userId) return next();

    if (!take(scope + ':' + userId, limit, WINDOW_MS)) {
      return res.status(429).json({
        res: false,
        error: 'rate_limit',
        message: mensaje
      });
    }
    return next();
  };
}

// Per-user daily cap, on top of the per-minute one. A per-minute limit bounds
// the RATE, not the TOTAL: a single account sustaining 10/min adds up to 14,400
// paid searches a day — around US$500 — without anything noticing. It takes its
// own scope so the day's bucket is never confused with the minute's, and its
// own message, because "esperá un momento" is wrong advice when the answer is
// tomorrow.
function perUserPerDay(limit, scope, mensaje) {
  return function dailyRateLimitMiddleware(req, res, next) {
    const userId = req.user && req.user.id;
    if (!userId) return next();

    if (!take(scope + ':dia:' + userId, limit, DAY_MS)) {
      return res.status(429).json({
        res: false,
        error: 'rate_limit',
        message: mensaje
      });
    }
    return next();
  };
}

// For the endpoints that run before anyone is logged in (sign-in, password
// recovery). Each rule is { name, limit: () => number, windowMs, key: req => string };
// a rule whose key comes out empty is skipped. `limit` is a function so tests
// and deploys can tune it through env vars without reloading the module.
function perRequest(...rules) {
  return function authRateLimit(req, res, next) {
    for (const rule of rules) {
      const k = rule.key(req);
      if (!k) continue;
      if (!take(rule.name + ':' + k, rule.limit(), rule.windowMs)) {
        return res.status(429).json({
          res: false,
          error: 'rate_limit',
          message: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.'
        });
      }
    }
    return next();
  };
}

function _reset() {
  buckets.clear();
}

// Drop keys whose window has fully passed, so the map doesn't keep one entry
// per address that ever called us. The cutoff has to cover the LONGEST window
// in use, not one hour: with an hour, a daily bucket whose last request was two
// hours ago got swept and the day's count started over, which is no cap at all.
const sweeper = setInterval(() => {
  const cutoff = Date.now() - (DAY_MS + 60 * 60_000);
  for (const [k, arr] of buckets) {
    if (!arr.length || arr[arr.length - 1] < cutoff) buckets.delete(k);
  }
}, 10 * 60_000);
sweeper.unref();

module.exports = { perUserPerMinute, perUserPerDay, perRequest, _reset };
