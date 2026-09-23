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
    { id: 7, nombrecategoria: 'Bebidas', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 70, nombrecategoria: 'Gaseosas', idcategoriapadre: 7, activa: true, orden: 1 }
  ]);
  await db.Products.create({
    id: 700, nombreproducto: 'Gaseosa 2L', categoria: 70, categoriaPadre: 7,
    atributo1: 'Sabor', atributo2: null
  });

  await request(app).post('/users/signup').send({
    username: 'merge', email: 'merge@test.com', nombre: 'Merge', password: 'secreto123',
    codArea: '11', telefono: '55554444'
  });
  const login = await request(app).post('/users/signin').send({ username: 'merge', password: 'secreto123' });
  token = sessionToken(login);

  const created = await request(app).post('/quodom/create')
    .set('Authorization', 'Bearer ' + token)
    .send({ descripcion: 'Bebidas', idrubro: 7 });
  idquodom = created.body.idquodom;
});

describe('POST /quodom_lines/add merges matching lines', () => {
  it('sums cantidad instead of duplicating the line when product and attributes match', async () => {
    const first = await request(app).post('/quodom_lines/add')
      .set('Authorization', 'Bearer ' + token)
      .send({ idquodom, idproducto: 700, cantidad: 2, nombreProducto: 'Gaseosa 2L', atributo1: 'Cola' });
    expect(first.status).toBe(200);

    const second = await request(app).post('/quodom_lines/add')
      .set('Authorization', 'Bearer ' + token)
      .send({ idquodom, idproducto: 700, cantidad: 3, nombreProducto: 'Gaseosa 2L', atributo1: 'Cola' });
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);

    const lines = await db.Quodom_Lines.findAll({ where: { idquodom, idproducto: 700 } });
    expect(lines.length).toBe(1);
    expect(Number(lines[0].cantidad)).toBe(5);
  });

  it('keeps separate lines when atributo1 differs', async () => {
    const cola = await request(app).post('/quodom_lines/add')
      .set('Authorization', 'Bearer ' + token)
      .send({ idquodom, idproducto: 700, cantidad: 1, nombreProducto: 'Gaseosa 2L', atributo1: 'Cola' });
    const lima = await request(app).post('/quodom_lines/add')
      .set('Authorization', 'Bearer ' + token)
      .send({ idquodom, idproducto: 700, cantidad: 1, nombreProducto: 'Gaseosa 2L', atributo1: 'Lima' });

    expect(cola.status).toBe(200);
    expect(lima.status).toBe(200);
    expect(cola.body.id).not.toBe(lima.body.id);

    const limaLines = await db.Quodom_Lines.findAll({ where: { idquodom, idproducto: 700, atributo1: 'Lima' } });
    expect(limaLines.length).toBe(1);
    expect(Number(limaLines[0].cantidad)).toBe(1);
  });
});
