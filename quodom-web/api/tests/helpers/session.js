// The session travels in an httpOnly cookie, never in the response body.
// Tests pull it out of Set-Cookie and send it back as a Bearer header, which
// the API still accepts, so each file can keep juggling several users.
function sessionToken(res) {
  const cookies = res.headers['set-cookie'] || [];
  const c = cookies.find(s => s.startsWith('quodom_session='));
  return c ? decodeURIComponent(c.split(';')[0].slice('quodom_session='.length)) : undefined;
}

module.exports = { sessionToken };
