const request = require('supertest');
const app = require('../src/server');

describe('GET /', () => {
  it('returns API info', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Quodom API');
    expect(res.body.name).toBe('quodom-web-api');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ res: false, message: 'Route-not-found' });
  });
});
