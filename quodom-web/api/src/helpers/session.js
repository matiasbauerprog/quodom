// The session JWT lives in an httpOnly cookie so no script on the page can
// read it. The app reaches the API through its own origin (/api, proxied by
// Render and by Vite in dev), which is what lets SameSite=Strict work: a
// cross-site cookie would be dropped by Safari.
const COOKIE = 'quodom_session';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function cookieOptions(req) {
  const local = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
  return { httpOnly: true, sameSite: 'strict', path: '/', secure: !local };
}

function setSession(req, res, token) {
  res.cookie(COOKIE, token, { ...cookieOptions(req), maxAge: MAX_AGE_MS });
}

function clearSession(req, res) {
  res.clearCookie(COOKIE, cookieOptions(req));
}

// Cookie first; the Bearer header stays accepted for tests and tools.
function readToken(req) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === COOKIE) {
      return decodeURIComponent(part.slice(i + 1).trim());
    }
  }
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

module.exports = { setSession, clearSession, readToken, SESSION_TTL: '30d' };
