const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');

let token;
let userId;
let idnotif;

beforeAll(async () => {
  await db.ready;
  const signup = await request(app).post('/users/signup').send({
    username: 'ana', email: 'ana@test.com', nombre: 'Ana', password: 'secreto123',
    codArea: '11', telefono: '55554444'
  });
  userId = signup.body.id;
  const login = await request(app).post('/users/signin').send({ username: 'ana', password: 'secreto123' });
  token = login.body.token;

  const n = await db.oper_notificaciones.create({
    userId: userId,
    titulo: 'Quodom enviado',
    texto: 'Tu Quodom QD-1 fue enviado por WhatsApp.',
    tiponotificacion: 'QUODOMENVIADO',
    idquodom: 'q1',
    enviada: 0,
    leida: 0
  });
  idnotif = n.id;
});

describe('notificaciones', () => {
  it('GET /oper_notificaciones returns user notifications', async () => {
    const res = await request(app).get('/oper_notificaciones')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].tiponotificacion).toBe('QUODOMENVIADO');
  });

  it('GET /oper_notificaciones/count returns unread count', async () => {
    const res = await request(app).get('/oper_notificaciones/count')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body).toBe(1);
  });

  it('PUT /oper_notificaciones/:id marks it as read', async () => {
    const res = await request(app).put('/oper_notificaciones/' + idnotif)
      .set('Authorization', 'Bearer ' + token)
      .send({ leida: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ res: true });

    const count = await request(app).get('/oper_notificaciones/count')
      .set('Authorization', 'Bearer ' + token);
    expect(count.body).toBe(0);
  });
});
