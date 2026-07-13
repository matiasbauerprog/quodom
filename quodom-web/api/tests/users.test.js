const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');

beforeAll(async () => { await db.ready; });

const USER = {
  username: 'juan',
  email: 'juan@test.com',
  nombre: 'Juan',
  apellido: 'Perez',
  password: 'secreto123',
  codArea: '11',
  telefono: '55554444'
};

const USER2 = {
  username: 'maria',
  email: 'maria@test.com',
  nombre: 'Maria',
  apellido: 'Lopez',
  password: 'secreto123',
  codArea: '11',
  telefono: '55558888'
};

describe('users', () => {
  let token;
  let userId;
  let token2;
  let userId2;

  it('POST /users/signup creates a user', async () => {
    const res = await request(app).post('/users/signup').send(USER);
    expect(res.status).toBe(200);
    expect(res.body.res).toBe(true);
    expect(res.body.id).toBeDefined();
    userId = res.body.id;
  });

  it('POST /users/signup rejects duplicate email', async () => {
    const res = await request(app).post('/users/signup').send({ ...USER, username: 'otro' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ res: false, message: 'El correo electrónico ya está en uso.' });
  });

  it('POST /users/signin returns a token (by username or email)', async () => {
    const res = await request(app).post('/users/signin')
      .send({ username: 'juan@test.com', password: 'secreto123' });
    expect(res.status).toBe(200);
    expect(res.body.res).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.password).toBeUndefined();
    token = res.body.token;
  });

  it('POST /users/signin rejects wrong password', async () => {
    const res = await request(app).post('/users/signin')
      .send({ username: 'juan', password: 'incorrecta' });
    expect(res.status).toBe(400);
    expect(res.body.res).toBe(false);
  });

  it('GET /users/current returns the logged user', async () => {
    const res = await request(app).get('/users/current')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('juan@test.com');
    expect(res.body.password).toBeUndefined();
    userId = res.body.id;
  });

  it('GET /users/current without token returns 401', async () => {
    const res = await request(app).get('/users/current');
    expect(res.status).toBe(401);
  });

  it('PUT /users updates the profile', async () => {
    const res = await request(app).put('/users')
      .set('Authorization', 'Bearer ' + token)
      .send({ nombre: 'Juan Carlos' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ res: true, message: 'Actualizado.' });
  });

  it('PUT /users strips mass-assignment fields like role, emailValidado, activo', async () => {
    const res = await request(app).put('/users')
      .set('Authorization', 'Bearer ' + token)
      .send({ nombre: 'Ana2', role: 'admin', emailValidado: false, activo: false });
    expect(res.status).toBe(200);
    const login = await request(app).post('/users/signin')
      .send({ username: 'juan', password: 'secreto123' });
    expect(login.status).toBe(200);
    const record = await db.User.scope('withHash').findByPk(userId);
    expect(record.nombre).toBe('Ana2');
    expect(record.role).toBe('user');
    expect(record.activo).toBe(true);
  });

  it('POST /users/signup creates a second user', async () => {
    const res = await request(app).post('/users/signup').send(USER2);
    expect(res.status).toBe(200);
    expect(res.body.res).toBe(true);
    userId2 = res.body.id;
  });

  it('POST /users/signin returns token for second user', async () => {
    const res = await request(app).post('/users/signin')
      .send({ username: 'maria', password: 'secreto123' });
    expect(res.status).toBe(200);
    token2 = res.body.token;
  });

  it('GET /users/:id of another user returns 401', async () => {
    const res = await request(app).get('/users/' + userId)
      .set('Authorization', 'Bearer ' + token2);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ res: false, message: 'Error de Id.' });
  });
});
