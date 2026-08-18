jest.mock('../src/helpers/gemini');
const request = require('supertest');
const { callGemini } = require('../src/helpers/gemini');
const app = require('../src/server');
const db = require('../src/helpers/db');
const rateLimit = require('../src/middleware/rateLimit');

let token;

beforeAll(async () => {
  await db.ready;
  await db.Category.bulkCreate([
    { id: 20, nombrecategoria: 'Rubro X', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 21, nombrecategoria: 'Sub X', idcategoriapadre: 20, activa: true, orden: 1 }
  ], { ignoreDuplicates: true });
  await db.Products.bulkCreate([
    { id: 500, nombreproducto: 'P500', categoria: 21, categoriaPadre: 20 }
  ], { ignoreDuplicates: true });
  await db.series.findOrCreate({ where: { codigo: 'QUODOM' }, defaults: { codigo: 'QUODOM', utilizado: 0, sigla: 'QD-' } });

  const user = { username: 'ia', email: 'ia@test.com', nombre: 'IA', password: 'secreto123', codArea: '11', telefono: '55554444' };
  await request(app).post('/users/signup').send(user);
  const login = await request(app).post('/users/signin').send({ username: 'ia', password: 'secreto123' });
  token = login.body.token;
});

beforeEach(() => {
  callGemini.mockReset();
  rateLimit._reset();
});

