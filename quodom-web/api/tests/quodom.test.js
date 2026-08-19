const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');

let token;
let otherToken;
let idquodom;
let idline;
let nuevoId;

beforeAll(async () => {
  await db.ready;
  await db.series.create({ codigo: 'QUODOM', utilizado: 0, sigla: 'QD-' });
  await db.Category.bulkCreate([
    { id: 5, nombrecategoria: 'Pintura', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 35, nombrecategoria: 'Latex', idcategoriapadre: 5, activa: true, orden: 1 }
  ]);
  await db.Products.create({
    id: 100, nombreproducto: 'Latex interior 20L', categoria: 35, categoriaPadre: 5,
    atributo1: 'Color', atributo2: null
  });

  const user = {
    username: 'ana', email: 'ana@test.com', nombre: 'Ana', password: 'secreto123',
    codArea: '11', telefono: '55554444'
  };
  await request(app).post('/users/signup').send(user);
  const login = await request(app).post('/users/signin').send({ username: 'ana', password: 'secreto123' });
  token = login.body.token;

  await request(app).post('/users/signup').send({ ...user, username: 'beto', email: 'beto@test.com' });
  const login2 = await request(app).post('/users/signin').send({ username: 'beto', password: 'secreto123' });
  otherToken = login2.body.token;
});

