const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');
const { sessionToken } = require('./helpers/session');

const USER = { username: 'ana', email: 'ana@test.com', nombre: 'Ana', apellido: 'Perez', password: 'secreto123', codArea: '11', telefono: '55554444' };

beforeAll(async () => {
  await db.ready;
  await request(app).post('/users/signup').send(USER);
});

const signin = client => client.post('/users/signin').send({ username: 'ana', password: 'secreto123' });

describe('session cookie', () => {
  it('signin puts the session in a cookie scripts cannot read, and not in the body', async () => {
    const res = await signin(request(app));
    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    expect(res.body.username).toBe('ana');

    const cookie = res.headers['set-cookie'].find(s => s.startsWith('quodom_session='));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\//i);
    expect(cookie).toMatch(/Max-Age=2592000/);
  });

  it('marks the cookie Secure when the request did not come to localhost', async () => {
    const res = await signin(request(app)).set('Host', 'quodom-api.onrender.com').set('X-Forwarded-Proto', 'https');
    const cookie = res.headers['set-cookie'].find(s => s.startsWith('quodom_session='));
    expect(cookie).toMatch(/;\s*Secure/i);
  });

  it('the cookie alone authenticates, and signout ends the session', async () => {
    const agent = request.agent(app);
    await signin(agent);
    expect((await agent.get('/users/current')).status).toBe(200);

    const out = await agent.post('/users/signout');
    expect(out.status).toBe(200);
    expect((await agent.get('/users/current')).status).toBe(401);
  });

  it('a session lasts 30 days, not 200', async () => {
    const token = sessionToken(await signin(request(app)));
    const { exp, iat } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(exp - iat).toBe(30 * 24 * 60 * 60);
  });

  it('signout works without a session, so a stale tab can always log out', async () => {
    const res = await request(app).post('/users/signout');
    expect(res.status).toBe(200);
  });
});