describe('POST /api/ia/chat', () => {
  it('rejects without a JWT with 401', async () => {
    const res = await request(app).post('/api/ia/chat').send({ messages: [{ role: 'user', text: 'hi' }] });
    expect(res.status).toBe(401);
  });

  it('returns 200 with type=question', async () => {
    callGemini
      .mockResolvedValueOnce({ idsSubcategoria: [21] })
      .mockResolvedValueOnce({ type: 'question', text: '¿cuántos?' });

    const res = await request(app).post('/api/ia/chat')
      .set('Authorization', 'Bearer ' + token)
      .send({ messages: [{ role: 'user', text: 'hola' }] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ type: 'question', text: '¿cuántos?' });
  });

  it('returns 200 with type=proposal (filtered items)', async () => {
    callGemini
      .mockResolvedValueOnce({ idsSubcategoria: [21] })
      .mockResolvedValueOnce({
        type: 'proposal', text: 'Te propongo:',
        items: [{ idproducto: 500, cantidad: 2, motivo: 'ok' }, { idproducto: 9999, cantidad: 1, motivo: 'ghost' }]
      });

    const res = await request(app).post('/api/ia/chat')
      .set('Authorization', 'Bearer ' + token)
      .send({ messages: [{ role: 'user', text: 'quiero 2' }] });

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('proposal');
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ idproducto: 500, cantidad: 2, nombreProducto: 'P500' });
  });

  it('rejects last user message > IA_MAX_USER_MESSAGE_LENGTH with 400', async () => {
    const long = 'x'.repeat(1000);
    const res = await request(app).post('/api/ia/chat')
      .set('Authorization', 'Bearer ' + token)
      .send({ messages: [{ role: 'user', text: long }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('too_long');
  });

  it('rejects when messages.length > IA_MAX_TURNS*2', async () => {
    const many = [];
    for (let i = 0; i < 50; i++) many.push({ role: i % 2 === 0 ? 'user' : 'assistant', text: 'x' });
    const res = await request(app).post('/api/ia/chat')
      .set('Authorization', 'Bearer ' + token)
      .send({ messages: many });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('too_many_turns');
  });

  it('rejects when last message is not from user', async () => {
    const res = await request(app).post('/api/ia/chat')
      .set('Authorization', 'Bearer ' + token)
      .send({ messages: [{ role: 'user', text: 'a' }, { role: 'assistant', text: 'b' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('no_last_user_message');
  });

  it('returns 429 rate_limit after 11 requests in a minute', async () => {
    process.env.IA_RATE_LIMIT_PER_MINUTE = '10';
    for (let i = 0; i < 10; i++) {
      callGemini.mockResolvedValueOnce({ idsSubcategoria: [21] }).mockResolvedValueOnce({ type: 'question', text: 'q' });
      const r = await request(app).post('/api/ia/chat')
        .set('Authorization', 'Bearer ' + token)
        .send({ messages: [{ role: 'user', text: 'x' }] });
      expect(r.status).toBe(200);
    }
    const r11 = await request(app).post('/api/ia/chat')
      .set('Authorization', 'Bearer ' + token)
      .send({ messages: [{ role: 'user', text: 'x' }] });
    expect(r11.status).toBe(429);
    expect(r11.body.error).toBe('rate_limit');
  });

  it('returns 429 limit_exceeded when daily counter is at the max', async () => {
    process.env.IA_MAX_DAILY_MESSAGES = '2';
    process.env.IA_RATE_LIMIT_PER_MINUTE = '999';
    rateLimit._reset();
    const userId = (await db.User.findOne({ where: { username: 'ia' } })).id;
    // Use the same date formula as the controller (Argentina TZ).
    const today = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await db.ia_usage.destroy({ where: { iduser: userId, fecha: today } });
    await db.ia_usage.create({ iduser: userId, fecha: today, contador: 2 });

    const res = await request(app).post('/api/ia/chat')
      .set('Authorization', 'Bearer ' + token)
      .send({ messages: [{ role: 'user', text: 'x' }] });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('limit_exceeded');
  });

  it('returns 503 ia_busy when gemini is overloaded and does NOT increment counter', async () => {
    process.env.IA_MAX_DAILY_MESSAGES = '999';
    process.env.IA_RATE_LIMIT_PER_MINUTE = '999';
    rateLimit._reset();
    callGemini.mockRejectedValueOnce(new Error('gemini: HTTP 503 high demand'));

    const userId = (await db.User.findOne({ where: { username: 'ia' } })).id;
    const today = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await db.ia_usage.destroy({ where: { iduser: userId, fecha: today } });

    const res = await request(app).post('/api/ia/chat')
      .set('Authorization', 'Bearer ' + token)
      .send({ messages: [{ role: 'user', text: 'x' }] });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('ia_busy');
    expect(res.headers['retry-after']).toBe('30');

    const row = await db.ia_usage.findOne({ where: { iduser: userId, fecha: today } });
    expect(row).toBeNull();
  });

  it('returns 429 ia_quota when gemini reports the quota is exhausted', async () => {
    process.env.IA_MAX_DAILY_MESSAGES = '999';
    process.env.IA_RATE_LIMIT_PER_MINUTE = '999';
    rateLimit._reset();
    callGemini.mockRejectedValueOnce(new Error('gemini: HTTP 429 quota'));

    const res = await request(app).post('/api/ia/chat')
      .set('Authorization', 'Bearer ' + token)
      .send({ messages: [{ role: 'user', text: 'x' }] });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('ia_quota');
  });

  it('returns 500 ia_unavailable on a non-transient gemini failure and does NOT increment counter', async () => {
    process.env.IA_MAX_DAILY_MESSAGES = '999';
    process.env.IA_RATE_LIMIT_PER_MINUTE = '999';
    rateLimit._reset();
    callGemini.mockRejectedValueOnce(new Error('gemini: could not parse JSON response: nope'));

    const userId = (await db.User.findOne({ where: { username: 'ia' } })).id;
    const today = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await db.ia_usage.destroy({ where: { iduser: userId, fecha: today } });

    const res = await request(app).post('/api/ia/chat')
      .set('Authorization', 'Bearer ' + token)
      .send({ messages: [{ role: 'user', text: 'x' }] });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('ia_unavailable');

    const row = await db.ia_usage.findOne({ where: { iduser: userId, fecha: today } });
    expect(row).toBeNull();
  });

  it('increments the daily counter on a successful 200', async () => {
    process.env.IA_MAX_DAILY_MESSAGES = '999';
    process.env.IA_RATE_LIMIT_PER_MINUTE = '999';
    rateLimit._reset();
    callGemini
      .mockResolvedValueOnce({ idsSubcategoria: [21] })
      .mockResolvedValueOnce({ type: 'question', text: '¿?' });

    const userId = (await db.User.findOne({ where: { username: 'ia' } })).id;
    const today = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await db.ia_usage.destroy({ where: { iduser: userId, fecha: today } });

    const res = await request(app).post('/api/ia/chat')
      .set('Authorization', 'Bearer ' + token)
      .send({ messages: [{ role: 'user', text: 'x' }] });
    expect(res.status).toBe(200);

    const row = await db.ia_usage.findOne({ where: { iduser: userId, fecha: today } });
    expect(row.contador).toBe(1);
  });
});