describe('quodom', () => {
  it('POST /quodom/create creates a quodom with serie number', async () => {
    const res = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Pintura Dpto', idrubro: 5 });
    expect(res.status).toBe(200);
    expect(res.body.res).toBe(true);
    idquodom = res.body.idquodom;
    const q = await db.Quodom.findByPk(idquodom);
    expect(q.estado).toBe('CREADO');
    expect(q.nro).toBe('QD-1');
  });

  it('POST /quodom_lines/add adds a line enriched from the product', async () => {
    const res = await request(app).post('/quodom_lines/add')
      .set('Authorization', 'Bearer ' + token)
      .send({ idquodom: idquodom, idproducto: 100, cantidad: 2, nombreProducto: 'Latex interior 20L' });
    expect(res.status).toBe(200);
    expect(res.body.res).toBe(true);
    idline = res.body.id;
    const ql = await db.Quodom_Lines.findByPk(idline);
    expect(ql.categoria).toBe(35);
    expect(ql.categoriaPadre).toBe(5);
    expect(ql.nombreCategoria).toBe('Latex');
    expect(ql.nombreAtributo1).toBe('Color');
  });

  it('POST /quodom_lines/add on another user quodom fails', async () => {
    const res = await request(app).post('/quodom_lines/add')
      .set('Authorization', 'Bearer ' + otherToken)
      .send({ idquodom: idquodom, idproducto: 100, cantidad: 1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El Id Quodom no pertenece a el usuario.');
  });

  it('GET /quodom_lines/:idquodom returns lines from the view', async () => {
    const res = await request(app).get('/quodom_lines/' + idquodom)
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].atributosFaltantes).toBe(1);
  });

  it('PUT /quodom_lines/:id updates atributo1', async () => {
    const res = await request(app).put('/quodom_lines/' + idline)
      .set('Authorization', 'Bearer ' + token)
      .send({ atributo1: 'Blanco' });
    expect(res.status).toBe(200);
    expect(res.body.res).toBe(true);
  });

  it('GET /quodom/misQuodom returns v_Quodoms data', async () => {
    const res = await request(app).get('/quodom/misQuodom/')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].cantproductos).toBe(1);
    expect(Number(res.body[0].porccompletado)).toBe(100);
  });

  it('GET /quodom/porccompletado/:id returns progress', async () => {
    const res = await request(app).get('/quodom/porccompletado/' + idquodom)
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.cantproductos).toBe(1);
  });

  it('GET /quodom/activo/:idrubro returns the open quodom of that rubro', async () => {
    const res = await request(app).get('/quodom/activo/5')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.res).toBe(true);
    expect(res.body.data.id).toBe(idquodom);
  });

  it('GET /quodom/:id of another user fails', async () => {
    const res = await request(app).get('/quodom/' + idquodom)
      .set('Authorization', 'Bearer ' + otherToken);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El Id Quodom no pertenece a el usuario.');
  });

  it('PUT /quodom/:id strips protected fields like estado, nro and idrubro', async () => {
    // Spec §3.1: idrubro is fixed at creation and PUT ignores it explicitly.
    // The guarantee comes from validate-request.js's stripUnknown: true
    // (updateSchema in quodom.route.js has no idrubro key at all), not
    // anything this feature owns, but it is the invariant this feature
    // depends on so it gets its own assertion.
    const res = await request(app).put('/quodom/' + idquodom)
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Pintura Dpto 2', estado: 'ENVIADO', nro: 'HACK', idrubro: 4 });
    expect(res.status).toBe(200);
    const q = await db.Quodom.findByPk(idquodom);
    expect(q.descripcion).toBe('Pintura Dpto 2');
    expect(q.estado).toBe('CREADO');
    expect(q.nro).toBe('QD-1');
    expect(q.idrubro).toBe(5);
  });

  it('PUT /quodom_lines/:id strips mass-assignment fields', async () => {
    const res = await request(app).put('/quodom_lines/' + idline)
      .set('Authorization', 'Bearer ' + token)
      .send({ cantidad: 3, idquodom: 'other', createdBy: 'hacked', nombreCategoria: 'HACK' });
    expect(res.status).toBe(200);
    const lines = await request(app).get('/quodom_lines/' + idquodom)
      .set('Authorization', 'Bearer ' + token);
    expect(lines.body[0].idquodom).toBe(idquodom);
    expect(lines.body[0].cantidad).toBe(3);
    expect(lines.body[0].nombreCategoria).toBe('Latex');
  });

  it('GET /quodom_lines/lines/:id with other user token returns 400', async () => {
    const res = await request(app).get('/quodom_lines/lines/' + idline)
      .set('Authorization', 'Bearer ' + otherToken);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El Id Quodom no pertenece a el usuario.');
  });

  it('GET /productos/categoriaQ/:idquodom/:idcategoria with other user token returns 400', async () => {
    const res = await request(app).get('/productos/categoriaQ/' + idquodom + '/35')
      .set('Authorization', 'Bearer ' + otherToken);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El Id Quodom no pertenece a el usuario.');
  });

  it('POST /quodom/repetir/:id copies descripcion, iddireccion and all lines into a new quodom', async () => {
    // repetir on an already-open (CREADO) quodom of the same rubro would collide with
    // the one-open-quodom-per-rubro rule, so mark the source ENVIADO first, matching
    // how repetir is actually used (repeat something you already sent).
    const source = await db.Quodom.findByPk(idquodom);
    source.estado = 'ENVIADO';
    await source.save();

    const res = await request(app).post('/quodom/repetir/' + idquodom)
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.res).toBe(true);
    nuevoId = res.body.idquodom;
    expect(nuevoId).not.toBe(idquodom);

    const nuevo = await db.Quodom.findByPk(nuevoId);
    expect(nuevo.descripcion).toBe(source.descripcion);
    expect(nuevo.iddireccion).toBe(source.iddireccion);
    expect(nuevo.idrubro).toBe(source.idrubro);
    expect(nuevo.estado).toBe('CREADO');
    expect(nuevo.nro).not.toBe(source.nro);

    const nuevasLines = await db.Quodom_Lines.findAll({ where: { idquodom: nuevoId } });
    const originalLines = await db.Quodom_Lines.findAll({ where: { idquodom: idquodom } });
    expect(nuevasLines).toHaveLength(originalLines.length);
    expect(nuevasLines[0].idproducto).toBe(originalLines[0].idproducto);
    expect(nuevasLines[0].cantidad).toBe(originalLines[0].cantidad);
    expect(nuevasLines[0].nombreProducto).toBe(originalLines[0].nombreProducto);
    expect(nuevasLines[0].atributo1).toBe(originalLines[0].atributo1);
  });

  it('POST /quodom/repetir/:id of another user fails', async () => {
    const res = await request(app).post('/quodom/repetir/' + idquodom)
      .set('Authorization', 'Bearer ' + otherToken);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El Id Quodom no pertenece a el usuario.');
  });

  it('DELETE /quodom/:id destroys a CREADO quodom and its lines', async () => {
    const res = await request(app).delete('/quodom/' + nuevoId)
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(await db.Quodom.findByPk(nuevoId)).toBeNull();
    expect(await db.Quodom_Lines.count({ where: { idquodom: nuevoId } })).toBe(0);
  });
});
