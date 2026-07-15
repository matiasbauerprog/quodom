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
  beforeEach(() => { rateLimit._reset(); });

  it('allows requests under the limit', () => {
    const mw = rateLimit.perUserPerMinute(3);
    for (let i = 0; i < 3; i++) {
      const c = fakeReqRes(1);
      mw(c.req, c.res, () => { c.nextCalled = true; });
      expect(c.nextCalled).toBe(true);
    }
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

  it('forgets timestamps older than the window', () => {
    const originalNow = Date.now;
    Date.now = jest.fn(() => 1_000_000);
    const mw = rateLimit.perUserPerMinute(1);
    const c1 = fakeReqRes(1);
    mw(c1.req, c1.res, () => { c1.nextCalled = true; });
    expect(c1.nextCalled).toBe(true);

    Date.now = jest.fn(() => 1_000_000 + 61_000);
    const c2 = fakeReqRes(1);
    mw(c2.req, c2.res, () => { c2.nextCalled = true; });
    expect(c2.nextCalled).toBe(true);

    Date.now = originalNow;
  });
});
