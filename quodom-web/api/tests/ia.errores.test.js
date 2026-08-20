const { responderFalloIa } = require('../src/helpers/iaErrores');

function resFalso() {
  const res = { statusCode: null, body: null, headers: {} };
  res.set = (k, v) => { res.headers[k] = v; return res; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

beforeAll(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterAll(() => { console.error.mockRestore(); });

describe('responderFalloIa', () => {
  it('mapea un 429 de Gemini a ia_quota con Retry-After', () => {
    const res = resFalso();
    responderFalloIa(res, new Error('gemini: HTTP 429 quota'), 'lista');
    expect(res.statusCode).toBe(429);
    expect(res.body.error).toBe('ia_quota');
    expect(res.headers['Retry-After']).toBe('60');
  });

  it('mapea un 5xx a ia_busy', () => {
    const res = resFalso();
    responderFalloIa(res, new Error('gemini: HTTP 503 unavailable'), 'lista');
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toBe('ia_busy');
    expect(res.headers['Retry-After']).toBe('30');
  });

  it('mapea un timeout a ia_busy', () => {
    const res = resFalso();
    responderFalloIa(res, new Error('gemini: timeout after 2 attempt(s)'), 'lista');
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toBe('ia_busy');
  });

  it('mapea cualquier otro fallo a ia_unavailable', () => {
    const res = resFalso();
    responderFalloIa(res, new Error('boom'), 'lista');
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('ia_unavailable');
  });
});
