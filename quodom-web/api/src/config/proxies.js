// Which addresses are our own proxies, so Express can walk X-Forwarded-For
// from the right, skip them, and take the first address it doesn't know as
// the client. Counting hops doesn't work here: through the app's /api rewrite
// there are five proxies in front of the API, straight to the API there are
// two, and a fixed count set for the long path would let a direct caller
// pick their own address by writing it into the header.
//
// Seen on Render (2026-09-23): Cloudflare in front of every service, Render's
// private network last, and the static site's rewrite leaving from
// 74.220.48.4. If GET / on the deployed API stops echoing your real address,
// a new proxy range showed up: add it through TRUSTED_PROXIES.

// https://www.cloudflare.com/ips/
const CLOUDFLARE = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
  '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
  '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32',
  '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32'
];

const RENDER_STATIC_EGRESS = ['74.220.48.0/24'];

function trustedProxies() {
  const extra = (process.env.TRUSTED_PROXIES || '').split(',').map(s => s.trim()).filter(Boolean);
  return ['loopback', 'uniquelocal', ...CLOUDFLARE, ...RENDER_STATIC_EGRESS, ...extra];
}

module.exports = { trustedProxies };
