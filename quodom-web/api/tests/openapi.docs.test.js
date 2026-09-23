const request = require('supertest');

describe('/docs', () => {
  afterEach(() => { delete process.env.API_DOCS; jest.resetModules(); });

  it('does not exist unless API_DOCS=true', async () => {
    const app = require('../src/server');
    const res = await request(app).get('/docs/');
    expect(res.status).toBe(404);
  });

  it('serves the docs page when API_DOCS=true', async () => {
    process.env.API_DOCS = 'true';
    const app = require('../src/server');
    const res = await request(app).get('/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/swagger-ui/i);
  });
});
