const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const app = require('../src/server');
const { listRoutes } = require('../src/helpers/listRoutes');

const SPEC = YAML.parse(fs.readFileSync(path.join(__dirname, '..', 'openapi.yaml'), 'utf8'));
const METHODS = ['get', 'post', 'put', 'delete', 'patch'];

const key = r => r.method.toUpperCase() + ' ' + r.path;
const enCodigo = listRoutes(app).map(key);
const enSpec = Object.entries(SPEC.paths || {}).flatMap(([p, ops]) =>
  Object.keys(ops).filter(m => METHODS.includes(m)).map(m => m.toUpperCase() + ' ' + p));

describe('openapi.yaml covers the API', () => {
  it('describes every route the code answers', () => {
    const faltan = enCodigo.filter(k => !enSpec.includes(k));
    expect(faltan).toEqual([]);
  });

  it('describes no route the code does not answer', () => {
    const sobran = enSpec.filter(k => !enCodigo.includes(k));
    expect(sobran).toEqual([]);
  });

  it('lists the routes this test expects to find', () => {
    // Guards listRoutes itself: if it silently returned nothing, the two tests
    // above would pass on an empty API.
    expect(enCodigo).toEqual(expect.arrayContaining(['GET /', 'GET /categorias', 'POST /users/signin', 'POST /api/ia/chat']));
    expect(enCodigo.length).toBe(57);
  });
});
