jest.mock('../src/helpers/gemini');
const { callGemini } = require('../src/helpers/gemini');
const db = require('../src/helpers/db');
const ia = require('../src/controllers/ia.controller');

const USER_ID = 'user-ia-controller-1';

beforeAll(async () => {
  await db.ready;
  await db.Category.bulkCreate([
    // Todos los rubros usados acá tienen que estar en RUBROS_ACTIVOS: el Modo IA
    // sólo ve los habilitados. Pintura (5) y Bebidas (7) para el filtro cruzado.
    { id: 5, nombrecategoria: 'Pintura', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 11, nombrecategoria: 'Pinturas', idcategoriapadre: 5, activa: true, orden: 1 },
    { id: 12, nombrecategoria: 'Rodillos', idcategoriapadre: 5, activa: true, orden: 2 },
    { id: 35, nombrecategoria: 'Látex', idcategoriapadre: 5, activa: true, orden: 1 },
    { id: 7, nombrecategoria: 'Bebidas', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 70, nombrecategoria: 'Gaseosas', idcategoriapadre: 7, activa: true, orden: 1 }
  ], { ignoreDuplicates: true });
  await db.Products.bulkCreate([
    { id: 200, nombreproducto: 'Látex interior 4L', categoria: 11, categoriaPadre: 5, atributo1: 'Color', atributo2: null },
    { id: 201, nombreproducto: 'Rodillo lana 22cm', categoria: 12, categoriaPadre: 5, atributo1: null, atributo2: null },
    { id: 300, nombreproducto: 'Latex premium 10L', categoria: 35, categoriaPadre: 5, atributo1: null, atributo2: null },
    { id: 301, nombreproducto: 'Gaseosa cola 2L', categoria: 70, categoriaPadre: 7, atributo1: null, atributo2: null },
    { id: 302, nombreproducto: 'Latex Interior Blanco Mate', categoria: 35, categoriaPadre: 5, atributo1: 'LITROS', atributo2: 'MARCA' }
  ], { ignoreDuplicates: true });
  await db.productos_atributos.bulkCreate([
    { idproducto: 302, idatributo: 3, nombreatributo: 'LITROS', valoratributo: '1 litro', orden: 1, esvendedor: '0' },
    { idproducto: 302, idatributo: 3, nombreatributo: 'LITROS', valoratributo: '4 litros', orden: 2, esvendedor: '0' },
    { idproducto: 302, idatributo: 3, nombreatributo: 'LITROS', valoratributo: '10 litros', orden: 3, esvendedor: '0' },
    { idproducto: 302, idatributo: 3, nombreatributo: 'LITROS', valoratributo: '20 litros', orden: 4, esvendedor: '0' },
    { idproducto: 302, idatributo: 9, nombreatributo: 'MARCA', valoratributo: 'Alba', orden: 1, esvendedor: '0' },
    { idproducto: 302, idatributo: 9, nombreatributo: 'MARCA', valoratributo: 'Colorin', orden: 2, esvendedor: '0' },
    // Sólo para vendedores: el Modo IA no lo puede proponer ni ofrecer.
    { idproducto: 302, idatributo: 9, nombreatributo: 'MARCA', valoratributo: 'MarcaDeVendedor', orden: 3, esvendedor: '1' }
  ]);
});

beforeEach(() => { callGemini.mockReset(); });

describe('ia.chat', () => {
  it('returns { type: "question" } when Gemini responds with a question', async () => {
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [11] })
      .mockResolvedValueOnce({ type: 'question', text: '¿de qué color?' });

    const out = await ia.chat(USER_ID, [{ role: 'user', text: 'quiero pintar' }]);

    expect(out).toEqual({ type: 'question', text: '¿de qué color?' });
    expect(callGemini).toHaveBeenCalledTimes(2);
  });

  it('returns { type: "proposal" } and filters items with unknown idproducto', async () => {
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [11, 12] })
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
    callGemini.mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [] });

    const out = await ia.chat(USER_ID, [{ role: 'user', text: 'blablabla' }]);

    expect(out.type).toBe('question');
    expect(out.text).toMatch(/rubro/i);
    expect(callGemini).toHaveBeenCalledTimes(1);
  });

  it('returns question when proposal has 0 valid items after filtering', async () => {
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [11] })
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

  it('drops subcategories that do not belong to the returned rubro', async () => {
    // Pintura (5) tiene la subcategoría 35; Bebidas (7) tiene la 70.
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35, 70] })
      .mockResolvedValueOnce({ type: 'question', text: '¿Interior o exterior?' });

    await ia.chat(USER_ID, [{ role: 'user', text: 'quiero pintar' }]);

    // La segunda llamada arma la lista de productos: sólo puede traer los de Pintura.
    const prompt = callGemini.mock.calls[1][0].systemPrompt;
    expect(prompt).toContain('Latex');
    expect(prompt).not.toContain('Gaseosa');
  });

  it('returns the idrubro alongside a proposal', async () => {
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35] })
      .mockResolvedValueOnce({ type: 'proposal', text: 'Listo', items: [{ idproducto: 300, cantidad: 2 }] });

    const res = await ia.chat(USER_ID, [
      { role: 'user', text: 'quiero pintar' },
      { role: 'assistant', text: '¿cuántos m2?' },
      { role: 'assistant', text: '¿interior?' },
      { role: 'user', text: '30m2 interior' }
    ]);

    expect(res.type).toBe('proposal');
    expect(res.idrubro).toBe(5);
  });
});

