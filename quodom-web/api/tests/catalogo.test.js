const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');

beforeAll(async () => {
  await db.ready;
  await db.Category.bulkCreate([
    { id: 5, nombrecategoria: 'Pintura', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 35, nombrecategoria: 'Latex', idcategoriapadre: 5, activa: true, orden: 1 },
    { id: 36, nombrecategoria: 'Esmaltes', idcategoriapadre: 5, activa: false, orden: 2 }
  ]);
  await db.Products.bulkCreate([
    { id: 100, nombreproducto: 'Latex interior 20L', descripcion: 'Pintura latex lavable', categoria: 35, categoriaPadre: 5 },
    { id: 101, nombreproducto: 'Rodillo semilana', descripcion: 'Rodillo 22cm', categoria: 35, categoriaPadre: 5 }
  ]);
});

describe('catalogo', () => {
  it('GET /categorias returns active root categories without auth', async () => {
    const res = await request(app).get('/categorias');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].nombrecategoria).toBe('Pintura');
  });

  it('GET /categorias/Sub/:id returns active subcategories', async () => {
    const res = await request(app).get('/categorias/Sub/5');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].nombrecategoria).toBe('Latex');
  });

  it('GET /productos/categoria/:idcategoria returns products without auth', async () => {
    const res = await request(app).get('/productos/categoria/35');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('GET /productos/:id returns one product', async () => {
    const res = await request(app).get('/productos/100');
    expect(res.status).toBe(200);
    expect(res.body.nombreproducto).toBe('Latex interior 20L');
  });

  it('GET /busqueda?b=latex finds by nombre or descripcion', async () => {
    const res = await request(app).get('/busqueda').query({ b: 'latex' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].nombre).toBe('Latex interior 20L');
  });

  it('GET /busqueda without b returns empty array', async () => {
    const res = await request(app).get('/busqueda');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /hist_busquedas requires auth', async () => {
    const res = await request(app).get('/hist_busquedas');
    expect(res.status).toBe(401);
  });
});
