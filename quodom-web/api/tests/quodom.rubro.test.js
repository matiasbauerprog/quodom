const db = require('../src/helpers/db');
const { sessionToken } = require('./helpers/session');

beforeAll(async () => {
  await db.ready;
  await db.Category.bulkCreate([
    { id: 7, nombrecategoria: 'Bebidas', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 1, nombrecategoria: 'Limpieza', idcategoriapadre: 0, activa: true, orden: 2 }
  ]);

  // Las subcategorías tienen que existir: add() llama a getCat(producto.categoria)
  // y lanza 'Err. Id de categoria no encontrado.' (400) si falta, lo que haría
  // fallar el caso feliz antes de llegar a la validación de rubro.
  await db.Category.bulkCreate([
    { id: 70, nombrecategoria: 'Gaseosas', idcategoriapadre: 7, activa: true, orden: 1 },
    { id: 40, nombrecategoria: 'Lavandinas', idcategoriapadre: 1, activa: true, orden: 1 }
  ]);
  await db.Products.bulkCreate([
    { id: 700, nombreproducto: 'Gaseosa 2L', categoria: 70, categoriaPadre: 7, atributo1: null, atributo2: null },
    { id: 400, nombreproducto: 'Lavandina 1L', categoria: 40, categoriaPadre: 1, atributo1: null, atributo2: null }
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
      descripcion: 'Oficina', createdBy: 'u-2', estado: 'CREADO', idrubro: 1
    });
    const row = await db.v_Quodoms.findOne({ where: { id: q.id } });
    expect(row.idrubro).toBe(1);
    expect(row.nombrerubro).toBe('Limpieza');
  });
});

const request = require('supertest');
const app = require('../src/server');

describe('create allows several open quodoms per rubro', () => {
  let token;

  beforeAll(async () => {
    await db.series.findOrCreate({ where: { codigo: 'QUODOM' }, defaults: { codigo: 'QUODOM', utilizado: 0, sigla: 'QD-' } });
    await request(app).post('/users/signup').send({
      username: 'rubro', email: 'rubro@test.com', nombre: 'Rubro', password: 'secreto123',
      codArea: '11', telefono: '55554444'
    });
    const login = await request(app).post('/users/signin').send({ username: 'rubro@test.com', password: 'secreto123' });
    token = sessionToken(login);
  });

  it('rejects a create without idrubro', async () => {
    const res = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Sin rubro' });
    expect(res.status).toBe(400);
  });

  it('rejects a create whose idrubro is a subcategory, not a rubro', async () => {
    const res = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Gaseosas', idrubro: 70 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('idrubro_invalido');
  });

  it('rejects a create whose idrubro does not exist at all', async () => {
    const res = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Nada', idrubro: 9999 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('idrubro_invalido');
  });

  it('creates the first quodom of a rubro', async () => {
    const res = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Bebidas', idrubro: 7 });
    expect(res.status).toBe(200);
    const q = await db.Quodom.findByPk(res.body.idquodom);
    expect(q.idrubro).toBe(7);
  });

  it('creates a second open quodom of the same rubro', async () => {
    const primero = await db.Quodom.findOne({ where: { descripcion: 'Bebidas', idrubro: 7 } });
    const res = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Bebidas otra vez', idrubro: 7 });
    expect(res.status).toBe(200);
    expect(res.body.idquodom).not.toBe(primero.id);
    const q = await db.Quodom.findByPk(res.body.idquodom);
    expect(q.estado).toBe('CREADO');
    expect(q.idrubro).toBe(7);
  });

  it('allows a second quodom of the same rubro once the first is ENVIADO', async () => {
    const abierto = await db.Quodom.findOne({ where: { createdBy: (await db.User.findOne({ where: { email: 'rubro@test.com' } })).id, idrubro: 7, estado: 'CREADO' } });
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
      .send({ descripcion: 'Oficina', idrubro: 1 });
    expect(res.status).toBe(200);
  });
});

