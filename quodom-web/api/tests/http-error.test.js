const errorHandler = require('../src/middleware/error-handler');
const { httpError } = require('../src/helpers/http-error');

function fakeRes() {
  return {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.payload = body; return this; }
  };
}

describe('http errors with an explicit status', () => {
  it('serializes a thrown httpError with its status, code and extras', () => {
    const res = fakeRes();
    errorHandler(httpError(409, 'rubro_duplicado', 'Ya tenés un Quodom abierto de Bebidas.', { idquodom: 'q-1' }), {}, res, () => {});

    expect(res.statusCode).toBe(409);
    expect(res.payload).toEqual({
      res: false,
      error: 'rubro_duplicado',
      message: 'Ya tenés un Quodom abierto de Bebidas.',
      idquodom: 'q-1'
    });
  });

  it('still maps plain strings to 400', () => {
    const res = fakeRes();
    errorHandler('Algo salió mal.', {}, res, () => {});
    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual({ res: false, message: 'Algo salió mal.' });
  });

  it('still hides unexpected errors behind a 500', () => {
    const res = fakeRes();
    errorHandler(new Error('boom'), {}, res, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.payload).toEqual({ res: false, message: 'Error en el servidor.' });
  });

  it('still handles express-jwt UnauthorizedError with its own messages, not the status branch', () => {
    const err = new Error('jwt expired');
    err.name = 'UnauthorizedError';
    err.status = 401;
    err.code = 'invalid_token';
    err.inner = { name: 'TokenExpiredError', expiredAt: '2026-01-01T00:00:00.000Z' };

    const res = fakeRes();
    errorHandler(err, {}, res, () => {});

    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({ res: false, message: 'Token expirado.', exp: true });
    expect(res.payload.inner).toBeUndefined();
  });
});
