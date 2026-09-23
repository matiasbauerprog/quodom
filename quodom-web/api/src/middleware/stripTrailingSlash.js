// Express matches /users/dire/ and /users/dire alike and the app sends both;
// the validator matches paths literally. Normalize before it sees them.
module.exports = function stripTrailingSlash(req, res, next) {
  const [p, q] = req.url.split('?');
  if (p.length > 1 && p.endsWith('/')) {
    req.url = p.replace(/\/+$/, '') + (q !== undefined ? '?' + q : '');
  }
  next();
};