describe('add line enforces the quodom rubro', () => {
  let token;
  let idquodomBebidas;

  beforeAll(async () => {
    const login = await request(app).post('/users/signin').send({ username: 'rubro@test.com', password: 'secreto123' });
    token = sessionToken(login);
    const userId = (await db.User.findOne({ where: { email: 'rubro@test.com' } })).id;
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
      .send({ idquodom: idquodomBebidas, idproducto: 400, cantidad: 1, nombreProducto: 'Lavandina 1L' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('rubro_mismatch');
    expect(res.body.message).toContain('Limpieza');
    expect(res.body.message).toContain('Bebidas');
    expect(await db.Quodom_Lines.count({ where: { idquodom: idquodomBebidas } })).toBe(antes);
  });
});

describe('GET /quodom/activos/:idrubro', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const login = await request(app).post('/users/signin').send({ username: 'rubro@test.com', password: 'secreto123' });
    token = sessionToken(login);
    userId = (await db.User.findOne({ where: { email: 'rubro@test.com' } })).id;
    await db.Quodom.destroy({ where: { createdBy: userId } });
  });

  it('returns an empty list and creates nothing when there is no open quodom of that rubro', async () => {
    const antes = await db.Quodom.count();

    const res = await request(app).get('/quodom/activos/7')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(await db.Quodom.count()).toBe(antes);
  });

  it('returns the open quodoms of that rubro with their nombrerubro', async () => {
    const creado = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Bebidas', idrubro: 7 });

    const res = await request(app).get('/quodom/activos/7')
      .set('Authorization', 'Bearer ' + token);

    expect(res.body.data[0].id).toBe(creado.body.idquodom);
    expect(res.body.data[0].nombrerubro).toBe('Bebidas');
  });

  it('devuelve todos los Quodoms en armado de un rubro, del más nuevo al más viejo', async () => {
    await db.Quodom.destroy({ where: { createdBy: userId } });
    await request(app).post('/quodom/create').set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Viejo', idrubro: 7 });
    await request(app).post('/quodom/create').set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Nuevo', idrubro: 7 });

    const res = await request(app).get('/quodom/activos/7')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].descripcion).toBe('Nuevo');
  });

  it('no incluye los enviados ni los de otros rubros', async () => {
    const q = await request(app).post('/quodom/create').set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Se envía', idrubro: 7 });
    await db.Quodom.update({ estado: 'ENVIADO' }, { where: { id: q.body.idquodom } });
    const otro = await request(app).post('/quodom/create').set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Otro rubro', idrubro: 1 });

    const res = await request(app).get('/quodom/activos/7')
      .set('Authorization', 'Bearer ' + token);

    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every(x => x.estado === 'CREADO')).toBe(true);
    expect(res.body.data.every(x => x.idrubro === 7)).toBe(true);
    // El siguiente test espera que el rubro 1 esté vacío.
    await db.Quodom.destroy({ where: { id: otro.body.idquodom } });
  });

  it('ignores quodoms of other rubros and other users', async () => {
    const res = await request(app).get('/quodom/activos/1')
      .set('Authorization', 'Bearer ' + token);
    expect(res.body.data).toEqual([]);
  });

  it.each(['abc', '7abc', '0'])('rejects an invalid idrubro (%s) with 400 and creates nothing', async (idrubro) => {
    const antes = await db.Quodom.count();

    const res = await request(app).get('/quodom/activos/' + idrubro)
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('idrubro_invalido');
    expect(await db.Quodom.count()).toBe(antes);
  });
});

describe('repetir of an already-open rubro', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const login = await request(app).post('/users/signin').send({ username: 'rubro@test.com', password: 'secreto123' });
    token = sessionToken(login);
    userId = (await db.User.findOne({ where: { email: 'rubro@test.com' } })).id;
    await db.Quodom.destroy({ where: { createdBy: userId } });
  });

  it('repetir no choca con un Quodom abierto del mismo rubro', async () => {
    // repetir delegates to create(); the source is still CREADO here, so the
    // rubro already has an open quodom and the copy must still be created.
    const creado = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Bebidas', idrubro: 7 });
    await request(app).post('/quodom_lines/add')
      .set('Authorization', 'Bearer ' + token)
      .send({ idquodom: creado.body.idquodom, idproducto: 700, cantidad: 1, nombreProducto: 'Gaseosa 2L' });

    const res = await request(app).post('/quodom/repetir/' + creado.body.idquodom)
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(res.body.idquodom).not.toBe(creado.body.idquodom);
    expect(await db.Quodom.count({ where: { createdBy: userId, idrubro: 7, estado: 'CREADO' } })).toBe(2);
  });
});

// Nothing at the database level caps open quodoms per rubro any more.
describe('the database no longer caps open quodoms per rubro', () => {
  const userId = 'idx-user';

  beforeAll(async () => {
    await db.Quodom.destroy({ where: { createdBy: userId } });
  });

  it('la base acepta varios Quodoms abiertos del mismo rubro', async () => {
    const uno = await db.Quodom.create({ descripcion: 'Casa', idrubro: 7, createdBy: userId, estado: 'CREADO', nro: 'QD-X1' });
    const dos = await db.Quodom.create({ descripcion: 'Depto', idrubro: 7, createdBy: userId, estado: 'CREADO', nro: 'QD-X2' });

    expect(uno.id).not.toBe(dos.id);
    const abiertos = await db.Quodom.count({ where: { createdBy: userId, idrubro: 7, estado: 'CREADO' } });
    expect(abiertos).toBe(2);
  });

  it('allows another open quodom of the same rubro once the first is ENVIADO', async () => {
    await db.Quodom.update({ estado: 'ENVIADO' }, { where: { createdBy: userId, idrubro: 7 } });

    await db.Quodom.create({
      descripcion: 'Bebidas nueva tanda', createdBy: userId, estado: 'CREADO', idrubro: 7, nro: 'IDX-3'
    });

    expect(await db.Quodom.count({ where: { createdBy: userId, idrubro: 7, estado: 'CREADO' } })).toBe(1);
  });

  it('does not block a different user holding the same rubro open', async () => {
    await db.Quodom.create({
      descripcion: 'Bebidas de otro', createdBy: 'idx-user-2', estado: 'CREADO', idrubro: 7, nro: 'IDX-4'
    });

    expect(await db.Quodom.count({ where: { createdBy: 'idx-user-2', idrubro: 7, estado: 'CREADO' } })).toBe(1);
  });

  it('does not block the same user holding a different rubro open', async () => {
    await db.Quodom.create({
      descripcion: 'Oficina', createdBy: userId, estado: 'CREADO', idrubro: 1, nro: 'IDX-5'
    });

    expect(await db.Quodom.count({ where: { createdBy: userId, estado: 'CREADO' } })).toBe(2);
  });
});
