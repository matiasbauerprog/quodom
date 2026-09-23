const request = require('supertest');
const app = require('../src/server');

// Chains captured on Render on 2026-09-23 for a client at 186.123.216.160.
const VIA_APP = '186.123.216.160, 162.158.42.215, 162.158.42.215,74.220.48.4, 104.22.72.18, 10.30.96.217';
const DIRECT = '186.123.216.160, 172.70.35.175, 10.31.60.69';

const ipSeen = async xff => (await request(app).get('/').set('X-Forwarded-For', xff)).body.ip;

describe('client address behind Render', () => {
  it('finds the client when the request comes through the app rewrite', async () => {
    expect(await ipSeen(VIA_APP)).toBe('186.123.216.160');
  });

  it('finds the client when the request goes straight to the API', async () => {
    expect(await ipSeen(DIRECT)).toBe('186.123.216.160');
  });

  it('ignores addresses a caller writes in front of the chain', async () => {
    expect(await ipSeen('1.2.3.4, 186.123.216.160, 172.70.35.175, 10.31.60.69')).toBe('186.123.216.160');
    expect(await ipSeen('1.2.3.4, ' + VIA_APP)).toBe('186.123.216.160');
  });

  it('does not echo the raw forwarding headers', async () => {
    const res = await request(app).get('/').set('X-Forwarded-For', DIRECT);
    expect(res.body.xff).toBeUndefined();
  });
});
