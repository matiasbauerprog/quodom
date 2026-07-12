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

describe('users', () => {
  let token;

  it('POST /users/signup creates a user', async () => {
    const res = await request(app).post('/users/signup').send(USER);
    expect(res.status).toBe(200);
    expect(res.body.res).toBe(true);
    expect(res.body.id).toBeDefined();
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
});
