jest.mock('../src/helpers/gemini');
const { callGemini } = require('../src/helpers/gemini');
const db = require('../src/helpers/db');
const ia = require('../src/controllers/ia.controller');

const USER_ID = 'user-ia-controller-1';

beforeAll(async () => {
  await db.ready;
  await db.Category.bulkCreate([
    { id: 10, nombrecategoria: 'Pinturería', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 11, nombrecategoria: 'Pinturas', idcategoriapadre: 10, activa: true, orden: 1 },
    { id: 12, nombrecategoria: 'Rodillos', idcategoriapadre: 10, activa: true, orden: 2 }
  ], { ignoreDuplicates: true });
  await db.Products.bulkCreate([
    { id: 200, nombreproducto: 'Látex interior 4L', categoria: 11, categoriaPadre: 10, atributo1: 'Color', atributo2: null },
    { id: 201, nombreproducto: 'Rodillo lana 22cm', categoria: 12, categoriaPadre: 10, atributo1: null, atributo2: null }
  ], { ignoreDuplicates: true });
});

beforeEach(() => { callGemini.mockReset(); });

describe('ia.chat', () => {
  it('returns { type: "question" } when Gemini responds with a question', async () => {
    callGemini
      .mockResolvedValueOnce({ idsSubcategoria: [11] })
      .mockResolvedValueOnce({ type: 'question', text: '¿de qué color?' });

    const out = await ia.chat(USER_ID, [{ role: 'user', text: 'quiero pintar' }]);

    expect(out).toEqual({ type: 'question', text: '¿de qué color?' });
    expect(callGemini).toHaveBeenCalledTimes(2);
  });

  it('returns { type: "proposal" } and filters items with unknown idproducto', async () => {
    callGemini
      .mockResolvedValueOnce({ idsSubcategoria: [11, 12] })
      .mockResolvedValueOnce({
        type: 'proposal',
        text: 'Te propongo:',
        items: [
          { idproducto: 200, cantidad: 4, motivo: 'cubre 12m²' },
          { idproducto: 999, cantidad: 1, motivo: 'ghost' },
          { idproducto: 201, cantidad: 1, motivo: 'aplicación' }
        ]
      });

    const out = await ia.chat(USER_ID, [{ role: 'user', text: 'quiero pintar 3 paredes' }]);

    expect(out.type).toBe('proposal');
    expect(out.items).toHaveLength(2);
    const ids = out.items.map(i => i.idproducto).sort();
    expect(ids).toEqual([200, 201]);
    // Enriched with nombreProducto from the DB (frontend needs it):
    expect(out.items[0].nombreProducto).toBeDefined();
  });

  it('returns question when 0 subcategorías detected (skips main call)', async () => {
    callGemini.mockResolvedValueOnce({ idsSubcategoria: [] });

    const out = await ia.chat(USER_ID, [{ role: 'user', text: 'blablabla' }]);

    expect(out.type).toBe('question');
    expect(out.text).toMatch(/rubro/i);
    expect(callGemini).toHaveBeenCalledTimes(1);
  });

  it('returns question when proposal has 0 valid items after filtering', async () => {
    callGemini
      .mockResolvedValueOnce({ idsSubcategoria: [11] })
      .mockResolvedValueOnce({
        type: 'proposal',
        text: 'Te propongo:',
        items: [{ idproducto: 8888, cantidad: 1, motivo: 'x' }]
      });

    const out = await ia.chat(USER_ID, [{ role: 'user', text: 'test' }]);

    expect(out.type).toBe('question');
    expect(out.text).toMatch(/no encontré/i);
  });

  it('propagates errors from gemini as-is (caller decides HTTP status)', async () => {
    callGemini.mockRejectedValueOnce(new Error('gemini: HTTP 500 boom'));

    await expect(ia.chat(USER_ID, [{ role: 'user', text: 'test' }])).rejects.toThrow(/gemini/);
  });
});
