/**
 * El perfil se achicó a lo que el proveedor necesita y creció con los datos de
 * facturación. Se entra con el mail: `username` sigue existiendo en la base
 * para que las cuentas viejas puedan seguir entrando, pero ya no se pide ni se
 * edita — al registrarse queda igual al mail.
 */
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');
const { sessionToken } = require('./helpers/session');

const AUTH = 'Authorization';

const ALTA = {
  email: 'nueva@test.com', nombre: 'Ana', apellido: 'Perez',
  password: 'secreto123', telefono: '55554444'
};

async function registrar(extra = {}) {
  return request(app).post('/users/signup').send({ ...ALTA, ...extra });
}

async function entrar(email, password = 'secreto123') {
  const login = await request(app).post('/users/signin').send({ username: email, password });
  return sessionToken(login);
}

beforeAll(async () => {
  await db.ready;
});

describe('alta sin usuario', () => {
  it('crea la cuenta sin que le manden username', async () => {
    const res = await registrar();

    expect(res.status).toBe(200);
    expect(res.body.res).toBe(true);
  });

  it('guarda el mail como username, para que el login por mail y por usuario sean lo mismo', async () => {
    await registrar({ email: 'espejo@test.com' });

    const user = await db.User.findOne({ where: { email: 'espejo@test.com' } });
    expect(user.username).toBe('espejo@test.com');
  });

  it('deja entrar con el mail', async () => {
    await registrar({ email: 'entra@test.com' });

    const login = await request(app).post('/users/signin').send({ username: 'entra@test.com', password: 'secreto123' });

    expect(login.status).toBe(200);
  });

  // El campo está fijo en la app; el servidor no depende de que lo manden.
  it('deja el código de área en 011 sin que se lo manden', async () => {
    await registrar({ email: 'area@test.com' });

    const user = await db.User.findOne({ where: { email: 'area@test.com' } });
    expect(user.codArea).toBe('011');
  });

  it('rechaza un mail repetido', async () => {
    await registrar({ email: 'repetido@test.com' });

    const res = await registrar({ email: 'repetido@test.com' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/correo/i);
  });
});

describe('datos de empresa', () => {
  let token;
  beforeAll(async () => {
    await registrar({ email: 'empresa@test.com' });
    token = await entrar('empresa@test.com');
  });

  it('los guarda y los devuelve en /users/current', async () => {
    const res = await request(app).put('/users/').set(AUTH, 'Bearer ' + token)
      .send({ empresa: 'Command Soluciones', cuit: '30-71234567-8', facturaA: true });
    expect(res.status).toBe(200);

    const actual = await request(app).get('/users/current').set(AUTH, 'Bearer ' + token);
    expect(actual.body.empresa).toBe('Command Soluciones');
    expect(actual.body.cuit).toBe('30-71234567-8');
    expect(actual.body.facturaA).toBe(true);
  });

  it('acepta destildar Factura A', async () => {
    await request(app).put('/users/').set(AUTH, 'Bearer ' + token).send({ facturaA: false });

    const actual = await request(app).get('/users/current').set(AUTH, 'Bearer ' + token);
    expect(actual.body.facturaA).toBe(false);
  });
});

describe('campos que ya no se editan', () => {
  let token;
  beforeAll(async () => {
    await registrar({ email: 'fijos@test.com' });
    token = await entrar('fijos@test.com');
  });

  // El contrato es el que valida: un campo que no está declarado lo borra el
  // validador antes de llegar al handler.
  it('ignora el dni que le manden', async () => {
    await request(app).put('/users/').set(AUTH, 'Bearer ' + token).send({ nombre: 'Ana', dni: '12345678' });

    const user = await db.User.findOne({ where: { email: 'fijos@test.com' } });
    expect(user.dni).toBeFalsy();
  });

  it('ignora un username nuevo: se entra con el mail', async () => {
    await request(app).put('/users/').set(AUTH, 'Bearer ' + token).send({ nombre: 'Ana', username: 'otrousuario' });

    const user = await db.User.findOne({ where: { email: 'fijos@test.com' } });
    expect(user.username).toBe('fijos@test.com');
  });
});
