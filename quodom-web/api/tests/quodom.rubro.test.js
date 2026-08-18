const db = require('../src/helpers/db');

beforeAll(async () => {
  await db.ready;
  await db.Category.bulkCreate([
    { id: 7, nombrecategoria: 'Bebidas', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 4, nombrecategoria: 'Construcción', idcategoriapadre: 0, activa: true, orden: 2 }
  ]);

  // Las subcategorías tienen que existir: add() llama a getCat(producto.categoria)
  // y lanza 'Err. Id de categoria no encontrado.' (400) si falta, lo que haría
  // fallar el caso feliz antes de llegar a la validación de rubro.
  await db.Category.bulkCreate([
    { id: 70, nombrecategoria: 'Gaseosas', idcategoriapadre: 7, activa: true, orden: 1 },
    { id: 40, nombrecategoria: 'Cementos', idcategoriapadre: 4, activa: true, orden: 1 }
  ]);
  await db.Products.bulkCreate([
    { id: 700, nombreproducto: 'Gaseosa 2L', categoria: 70, categoriaPadre: 7, atributo1: null, atributo2: null },
    { id: 400, nombreproducto: 'Cemento 50kg', categoria: 40, categoriaPadre: 4, atributo1: null, atributo2: null }
  ]);
});

describe('quodom rubro column', () => {
  it('stores idrubro on the quodom header', async () => {
    const q = await db.Quodom.create({
      descripcion: 'Bebidas oficina', createdBy: 'u-1', estado: 'CREADO', idrubro: 7
    });
    const reloaded = await db.Quodom.findByPk(q.id);
    expect(reloaded.idrubro).toBe(7);
  });

  it('exposes idrubro and nombrerubro through v_Quodoms', async () => {
    const q = await db.Quodom.create({
      descripcion: 'Obra', createdBy: 'u-2', estado: 'CREADO', idrubro: 4
    });
    const row = await db.v_Quodoms.findOne({ where: { id: q.id } });
    expect(row.idrubro).toBe(4);
    expect(row.nombrerubro).toBe('Construcción');
  });
});

const request = require('supertest');
const app = require('../src/server');

describe('create enforces one open quodom per rubro', () => {
  let token;

  beforeAll(async () => {
    await db.series.findOrCreate({ where: { codigo: 'QUODOM' }, defaults: { codigo: 'QUODOM', utilizado: 0, sigla: 'QD-' } });
    await request(app).post('/users/signup').send({
      username: 'rubro', email: 'rubro@test.com', nombre: 'Rubro', password: 'secreto123',
      codArea: '11', telefono: '55554444'
    });
    const login = await request(app).post('/users/signin').send({ username: 'rubro', password: 'secreto123' });
    token = login.body.token;
  });

  it('rejects a create without idrubro', async () => {
    const res = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Sin rubro' });
    expect(res.status).toBe(400);
  });

  it('creates the first quodom of a rubro', async () => {
    const res = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Bebidas', idrubro: 7 });
    expect(res.status).toBe(200);
    const q = await db.Quodom.findByPk(res.body.idquodom);
    expect(q.idrubro).toBe(7);
  });

  it('rejects a second open quodom of the same rubro with 409', async () => {
    const res = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Bebidas otra vez', idrubro: 7 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('rubro_duplicado');
    expect(res.body.message).toContain('Bebidas');
    expect(res.body.idquodom).toBeDefined();
  });

  it('allows a second quodom of the same rubro once the first is ENVIADO', async () => {
    const abierto = await db.Quodom.findOne({ where: { createdBy: (await db.User.findOne({ where: { username: 'rubro' } })).id, idrubro: 7, estado: 'CREADO' } });
    abierto.estado = 'ENVIADO';
    await abierto.save();

    const res = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Bebidas nueva tanda', idrubro: 7 });
    expect(res.status).toBe(200);
  });

  it('allows a different rubro while one is open', async () => {
    const res = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Obra', idrubro: 4 });
    expect(res.status).toBe(200);
  });
});

describe('add line enforces the quodom rubro', () => {
  let token;
  let idquodomBebidas;

  beforeAll(async () => {
    const login = await request(app).post('/users/signin').send({ username: 'rubro', password: 'secreto123' });
    token = login.body.token;
    const userId = (await db.User.findOne({ where: { username: 'rubro' } })).id;
    await db.Quodom.destroy({ where: { createdBy: userId } });
    const res = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Bebidas', idrubro: 7 });
    idquodomBebidas = res.body.idquodom;
  });

  it('accepts a product of the same rubro', async () => {
    const res = await request(app).post('/quodom_lines/add')
      .set('Authorization', 'Bearer ' + token)
      .send({ idquodom: idquodomBebidas, idproducto: 700, cantidad: 1, nombreProducto: 'Gaseosa 2L' });
    expect(res.status).toBe(200);
  });

  it('rejects a product of another rubro with 409 and creates no line', async () => {
    const antes = await db.Quodom_Lines.count({ where: { idquodom: idquodomBebidas } });

    const res = await request(app).post('/quodom_lines/add')
      .set('Authorization', 'Bearer ' + token)
      .send({ idquodom: idquodomBebidas, idproducto: 400, cantidad: 1, nombreProducto: 'Cemento 50kg' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('rubro_mismatch');
    expect(res.body.message).toContain('Construcción');
    expect(res.body.message).toContain('Bebidas');
    expect(await db.Quodom_Lines.count({ where: { idquodom: idquodomBebidas } })).toBe(antes);
  });
});

describe('GET /quodom/activo/:idrubro', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const login = await request(app).post('/users/signin').send({ username: 'rubro', password: 'secreto123' });
    token = login.body.token;
    userId = (await db.User.findOne({ where: { username: 'rubro' } })).id;
    await db.Quodom.destroy({ where: { createdBy: userId } });
  });

  it('returns null and creates nothing when there is no open quodom of that rubro', async () => {
    const antes = await db.Quodom.count();

    const res = await request(app).get('/quodom/activo/7')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
    expect(await db.Quodom.count()).toBe(antes);
  });

  it('returns the open quodom of that rubro with its nombrerubro', async () => {
    const creado = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Bebidas', idrubro: 7 });

    const res = await request(app).get('/quodom/activo/7')
      .set('Authorization', 'Bearer ' + token);

    expect(res.body.data.id).toBe(creado.body.idquodom);
    expect(res.body.data.nombrerubro).toBe('Bebidas');
  });

  it('ignores quodoms of other rubros and other users', async () => {
    const res = await request(app).get('/quodom/activo/4')
      .set('Authorization', 'Bearer ' + token);
    expect(res.body.data).toBeNull();
  });

  it.each(['abc', '7abc', '0'])('rejects an invalid idrubro (%s) with 400 and creates nothing', async (idrubro) => {
    const antes = await db.Quodom.count();

    const res = await request(app).get('/quodom/activo/' + idrubro)
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('idrubro_invalido');
    expect(await db.Quodom.count()).toBe(antes);
  });
});
