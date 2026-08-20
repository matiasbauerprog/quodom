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
    { id: 1, nombrecategoria: 'Limpieza', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 95, nombrecategoria: 'Lavandinas', idcategoriapadre: 1, activa: true, orden: 1 }
  ], { ignoreDuplicates: true });
  await db.Products.bulkCreate([
    { id: 7001, nombreproducto: 'Lavandina 5L', categoria: 95, categoriaPadre: 1 }
  ], { ignoreDuplicates: true });

  const user = { username: 'lista', email: 'lista@test.com', nombre: 'Lista', password: 'secreto123', codArea: '11', telefono: '55553333' };
  await request(app).post('/users/signup').send(user);
  const login = await request(app).post('/users/signin').send({ username: 'lista', password: 'secreto123' });
  token = login.body.token;
});

beforeEach(() => {
  callGemini.mockReset();
  rateLimit._reset();
});

function post(body) {
  return request(app).post('/api/ia/lista').set('Authorization', 'Bearer ' + token).send(body);
}

describe('POST /api/ia/lista', () => {
  it('rechaza sin JWT con 401', async () => {
    const res = await request(app).post('/api/ia/lista').send({ tipo: 'texto', texto: 'lavandina' });
    expect(res.status).toBe(401);
  });

  it('devuelve 200 con los grupos por rubro', async () => {
    callGemini.mockResolvedValueOnce({
      items: [{ textoOriginal: '3 lavandinas', idproducto: 7001, cantidad: 3 }],
      noEncontrados: []
    });

    const res = await post({ tipo: 'texto', texto: '3 lavandinas' });

    expect(res.status).toBe(200);
    expect(res.body.grupos).toHaveLength(1);
    expect(res.body.grupos[0].idrubro).toBe(1);
    expect(res.body.grupos[0].items[0].nombreProducto).toBe('Lavandina 5L');
    expect(res.body.lineasIgnoradas).toBe(0);
  });

  it('devuelve 400 lista_vacia con el texto vacío', async () => {
    const res = await post({ tipo: 'texto', texto: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('lista_vacia');
  });

  it('devuelve 400 formato_no_soportado con una extensión desconocida', async () => {
    const res = await post({
      tipo: 'archivo',
      archivo: { nombre: 'lista.docx', mime: '', datosBase64: 'QUJD' }
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('formato_no_soportado');
  });

  it('devuelve 400 archivo_ilegible con una planilla corrupta', async () => {
    // Un .xlsx es un ZIP: el fixture es un ZIP truncado. Texto plano no sirve,
    // `xlsx` lo lee como CSV en vez de fallar.
    const zipRoto = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0]).toString('base64');
    const res = await post({
      tipo: 'archivo',
      archivo: { nombre: 'lista.xlsx', mime: '', datosBase64: zipRoto }
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('archivo_ilegible');
  });

  it('mapea un 429 de Gemini a ia_quota', async () => {
    callGemini.mockRejectedValueOnce(new Error('gemini: HTTP 429 quota'));
    const res = await post({ tipo: 'texto', texto: '3 lavandinas' });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('ia_quota');
  });

  it('mapea un 503 de Gemini a ia_busy', async () => {
    callGemini.mockRejectedValueOnce(new Error('gemini: HTTP 503 unavailable'));
    const res = await post({ tipo: 'texto', texto: '3 lavandinas' });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('ia_busy');
  });

  it('corta con 429 al llegar al límite diario', async () => {
    // Los tests de arriba ya consumieron cupo: sin limpiar la tabla, con el
    // límite en 1 la primera llamada de este test daría 429 por orden de
    // ejecución y no por el código.
    await db.ia_usage.destroy({ where: {} });
    process.env.IA_MAX_DAILY_MESSAGES = '1';
    callGemini.mockResolvedValue({ items: [], noEncontrados: [] });

    const primera = await post({ tipo: 'texto', texto: 'lavandina' });
    expect(primera.status).toBe(200);

    const segunda = await post({ tipo: 'texto', texto: 'lavandina' });
    expect(segunda.status).toBe(429);
    expect(segunda.body.error).toBe('limit_exceeded');

    delete process.env.IA_MAX_DAILY_MESSAGES;
  });
});
