const WINDOW_MS = 60_000;
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

function perUserPerMinute(limit) {
  return function rateLimitMiddleware(req, res, next) {
    const userId = req.user && req.user.id;
    if (!userId) return next();

    if (!take(userId, limit, WINDOW_MS)) {
      return res.status(429).json({
        res: false,
        error: 'rate_limit',
        message: 'Muchos mensajes muy rápido. Esperá un momento y probá de nuevo.'
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
// per address that ever called us.
const sweeper = setInterval(() => {
  const cutoff = Date.now() - 60 * 60_000;
  for (const [k, arr] of buckets) {
    if (!arr.length || arr[arr.length - 1] < cutoff) buckets.delete(k);
  }
}, 10 * 60_000);
sweeper.unref();

module.exports = { perUserPerMinute, perRequest, _reset };
