const db = require('../src/helpers/db');

beforeAll(async () => {
  await db.ready;
  await db.Category.bulkCreate([
    { id: 7, nombrecategoria: 'Bebidas', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 4, nombrecategoria: 'Construcción', idcategoriapadre: 0, activa: true, orden: 2 }
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
