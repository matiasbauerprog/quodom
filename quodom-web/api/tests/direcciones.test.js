const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');

let token;
let iddireccion;

beforeAll(async () => {
  await db.ready;
  await db.provincia.create({ id: 1, provincia: 'Buenos Aires' });
  await request(app).post('/users/signup').send({
    username: 'ana', email: 'ana@test.com', nombre: 'Ana', password: 'secreto123',
    codArea: '11', telefono: '55554444'
  });
  const login = await request(app).post('/users/signin').send({ username: 'ana', password: 'secreto123' });
  token = login.body.token;
});

describe('direcciones', () => {
  it('GET /provincias returns the list without auth', async () => {
    const res = await request(app).get('/provincias');
    expect(res.status).toBe(200);
    expect(res.body[0].provincia).toBe('Buenos Aires');
  });

  it('POST /user_direcciones/create resolves provincia name and owner from token', async () => {
    const res = await request(app).post('/user_direcciones/create')
      .set('Authorization', 'Bearer ' + token)
      .send({
        alias: 'Casa', calle: 'Corrientes', numero: '1234', cp: '1043',
        localidad: 'CABA', idprovincia: 1, default: true
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ res: true, message: 'Creado.' });

    const dirs = await request(app).get('/users/dire/').set('Authorization', 'Bearer ' + token);
    expect(dirs.body).toHaveLength(1);
    expect(dirs.body[0].provincia).toBe('Buenos Aires');
    iddireccion = dirs.body[0].id;
  });

  it('PUT /user_direcciones/prin/:id works even without previous default', async () => {
    const res = await request(app).put('/user_direcciones/prin/' + iddireccion)
      .set('Authorization', 'Bearer ' + token)
      .send({});
    expect(res.status).toBe(200);
  });

  it('GET /users/direcciondefault returns the default address', async () => {
    const res = await request(app).get('/users/direcciondefault/')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.alias).toBe('Casa');
  });

  it('GET /user_direcciones/:id of another user fails', async () => {
    await request(app).post('/users/signup').send({
      username: 'beto', email: 'beto@test.com', nombre: 'Beto', password: 'secreto123',
      codArea: '11', telefono: '55553333'
    });
    const login2 = await request(app).post('/users/signin').send({ username: 'beto', password: 'secreto123' });
    const res = await request(app).get('/user_direcciones/' + iddireccion)
      .set('Authorization', 'Bearer ' + login2.body.token);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('La dirección no pertenece a el usuario.');
  });

  it('PUT /user_direcciones/:id strips protected fields like userid', async () => {
    const res = await request(app).put('/user_direcciones/' + iddireccion)
      .set('Authorization', 'Bearer ' + token)
      .send({ alias: 'Casa 2', userid: 'hacked', provincia: 'Marte' });
    expect(res.status).toBe(200);
    const dirs = await request(app).get('/users/dire/').set('Authorization', 'Bearer ' + token);
    expect(dirs.body).toHaveLength(1);
    expect(dirs.body[0].alias).toBe('Casa 2');
    expect(dirs.body[0].provincia).toBe('Buenos Aires');
  });

  it('DELETE /user_direcciones/:id removes the address', async () => {
    const res = await request(app).delete('/user_direcciones/' + iddireccion)
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.res).toBe(true);
  });
});
