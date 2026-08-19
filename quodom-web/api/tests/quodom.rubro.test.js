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

describe('repetir of an already-open rubro', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const login = await request(app).post('/users/signin').send({ username: 'rubro', password: 'secreto123' });
    token = login.body.token;
    userId = (await db.User.findOne({ where: { username: 'rubro' } })).id;
    await db.Quodom.destroy({ where: { createdBy: userId } });
  });

  it('rejects with 409 rubro_duplicado when the rubro already has an open quodom', async () => {
    // Spec §4.4: repetir inherits idrubro from the source and delegates to
    // create(), so the same 409 as a direct create applies. Simplest repro:
    // repetir a quodom while it is still CREADO, so the "already open" quodom
    // that create() finds is the source itself.
    const creado = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Bebidas', idrubro: 7 });
    await request(app).post('/quodom_lines/add')
      .set('Authorization', 'Bearer ' + token)
      .send({ idquodom: creado.body.idquodom, idproducto: 700, cantidad: 1, nombreProducto: 'Gaseosa 2L' });

    const res = await request(app).post('/quodom/repetir/' + creado.body.idquodom)
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('rubro_duplicado');
    expect(await db.Quodom.count({ where: { createdBy: userId, idrubro: 7 } })).toBe(1);
  });
});

// The application-level check in create() handles the normal case. This index is
// the net underneath it: two requests that interleave between the check and the
// insert would otherwise both create an open Quodom of the same rubro.
describe('unique index guards the one-open-quodom-per-rubro rule', () => {
  const userId = 'idx-user';

  beforeAll(async () => {
    await db.Quodom.destroy({ where: { createdBy: userId } });
  });

  it('rejects a second open quodom of the same rubro at the database level', async () => {
    await db.Quodom.create({
      descripcion: 'Bebidas', createdBy: userId, estado: 'CREADO', idrubro: 7, nro: 'IDX-1'
    });

    await expect(db.Quodom.create({
      descripcion: 'Bebidas otra vez', createdBy: userId, estado: 'CREADO', idrubro: 7, nro: 'IDX-2'
    })).rejects.toThrow(db.Sequelize.UniqueConstraintError);

    expect(await db.Quodom.count({ where: { createdBy: userId, idrubro: 7 } })).toBe(1);
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
      descripcion: 'Obra', createdBy: userId, estado: 'CREADO', idrubro: 4, nro: 'IDX-5'
    });

    expect(await db.Quodom.count({ where: { createdBy: userId, estado: 'CREADO' } })).toBe(2);
  });
});

describe('a lost race answers 409, not 500', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const login = await request(app).post('/users/signin').send({ username: 'rubro', password: 'secreto123' });
    token = login.body.token;
    userId = (await db.User.findOne({ where: { username: 'rubro' } })).id;
    await db.Quodom.destroy({ where: { createdBy: userId } });
  });

  it('maps the unique-constraint violation to rubro_duplicado', async () => {
    // Simulate the interleaving: the controller's pre-check runs against an empty
    // slot, then the competing request's Quodom lands before our insert does.
    const original = db.Quodom.findOne;
    db.Quodom.findOne = async function (...args) {
      const found = await original.apply(this, args);
      if (found === null) {
        await db.Quodom.create({
          descripcion: 'Ganó la otra pestaña', createdBy: userId, estado: 'CREADO', idrubro: 7, nro: 'RACE-1'
        });
      }
      return found;
    };

    try {
      const res = await request(app).post('/quodom/create')
        .set('Authorization', 'Bearer ' + token)
        .send({ descripcion: 'Perdió la carrera', idrubro: 7 });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('rubro_duplicado');
      expect(res.body.message).toContain('Bebidas');
      expect(res.body.idquodom).toBeDefined();
    } finally {
      db.Quodom.findOne = original;
    }

    expect(await db.Quodom.count({ where: { createdBy: userId, idrubro: 7, estado: 'CREADO' } })).toBe(1);
  });
});
