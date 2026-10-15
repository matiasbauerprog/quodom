const rateLimit = require('../src/middleware/rateLimit');

function fakeReqRes(userId) {
  return {
    req: { user: { id: userId } },
    res: {
      _status: 200, _body: null,
      status(s) { this._status = s; return this; },
      json(b) { this._body = b; return this; }
    },
    nextCalled: false,
    next() { this.nextCalled = true; }
  };
}

describe('rateLimit middleware', () => {
  let originalNow;
  beforeEach(() => { originalNow = Date.now; rateLimit._reset(); });
  afterEach(() => { Date.now = originalNow; });

  it('allows requests under the limit', () => {
    const mw = rateLimit.perUserPerMinute(3);
    for (let i = 0; i < 3; i++) {
      const c = fakeReqRes(1);
      mw(c.req, c.res, () => { c.nextCalled = true; });
      expect(c.nextCalled).toBe(true);
    }
  });

  // Dos features distintas no comparten el balde. Sin el scope, buscar
  // direcciones gastaba el cupo del chat de IA y el usuario recibia
  // "Muchos mensajes muy rapido" sin haber mandado ningun mensaje.
  it('no mezcla el cupo de dos scopes distintos para el mismo usuario', () => {
    const lugares = rateLimit.perUserPerMinute(1, 'lugares');
    const ia = rateLimit.perUserPerMinute(1, 'ia');

    const a = fakeReqRes(1);
    lugares(a.req, a.res, () => { a.nextCalled = true; });
    const b = fakeReqRes(1);
    ia(b.req, b.res, () => { b.nextCalled = true; });

    expect(a.nextCalled).toBe(true);
    expect(b.nextCalled).toBe(true);
  });

  it('dentro del mismo scope si cuenta el cupo', () => {
    const lugares = rateLimit.perUserPerMinute(1, 'lugares');

    const a = fakeReqRes(1);
    lugares(a.req, a.res, () => { a.nextCalled = true; });
    const b = fakeReqRes(1);
    lugares(b.req, b.res, () => { b.nextCalled = true; });

    expect(a.nextCalled).toBe(true);
    expect(b.nextCalled).toBe(false);
  });

  it('blocks the request that exceeds the limit within the window', () => {
    const mw = rateLimit.perUserPerMinute(2);
    for (let i = 0; i < 2; i++) {
      const c = fakeReqRes(1);
      mw(c.req, c.res, () => { c.nextCalled = true; });
      expect(c.nextCalled).toBe(true);
    }
    const c3 = fakeReqRes(1);
    mw(c3.req, c3.res, () => { c3.nextCalled = true; });
    expect(c3.nextCalled).toBe(false);
    expect(c3.res._status).toBe(429);
    expect(c3.res._body.error).toBe('rate_limit');
  });

  it('tracks users independently', () => {
    const mw = rateLimit.perUserPerMinute(1);
    const a = fakeReqRes(1);
    mw(a.req, a.res, () => { a.nextCalled = true; });
    const b = fakeReqRes(2);
    mw(b.req, b.res, () => { b.nextCalled = true; });
    expect(a.nextCalled).toBe(true);
    expect(b.nextCalled).toBe(true);
  });

  // El cupo diario tiene balde propio: si compartiera el del minuto, el primer
  // request del día gastaría los dos y los topes no serían dos topes.
  it('el cupo diario no comparte balde con el del minuto', () => {
    const porMinuto = rateLimit.perUserPerMinute(1, 'proveedores', 'minuto');
    const porDia = rateLimit.perUserPerDay(1, 'proveedores', 'dia');

    const a = fakeReqRes(1);
    porMinuto(a.req, a.res, () => { a.nextCalled = true; });
    const b = fakeReqRes(1);
    porDia(b.req, b.res, () => { b.nextCalled = true; });

    expect(a.nextCalled).toBe(true);
    expect(b.nextCalled).toBe(true);
  });

  // Lo que hace que un tope diario sea un tope: una hora después de la primera
  // consulta la cuenta del día tiene que seguir ahí. El barrido descartaba las
  // claves cuya última marca pasaba la hora, así que un balde diario se
  // reiniciaba solo y el tope no existía.
  it('el cupo diario sobrevive a las horas y corta igual', () => {
    Date.now = jest.fn(() => 1_000_000);
    const mw = rateLimit.perUserPerDay(1, 'proveedores', 'dia');
    const a = fakeReqRes(1);
    mw(a.req, a.res, () => { a.nextCalled = true; });
    expect(a.nextCalled).toBe(true);

    Date.now = jest.fn(() => 1_000_000 + 5 * 60 * 60_000);
    const b = fakeReqRes(1);
    mw(b.req, b.res, () => { b.nextCalled = true; });
    expect(b.nextCalled).toBe(false);
    expect(b.res._status).toBe(429);
    expect(b.res._body.message).toBe('dia');

    // Pasado el día, vuelve a dejar pasar.
    Date.now = jest.fn(() => 1_000_000 + 25 * 60 * 60_000);
    const c = fakeReqRes(1);
    mw(c.req, c.res, () => { c.nextCalled = true; });
    expect(c.nextCalled).toBe(true);
  });

  it('forgets timestamps older than the window', () => {
    Date.now = jest.fn(() => 1_000_000);
    const mw = rateLimit.perUserPerMinute(1);
    const c1 = fakeReqRes(1);
    mw(c1.req, c1.res, () => { c1.nextCalled = true; });
    expect(c1.nextCalled).toBe(true);

    Date.now = jest.fn(() => 1_000_000 + 61_000);
    const c2 = fakeReqRes(1);
    mw(c2.req, c2.res, () => { c2.nextCalled = true; });
    expect(c2.nextCalled).toBe(true);
  });
});
