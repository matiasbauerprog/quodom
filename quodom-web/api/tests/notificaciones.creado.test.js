const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');
const { sessionToken } = require('./helpers/session');

let token;
let userId;

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
  const signup = await request(app).post('/users/signup').send({
    email: 'ana@test.com', nombre: 'Ana', password: 'secreto123', telefono: '55554444'
  });
  userId = signup.body.id;
  const login = await request(app).post('/users/signin').send({ username: 'ana@test.com', password: 'secreto123' });
  token = sessionToken(login);
});

function creadosDe(idquodom) {
  return db.oper_notificaciones.findAll({ where: { idquodom, tiponotificacion: 'QUODOMCREADO' } });
}

// El usuario pidió enterarse por la campana también cuando nace un Quodom,
// no sólo cuando se envía.
describe('notificación de Quodom creado', () => {
  let original;

  it('crear un Quodom deja una notificación sin leer', async () => {
    const res = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Pintura casa', idrubro: 5 });
    original = res.body.idquodom;

    const notifs = await creadosDe(original);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].userId).toBe(userId);
    expect(notifs[0].leida).toBeFalsy();
    expect(notifs[0].texto).toBe('Creaste el Quodom QD-1.');

    const lista = await request(app).get('/oper_notificaciones').set('Authorization', 'Bearer ' + token);
    expect(lista.body.map(n => n.tiponotificacion)).toContain('QUODOMCREADO');
  });

  it('repetir dice de cuál salió', async () => {
    await request(app).post('/quodom_lines/add')
      .set('Authorization', 'Bearer ' + token)
      .send({ idquodom: original, idproducto: 100, cantidad: 1, nombreProducto: 'Latex interior 20L' });
    const res = await request(app).post('/quodom/repetir/' + original)
      .set('Authorization', 'Bearer ' + token);

    const notifs = await creadosDe(res.body.idquodom);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].texto).toBe('Repetiste QD-1: el nuevo es QD-2.');
  });

  it('borrar un Quodom en armado se lleva su notificación', async () => {
    await request(app).delete('/quodom/' + original).set('Authorization', 'Bearer ' + token);
    expect(await creadosDe(original)).toHaveLength(0);
  });
});
