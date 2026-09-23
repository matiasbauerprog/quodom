const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');
const { sessionToken } = require('./helpers/session');

let token;
let idquodom;
let idline;

beforeAll(async () => {
  await db.ready;
  await db.series.create({ codigo: 'QUODOM', utilizado: 0, sigla: 'QD-' });
  await db.Category.bulkCreate([
    { id: 5, nombrecategoria: 'Pintura', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 35, nombrecategoria: 'Latex', idcategoriapadre: 5, activa: true, orden: 1 }
  ]);
  await db.Products.create({ id: 100, nombreproducto: 'Latex 20L', categoria: 35, categoriaPadre: 5, atributo1: 'LITROS' });
  await db.provincia.create({ id: 1, provincia: 'Buenos Aires' });
  await request(app).post('/users/signup').send({
    username: 'ana', email: 'ana@test.com', nombre: 'Ana', password: 'secreto123', codArea: '11', telefono: '5555'
  });
  token = sessionToken(await request(app).post('/users/signin').send({ username: 'ana', password: 'secreto123' }));
  await request(app).post('/user_direcciones/create').set('Authorization', 'Bearer ' + token)
    .send({ alias: 'Casa', calle: 'Falsa', numero: '123', cp: '1000', localidad: 'CABA', idprovincia: 1, default: true });
  idquodom = (await request(app).post('/quodom/create').set('Authorization', 'Bearer ' + token)
    .send({ descripcion: 'Pintura', idrubro: 5 })).body.idquodom;
  idline = (await request(app).post('/quodom_lines/add').set('Authorization', 'Bearer ' + token)
    .send({ idquodom, idproducto: 100, cantidad: 1, atributo1: '4 litros' })).body.id;
});

describe('request validation against openapi.yaml', () => {
  it('rejects a body missing a required field, in the usual shape and in Spanish', async () => {
    const res = await request(app).post('/users/signup')
      .send({ username: 'x', email: 'x@test.com', nombre: 'X', password: 'secreto123', codArea: '11' });
    expect(res.status).toBe(400);
    expect(res.body.res).toBe(false);
    expect(res.body.message).toBe('Faltan datos o hay datos inválidos: telefono');
  });

  it('names every bad field', async () => {
    const res = await request(app).post('/users/signup').send({ username: 'x', email: 'no-es-mail', nombre: 'X', password: '123', codArea: '11', telefono: '1' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email/);
    expect(res.body.message).toMatch(/password/);
  });

  it('keeps answering 404 Route-not-found for an unknown route', async () => {
    const res = await request(app).get('/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ res: false, message: 'Route-not-found' });
  });

  it('keeps answering 404 Route-not-found for a known path with an unknown method', async () => {
    const res = await request(app).patch('/categorias');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ res: false, message: 'Route-not-found' });
  });

  it('answers the same with or without a trailing slash', async () => {
    const a = await request(app).get('/users/dire').set('Authorization', 'Bearer ' + token);
    const b = await request(app).get('/users/dire/').set('Authorization', 'Bearer ' + token);
    expect(b.status).toBe(200);
    expect(b.body).toEqual(a.body);
    const put = await request(app).put('/users/').set('Authorization', 'Bearer ' + token).send({ nombre: 'Ana' });
    expect(put.status).toBe(200);
  });

  it('still answers 401 to a valid request without a session', async () => {
    const res = await request(app).post('/quodom/create').send({ descripcion: 'x', idrubro: 5 });
    expect(res.status).toBe(401);
  });

  it('an empty atributo on update leaves the chosen one untouched, as before', async () => {
    const res = await request(app).put('/quodom_lines/' + idline).set('Authorization', 'Bearer ' + token)
      .send({ cantidad: 2, atributo1: '' });
    expect(res.status).toBe(200);
    const linea = await db.Quodom_Lines.findByPk(idline);
    expect(linea.atributo1).toBe('4 litros');
    expect(Number(linea.cantidad)).toBe(2);
  });

  it('iddireccion null on create still falls back to the default address', async () => {
    await request(app).delete('/quodom/' + idquodom).set('Authorization', 'Bearer ' + token);
    const res = await request(app).post('/quodom/create').set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Otra', idrubro: 5, iddireccion: null });
    expect(res.status).toBe(200);
    const q = await db.Quodom.findByPk(res.body.idquodom);
    expect(q.iddireccion).not.toBeNull();
  });
});
