process.env.AUTH_LIMIT_RESET_PER_IP = '3';
process.env.AUTH_LIMIT_RESET_PER_EMAIL = '2';
process.env.AUTH_LIMIT_SIGNIN_PER_IP = '4';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/server');
const db = require('../src/helpers/db');
const correo = require('../src/helpers/email');
const rateLimit = require('../src/middleware/rateLimit');

const ANA = { username: 'ana', email: 'ana@test.com', nombre: 'Ana', apellido: 'Perez', password: 'secreto123', codArea: '11', telefono: '55554444' };
const BETO = { username: 'beto', email: 'beto@test.com', nombre: 'Beto', apellido: 'Gomez', password: 'secreto123', codArea: '11', telefono: '44443333' };

let anaId;
let anaToken;
let betoToken;
let ip = 0;
// A fresh client address per test, so one test's attempts don't spend another's budget.
const nextIp = () => '10.0.0.' + (++ip);

async function pedirReset(email, from = nextIp()) {
  const spy = jest.spyOn(correo, 'sendEmail').mockResolvedValue(true);
  const res = await request(app).post('/users/reset').set('X-Forwarded-For', from).send({ email });
  const link = spy.mock.calls.length ? spy.mock.calls[0][1] : null;
  spy.mockRestore();
  return { res, token: link && link.split('/').pop(), link };
}

beforeAll(async () => {
  await db.ready;
  await db.series.create({ codigo: 'QUODOM', utilizado: 0, sigla: 'QD-' });
  await db.Category.create({ id: 5, nombrecategoria: 'Pintura', idcategoriapadre: 0, activa: true, orden: 1 });
  anaId = (await request(app).post('/users/signup').send(ANA)).body.id;
  await request(app).post('/users/signup').send(BETO);
  anaToken = (await request(app).post('/users/signin').send({ username: 'ana', password: 'secreto123' })).body.token;
  betoToken = (await request(app).post('/users/signin').send({ username: 'beto', password: 'secreto123' })).body.token;
});

beforeEach(() => rateLimit._reset());

describe('purpose-bound tokens', () => {
  it('a password-reset link cannot be used to sign in as that user', async () => {
    const { token } = await pedirReset('ana@test.com');
    expect(token).toBeTruthy();
    const res = await request(app).get('/users/current').set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(401);
  });

  it('an email-validation link cannot be used to sign in as that user', async () => {
    const token = jwt.sign({ sub: anaId, action: 'validar' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const res = await request(app).get('/users/current').set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(401);
  });

  it('a session token cannot validate an email', async () => {
    const res = await request(app).get('/users/validateEmail/' + anaToken);
    expect(res.body.res).toBe(false);
  });

  it('the reset email points to the route the app actually serves', async () => {
    const { link } = await pedirReset('ana@test.com');
    expect(link).toMatch(/\/reset\/[^/]+$/);
  });

  it('a reset link works once and then stops working', async () => {
    const { token } = await pedirReset('ana@test.com');
    expect((await request(app).get('/users/validateReset/' + token)).body.res).toBe(true);

    const first = await request(app).post('/users/changePass').send({ token, password: 'nueva123' });
    expect(first.body.res).toBe(true);

    const second = await request(app).post('/users/changePass').send({ token, password: 'otra1234' });
    expect(second.body.res).toBe(false);
    expect((await request(app).get('/users/validateReset/' + token)).body.res).toBe(false);

    const login = await request(app).post('/users/signin').send({ username: 'ana', password: 'nueva123' });
    expect(login.status).toBe(200);
    anaToken = login.body.token;
  });
});

describe('reset does not reveal who is registered', () => {
  it('answers the same for an unknown address as for a known one', async () => {
    const known = await pedirReset('beto@test.com');
    const unknown = await pedirReset('nadie@test.com');
    expect(unknown.res.status).toBe(known.res.status);
    expect(unknown.res.body).toEqual(known.res.body);
    expect(unknown.token).toBeNull();
  });

  it('reenviar answers the same for an unknown address as for a known one', async () => {
    const spy = jest.spyOn(correo, 'sendEmail').mockResolvedValue(true);
    const known = await request(app).post('/users/reenviar').set('X-Forwarded-For', nextIp()).send({ email: 'beto@test.com' });
    const unknown = await request(app).post('/users/reenviar').set('X-Forwarded-For', nextIp()).send({ email: 'nadie@test.com' });
    spy.mockRestore();
    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
  });
});

describe('infoComprador', () => {
  let idquodom;
  beforeAll(async () => {
    const q = await request(app).post('/quodom/create').set('Authorization', 'Bearer ' + anaToken)
      .send({ descripcion: 'Pintura', idrubro: 5 });
    idquodom = q.body.idquodom;
  });

  it('returns the owner their own contact data', async () => {
    const res = await request(app).get('/users/infoComprador/' + idquodom).set('Authorization', 'Bearer ' + anaToken);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('ana@test.com');
  });

  it("does not show another user's contact data", async () => {
    const res = await request(app).get('/users/infoComprador/' + idquodom).set('Authorization', 'Bearer ' + betoToken);
    expect(res.status).toBe(404);
    expect(res.body.email).toBeUndefined();
  });
});

describe('rate limits on the sign-in and recovery endpoints', () => {
  it('stops asking for reset links from one address', async () => {
    const from = nextIp();
    const emails = ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com'];
    const statuses = [];
    for (const e of emails) statuses.push((await pedirReset(e, from)).res.status);
    expect(statuses).toEqual([200, 200, 200, 429]);
  });

  it('stops mailing one inbox even when the requests come from many addresses', async () => {
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await pedirReset('beto@test.com', nextIp())).res.status);
    expect(statuses).toEqual([200, 200, 429]);
  });

  it('counts the inbox limit case-insensitively', async () => {
    await pedirReset('beto@test.com');
    await pedirReset('BETO@test.com');
    expect((await pedirReset('Beto@Test.com')).res.status).toBe(429);
  });

  it('stops guessing passwords from one address', async () => {
    const from = nextIp();
    const statuses = [];
    for (let i = 0; i < 5; i++) {
      const r = await request(app).post('/users/signin').set('X-Forwarded-For', from)
        .send({ username: 'beto', password: 'mala' + i });
      statuses.push(r.status);
    }
    expect(statuses).toEqual([400, 400, 400, 400, 429]);
  });

  it('answers 429 in the usual error shape', async () => {
    const from = nextIp();
    let res;
    for (let i = 0; i < 5; i++) {
      res = await request(app).post('/users/signin').set('X-Forwarded-For', from).send({ username: 'x', password: 'y' });
    }
    expect(res.status).toBe(429);
    expect(res.body.res).toBe(false);
    expect(res.body.message).toMatch(/intentos/);
  });
});
