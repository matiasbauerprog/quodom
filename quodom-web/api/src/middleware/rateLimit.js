const WINDOW_MS = 60_000;
const buckets = new Map();

function perUserPerMinute(limit) {
  return function rateLimitMiddleware(req, res, next) {
    const userId = req.user && req.user.id;
    if (!userId) return next();

    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    const arr = (buckets.get(userId) || []).filter(t => t > cutoff);

    if (arr.length >= limit) {
      return res.status(429).json({
        res: false,
        error: 'rate_limit',
        message: 'Muchos mensajes muy rápido. Esperá un momento y probá de nuevo.'
      });
    }

    arr.push(now);
    buckets.set(userId, arr);
    return next();
  };
}

function _reset() {
  buckets.clear();
}

module.exports = { perUserPerMinute, _reset };