// El valor que elige el usuario vive en productos_atributos.valoratributo;
// productos.atributo1/2 sólo guardan el NOMBRE del grupo ("LITROS"). Sin los
// valores en el prompt el modelo no puede proponer "20 litros", y sin campo
// donde anotarlo la elección se pierde antes de llegar al Quodom.
describe('ia.chat (atributos del producto)', () => {
  it('sends the selectable attribute values to Gemini, not just the group names', async () => {
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35] })
      .mockResolvedValueOnce({ type: 'question', text: '¿cuántos m2?' });

    await ia.chat(USER_ID, [{ role: 'user', text: 'quiero pintar' }]);

    const prompt = callGemini.mock.calls[1][0].systemPrompt;
    expect(prompt).toContain('20 litros');
    expect(prompt).toContain('Alba');
    expect(prompt).not.toContain('MarcaDeVendedor');
  });

  it('keeps an attribute value the product actually offers', async () => {
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35] })
      .mockResolvedValueOnce({
        type: 'proposal',
        text: 'Listo',
        items: [{ idproducto: 302, cantidad: 3, motivo: '60m² a 2 manos', atributo1: '20 litros' }]
      });

    const out = await ia.chat(USER_ID, [{ role: 'user', text: 'pintar 60m2' }]);

    expect(out.items[0].nombreAtributo1).toBe('LITROS');
    expect(out.items[0].atributo1).toBe('20 litros');
  });

  it('drops an attribute value the product does not offer', async () => {
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35] })
      .mockResolvedValueOnce({
        type: 'proposal',
        text: 'Listo',
        items: [{ idproducto: 302, cantidad: 1, motivo: 'x', atributo1: '55 litros' }]
      });

    const out = await ia.chat(USER_ID, [{ role: 'user', text: 'pintar' }]);

    expect(out.items[0].atributo1).toBeNull();
  });

  it('leaves an attribute empty when the model did not choose one', async () => {
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35] })
      .mockResolvedValueOnce({
        type: 'proposal',
        text: 'Listo',
        items: [{ idproducto: 302, cantidad: 1, motivo: 'x', atributo1: '4 litros' }]
      });

    const out = await ia.chat(USER_ID, [{ role: 'user', text: 'pintar' }]);

    expect(out.items[0].nombreAtributo2).toBe('MARCA');
    expect(out.items[0].atributo2).toBeNull();
  });

  it('returns the selectable options so the chat can offer a dropdown', async () => {
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35] })
      .mockResolvedValueOnce({
        type: 'proposal',
        text: 'Listo',
        items: [{ idproducto: 302, cantidad: 1, motivo: 'x' }]
      });

    const out = await ia.chat(USER_ID, [{ role: 'user', text: 'pintar' }]);

    expect(out.items[0].opcionesAtributo1).toEqual(['1 litro', '4 litros', '10 litros', '20 litros']);
    expect(out.items[0].opcionesAtributo2).toEqual(['Alba', 'Colorin']);
  });

  it('omits the attribute fields for a product without attributes', async () => {
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35] })
      .mockResolvedValueOnce({
        type: 'proposal',
        text: 'Listo',
        items: [{ idproducto: 300, cantidad: 1, motivo: 'x' }]
      });

    const out = await ia.chat(USER_ID, [{ role: 'user', text: 'pintar' }]);

    expect(out.items[0]).toEqual({
      idproducto: 300, cantidad: 1, motivo: 'x', nombreProducto: 'Latex premium 10L'
    });
  });
});

// El modelo principal también tiene su default en el código y producción corre
// con él: render.yaml no declara GEMINI_MODEL. Si ese default apunta a un modelo
// saturado, el asistente no funciona para nadie y ningún test lo avisa.
describe('ia.chat (modelo por defecto)', () => {
  it('uses the deployed default model when GEMINI_MODEL is unset', async () => {
    const previo = process.env.GEMINI_MODEL;
    delete process.env.GEMINI_MODEL;
    try {
      callGemini
        .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35] })
        .mockResolvedValueOnce({ type: 'question', text: '¿interior?' });

      await ia.chat(USER_ID, [{ role: 'user', text: 'quiero pintar' }]);

      expect(callGemini.mock.calls[1][0].model).toBe('gemini-3-flash-preview');
    } finally {
      if (previo === undefined) delete process.env.GEMINI_MODEL;
      else process.env.GEMINI_MODEL = previo;
    }
  });
});
