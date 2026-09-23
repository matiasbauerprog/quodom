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
    atributo1: 'Color', atributo2: null
  });

  await request(app).post('/users/signup').send({
    username: 'ana', email: 'ana@test.com', nombre: 'Ana', apellido: 'Perez',
    password: 'secreto123', codArea: '11', telefono: '55554444'
  });
  const login = await request(app).post('/users/signin').send({ username: 'ana', password: 'secreto123' });
  token = sessionToken(login);

  const q = await request(app).post('/quodom/create')
    .set('Authorization', 'Bearer ' + token)
    .send({ descripcion: 'Pintura Dpto', idrubro: 5 });
  idquodom = q.body.idquodom;
});

describe('whatsapp export', () => {
  it('rejects a quodom without lines', async () => {
    const res = await request(app).get('/quodom/whatsapp/' + idquodom)
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El Quodom no tiene productos.');
  });

  it('returns a wa.me link with the detail and marks the quodom ENVIADO', async () => {
    await request(app).post('/quodom_lines/add')
      .set('Authorization', 'Bearer ' + token)
      .send({ idquodom: idquodom, idproducto: 100, cantidad: 2, nombreProducto: 'Latex interior 20L', atributo1: 'Blanco' });

    const res = await request(app).get('/quodom/whatsapp/' + idquodom)
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.res).toBe(true);
    expect(res.body.link).toMatch(/^https:\/\/wa\.me\/\?text=/);

    const msg = decodeURIComponent(res.body.link.replace('https://wa.me/?text=', ''));
    expect(msg).toContain('QD-1');
    expect(msg).toContain('Pintura Dpto');
    expect(msg).toContain('2 x Latex interior 20L');
    expect(msg).toContain('Color: Blanco');
    expect(msg).toContain('Ana Perez');
    expect(msg).toContain('1155554444');

    const q = await db.Quodom.findByPk(idquodom);
    expect(q.estado).toBe('ENVIADO');
    expect(q.fechaenvio).not.toBeNull();

    const notifs = await db.oper_notificaciones.count({ where: { idquodom: idquodom } });
    expect(notifs).toBe(1);
  });

  it('allows re-generating the link without duplicating the notification', async () => {
    const res = await request(app).get('/quodom/whatsapp/' + idquodom)
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    const notifs = await db.oper_notificaciones.count({ where: { idquodom: idquodom } });
    expect(notifs).toBe(1);
  });

  it('rejects a quodom from another user', async () => {
    await request(app).post('/users/signup').send({
      username: 'beto', email: 'beto@test.com', nombre: 'Beto', password: 'secreto123',
      codArea: '11', telefono: '44443333'
    });
    const login2 = await request(app).post('/users/signin').send({ username: 'beto', password: 'secreto123' });

    const res = await request(app).get('/quodom/whatsapp/' + idquodom)
      .set('Authorization', 'Bearer ' + sessionToken(login2));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El Id Quodom no pertenece a el usuario.');
  });
});
