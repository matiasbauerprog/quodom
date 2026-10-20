const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');
const { sessionToken } = require('./helpers/session');

let token;
let idquodom;

beforeAll(async () => {
  await db.ready;
  await db.series.create({ codigo: 'QUODOM', utilizado: 0, sigla: 'QD-' });
  await db.Category.bulkCreate([
    { id: 5, nombrecategoria: 'Pintura', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 35, nombrecategoria: 'Latex', idcategoriapadre: 5, activa: true, orden: 1 }
  ]);
  await db.Products.create({
    id: 100, nombreproducto: 'Latex interior 20L', categoria: 35, categoriaPadre: 5,
    atributo1: null, atributo2: null
  });
  await request(app).post('/users/signup').send({
    email: 'ana@test.com', nombre: 'Ana', password: 'secreto123', telefono: '55554444'
  });
  const login = await request(app).post('/users/signin').send({ username: 'ana@test.com', password: 'secreto123' });
  token = sessionToken(login);
  const res = await request(app).post('/quodom/create')
    .set('Authorization', 'Bearer ' + token)
    .send({ descripcion: 'Pintura casa', idrubro: 5 });
  idquodom = res.body.idquodom;
});

// El nombre del Quodom vive en `descripcion`; `detalle` es la descripción
// opcional que el usuario pidió aparte.
describe('detalle del Quodom', () => {
  it('nace vacío', async () => {
    const res = await request(app).get('/quodom/' + idquodom).set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.detalle).toBeNull();
  });

  it('se guarda sin tocar el nombre', async () => {
    const put = await request(app).put('/quodom/' + idquodom)
      .set('Authorization', 'Bearer ' + token)
      .send({ detalle: 'Living y comedor, blanco mate' });
    expect(put.status).toBe(200);

    const res = await request(app).get('/quodom/' + idquodom).set('Authorization', 'Bearer ' + token);
    expect(res.body.detalle).toBe('Living y comedor, blanco mate');
    expect(res.body.descripcion).toBe('Pintura casa');
  });

  it('se puede borrar', async () => {
    await request(app).put('/quodom/' + idquodom)
      .set('Authorization', 'Bearer ' + token)
      .send({ detalle: null });
    const res = await request(app).get('/quodom/' + idquodom).set('Authorization', 'Bearer ' + token);
    expect(res.body.detalle).toBeNull();
  });

  it('repetir la copia', async () => {
    await request(app).put('/quodom/' + idquodom)
      .set('Authorization', 'Bearer ' + token)
      .send({ detalle: 'Frente' });
    await request(app).post('/quodom_lines/add')
      .set('Authorization', 'Bearer ' + token)
      .send({ idquodom, idproducto: 100, cantidad: 1, nombreProducto: 'Latex interior 20L' });
    const rep = await request(app).post('/quodom/repetir/' + idquodom).set('Authorization', 'Bearer ' + token);
    const nuevo = await db.Quodom.findByPk(rep.body.idquodom);
    expect(nuevo.detalle).toBe('Frente');
  });
});
