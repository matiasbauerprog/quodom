const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');
const { RUBROS_ACTIVOS, esRubroActivo } = require('../src/config/rubros');

let token;

beforeAll(async () => {
  await db.ready;
  await db.series.create({ codigo: 'QUODOM', utilizado: 0, sigla: 'QD-' });
  // Bebidas (7) está en la whitelist; Construcción (4) quedó fuera, aunque en
  // la base siga marcada como activa: la lista de rubros vive en el código.
  await db.Category.bulkCreate([
    { id: 7, nombrecategoria: 'Bebidas', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 4, nombrecategoria: 'Construcción', idcategoriapadre: 0, activa: true, orden: 2 },
    { id: 70, nombrecategoria: 'Gaseosas', idcategoriapadre: 7, activa: true, orden: 1 },
    { id: 40, nombrecategoria: 'Cementos', idcategoriapadre: 4, activa: true, orden: 1 }
  ]);
  await db.Products.bulkCreate([
    { id: 700, nombreproducto: 'Gaseosa cola 2L', descripcion: 'Bebida sin alcohol', categoria: 70, categoriaPadre: 7 },
    { id: 400, nombreproducto: 'Cemento cola 50kg', descripcion: 'Bolsa de cemento', categoria: 40, categoriaPadre: 4 }
  ]);

  const user = {
    username: 'ana', email: 'ana@test.com', nombre: 'Ana', password: 'secreto123',
    codArea: '11', telefono: '55554444'
  };
  await request(app).post('/users/signup').send(user);
  const login = await request(app).post('/users/signin').send({ username: 'ana', password: 'secreto123' });
  token = login.body.token;
});

describe('rubros activos', () => {
  it('la whitelist son los cinco rubros del lanzamiento', () => {
    expect(RUBROS_ACTIVOS).toEqual([1, 2, 3, 5, 7]);
    expect(esRubroActivo(7)).toBe(true);
    expect(esRubroActivo(4)).toBe(false);
    // Los ids llegan como string desde los params de Express.
    expect(esRubroActivo('7')).toBe(true);
    expect(esRubroActivo('4')).toBe(false);
  });

  it('GET /categorias sólo devuelve rubros de la whitelist', async () => {
    const res = await request(app).get('/categorias');
    expect(res.status).toBe(200);
    expect(res.body.map(c => c.id)).toEqual([7]);
  });

  it('GET /categorias/Sub/:id devuelve vacío para un rubro inactivo', async () => {
    const activo = await request(app).get('/categorias/Sub/7');
    expect(activo.body).toHaveLength(1);

    const res = await request(app).get('/categorias/Sub/4');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /categorias/:id no expone un rubro inactivo ni sus subcategorías', async () => {
    expect((await request(app).get('/categorias/7')).status).toBe(200);
    expect((await request(app).get('/categorias/4')).status).toBe(404);
    expect((await request(app).get('/categorias/40')).status).toBe(404);
  });

  it('GET /productos/categoria/:id no devuelve productos de un rubro inactivo', async () => {
    const activo = await request(app).get('/productos/categoria/70');
    expect(activo.body).toHaveLength(1);

    const res = await request(app).get('/productos/categoria/40');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /productos/:id no expone un producto de un rubro inactivo', async () => {
    expect((await request(app).get('/productos/700')).status).toBe(200);
    expect((await request(app).get('/productos/400')).status).toBe(400);
  });

  it('GET /busqueda deja fuera los productos de rubros inactivos', async () => {
    const res = await request(app).get('/busqueda').query({ b: 'cola' });
    expect(res.status).toBe(200);
    expect(res.body.map(p => p.id)).toEqual([700]);
  });

  it('POST /quodom/create rechaza un rubro fuera de la whitelist', async () => {
    const res = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Obra', idrubro: 4 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('idrubro_invalido');
  });
});
