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
    { id: 36, nombrecategoria: 'Accesorios', idcategoriapadre: 5, activa: true, orden: 3 },
    { id: 7, nombrecategoria: 'Bebidas', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 70, nombrecategoria: 'Gaseosas', idcategoriapadre: 7, activa: true, orden: 1 }
  ], { ignoreDuplicates: true });
  await db.Products.bulkCreate([
    { id: 200, nombreproducto: 'Látex interior 4L', categoria: 11, categoriaPadre: 5, atributo1: 'Color', atributo2: null },
    { id: 201, nombreproducto: 'Rodillo lana 22cm', categoria: 12, categoriaPadre: 5, atributo1: null, atributo2: null },
    { id: 300, nombreproducto: 'Latex premium 10L', categoria: 35, categoriaPadre: 5, atributo1: null, atributo2: null },
    { id: 301, nombreproducto: 'Gaseosa cola 2L', categoria: 70, categoriaPadre: 7, atributo1: null, atributo2: null },
    { id: 302, nombreproducto: 'Latex Interior Blanco Mate', categoria: 35, categoriaPadre: 5, atributo1: 'LITROS', atributo2: 'MARCA' },
    // Comparte los LITROS con el 302: es el caso que el diccionario comprime.
    { id: 303, nombreproducto: 'Latex Interior Blanco Satinado', categoria: 35, categoriaPadre: 5, atributo1: 'LITROS', atributo2: null },
    // Valores con barra y con coma decimal, como los del catálogo real.
    { id: 304, nombreproducto: 'Cinta de papel', categoria: 36, categoriaPadre: 5, atributo1: 'MEDIDAS', atributo2: null },
    // Accesorio: el clasificador nunca nombra esta subcategoría cuando el
    // usuario dice "quiero pintar", y sin él la propuesta queda sin con qué aplicar.
    { id: 305, nombreproducto: 'Pincel para Latex', categoria: 36, categoriaPadre: 5, atributo1: null, atributo2: null }
  ], { ignoreDuplicates: true });
  await db.productos_atributos.bulkCreate([
    { idproducto: 302, idatributo: 3, nombreatributo: 'LITROS', valoratributo: '1 litro', orden: 1, esvendedor: '0' },
    { idproducto: 302, idatributo: 3, nombreatributo: 'LITROS', valoratributo: '4 litros', orden: 2, esvendedor: '0' },
    { idproducto: 302, idatributo: 3, nombreatributo: 'LITROS', valoratributo: '10 litros', orden: 3, esvendedor: '0' },
    { idproducto: 302, idatributo: 3, nombreatributo: 'LITROS', valoratributo: '20 litros', orden: 4, esvendedor: '0' },
    { idproducto: 302, idatributo: 9, nombreatributo: 'MARCA', valoratributo: 'Alba', orden: 1, esvendedor: '0' },
    { idproducto: 302, idatributo: 9, nombreatributo: 'MARCA', valoratributo: 'Colorin', orden: 2, esvendedor: '0' },
    // Sólo para vendedores: el Modo IA no lo puede proponer ni ofrecer.
    { idproducto: 302, idatributo: 9, nombreatributo: 'MARCA', valoratributo: 'MarcaDeVendedor', orden: 3, esvendedor: '1' },
    { idproducto: 303, idatributo: 3, nombreatributo: 'LITROS', valoratributo: '1 litro', orden: 1, esvendedor: '0' },
    { idproducto: 303, idatributo: 3, nombreatributo: 'LITROS', valoratributo: '4 litros', orden: 2, esvendedor: '0' },
    { idproducto: 303, idatributo: 3, nombreatributo: 'LITROS', valoratributo: '10 litros', orden: 3, esvendedor: '0' },
    { idproducto: 303, idatributo: 3, nombreatributo: 'LITROS', valoratributo: '20 litros', orden: 4, esvendedor: '0' },
    { idproducto: 304, idatributo: 3, nombreatributo: 'MEDIDAS', valoratributo: '1 1/2"', orden: 1, esvendedor: '0' },
    { idproducto: 304, idatributo: 3, nombreatributo: 'MEDIDAS', valoratributo: '3,8 mts', orden: 2, esvendedor: '0' }
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

// El prompt se paga por token en cada turno. Dos cosas lo inflaban sin aportar:
// los valores de atributos repetidos producto por producto (casi la mitad del
// prompt) y las guías de todos los rubros cuando la charla es de uno solo.
describe('ia.chat (tamaño del prompt)', () => {
  async function promptDelAsistente(idsSubcategoria = [35]) {
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria })
      .mockResolvedValueOnce({ type: 'question', text: '¿interior?' });
    await ia.chat(USER_ID, [{ role: 'user', text: 'quiero pintar' }]);
    return callGemini.mock.calls[1][0].systemPrompt;
  }

  it('declares each set of attribute values once instead of repeating it per product', async () => {
    // 302 y 303 comparten exactamente los mismos LITROS: el bloque de atributos
    // tiene que nombrarlos una sola vez y que los dos productos lo referencien.
    // Se mira sólo ese bloque porque las instrucciones también dicen "20 litros",
    // en el ejemplo de la regla de atributos.
    const prompt = await promptDelAsistente();
    const bloque = prompt.slice(prompt.indexOf('ATRIBUTOS ('), prompt.indexOf('PRODUCTOS ('));
    expect(bloque.split('20 litros')).toHaveLength(2);

    const lineasProducto = prompt.slice(prompt.indexOf('PRODUCTOS (')).split('\n');
    expect(lineasProducto.filter(l => l.startsWith('302|'))[0]).toMatch(/\|A\d A\d$/);
    expect(lineasProducto.filter(l => l.startsWith('303|'))[0]).toMatch(/\|A\d$/);
  });

  it('still names every selectable value, so the model can choose one', async () => {
    const prompt = await promptDelAsistente();
    for (const v of ['1 litro', '4 litros', '10 litros', '20 litros', 'Alba', 'Colorin']) {
      expect(prompt).toContain(v);
    }
    expect(prompt).not.toContain('MarcaDeVendedor');
  });

  it('keeps values that contain a slash or a comma intact', async () => {
    // El catálogo real tiene medidas como 1 1/2" y decimales como 3,8 mts: si
    // el separador fuera "/" o "," esos valores se partirían al medio y el
    // modelo elegiría algo que el servidor después descarta.
    const prompt = await promptDelAsistente([36]);
    expect(prompt).toContain('1 1/2"');
    expect(prompt).toContain('3,8 mts');
  });

  it('sends only the guidance of the detected rubro', async () => {
    const prompt = await promptDelAsistente();
    expect(prompt).toContain('antihongo');      // la guía de Pintura
    // "cielorraso" no sirve de marcador: la guía de Pintura lo nombra con razón.
    expect(prompt).not.toContain('aislación');  // la de Construcción
    expect(prompt).not.toContain('bocas');      // la de Electricidad
  });
});

// Un presupuesto de pintura no es sólo pintura: lleva preparación y accesorios.
// El clasificador devolvía dos o tres subcategorías y los accesorios viven en
// otra, así que los pinceles y rodillos ni siquiera llegaban a la lista que ve
// el asistente — no es que no los quisiera proponer, no los tenía.
// Referencia del resultado esperado: informacion para la ia/Pinturería/Listado_Pintura_Depto_Casa.xlsx
describe('ia.chat (catálogo completo del rubro)', () => {
  it('offers every active subcategory of the rubro, not only the ones the classifier picked', async () => {
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35] })
      .mockResolvedValueOnce({ type: 'question', text: '¿interior?' });

    await ia.chat(USER_ID, [{ role: 'user', text: 'quiero pintar una casa' }]);

    const prompt = callGemini.mock.calls[1][0].systemPrompt;
    expect(prompt).toContain('Latex Interior Blanco Mate'); // subcategoría 35, la elegida
    expect(prompt).toContain('Pincel para Latex');          // subcategoría 39, la que faltaba
    expect(prompt).toContain('Rodillo lana 22cm');          // subcategoría 12
  });

  it('still keeps the conversation inside its rubro', async () => {
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35] })
      .mockResolvedValueOnce({ type: 'question', text: '¿interior?' });

    await ia.chat(USER_ID, [{ role: 'user', text: 'quiero pintar' }]);

    expect(callGemini.mock.calls[1][0].systemPrompt).not.toContain('Gaseosa');
  });

  it('accepts a product of a subcategory the classifier never named', async () => {
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35] })
      .mockResolvedValueOnce({
        type: 'proposal', text: 'Listo',
        items: [{ idproducto: 305, cantidad: 2, motivo: 'para aplicar' }]
      });

    const out = await ia.chat(USER_ID, [{ role: 'user', text: 'pintar una casa' }]);

    expect(out.items.map(i => i.idproducto)).toEqual([305]);
  });
});

// El conocimiento del rubro sale de las planillas en "informacion para la ia".
// Sin los rendimientos el asistente propuso 10 litros para una casa entera,
// cuando el listado de referencia pide 4 latas de 20.
describe('ia.chat (guía de Pintura)', () => {
  async function guia() {
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35] })
      .mockResolvedValueOnce({ type: 'question', text: '¿interior?' });
    await ia.chat(USER_ID, [{ role: 'user', text: 'pintar' }]);
    return callGemini.mock.calls[1][0].systemPrompt;
  }

  // Las cifras se afirman con las palabras de la planilla, que es la fuente:
  // antes estaban escritas a mano en el controller y el test fijaba esa
  // redacción, no el dato.
  it('gives the coverage figures needed to size the paint', async () => {
    const p = await guia();
    expect(p).toContain('10 m²/L por mano');
    expect(p).toContain('piso x 2,8');
    expect(p).toContain('2 manos');
  });

  it('demands preparation and accessories, not only paint', async () => {
    const p = await guia();
    expect(p).toMatch(/fijador/i);
    expect(p).toMatch(/rodillo/i);
    expect(p).toMatch(/bandeja/i);
  });

  it('asks the house-only questions and skips them for an apartment', async () => {
    const p = await guia();
    expect(p).toMatch(/pileta/i);
    expect(p).toMatch(/rejas/i);
    expect(p).toMatch(/departamento/i);
  });
});

// El modelo se puso a deliberar dentro de "motivo" — alternativas, recálculos,
// y al final un bucle degenerado de mil palabras — y con eso agotó su
// presupuesto de salida en el PRIMER ítem: la propuesta llegó con un solo
// producto en vez de once. El campo es una línea para el usuario, no un
// borrador: el servidor lo acota pase lo que pase.
describe('ia.chat (motivo acotado)', () => {
  it('trims a runaway motivo instead of passing it through', async () => {
    const delirio = 'Recalculando con envase de 10 litros: '.repeat(60);
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35] })
      .mockResolvedValueOnce({
        type: 'proposal', text: 'Listo',
        items: [{ idproducto: 302, cantidad: 1, motivo: delirio }]
      });

    const out = await ia.chat(USER_ID, [{ role: 'user', text: 'pintar' }]);

    expect(out.items[0].motivo.length).toBeLessThanOrEqual(200);
    expect(out.items[0].motivo).toMatch(/…$/);
  });

  it('leaves a motivo that is already short untouched', async () => {
    const corto = '1 lata de 10L para 40m² a dos manos (rinde 10 m²/L por mano).';
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35] })
      .mockResolvedValueOnce({
        type: 'proposal', text: 'Listo',
        items: [{ idproducto: 302, cantidad: 1, motivo: corto }]
      });

    const out = await ia.chat(USER_ID, [{ role: 'user', text: 'pintar' }]);

    expect(out.items[0].motivo).toBe(corto);
  });

  it('tells the model that motivo is one sentence and not a scratchpad', async () => {
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35] })
      .mockResolvedValueOnce({ type: 'question', text: '¿interior?' });

    await ia.chat(USER_ID, [{ role: 'user', text: 'pintar' }]);

    const prompt = callGemini.mock.calls[1][0].systemPrompt;
    expect(prompt).toMatch(/UNA sola oración/);
    // La instrucción que causó el desborde: invitaba a mostrar la cuenta ahí.
    expect(prompt).not.toMatch(/mostrá la cuenta en "motivo"/);
  });
});

// El catálogo separa en productos distintos lo que es gusto del usuario: el
// látex interior viene Mate (137) y Satinado (138). Eligiendo el producto, el
// asistente elige la terminación — la regla de no adivinar preferencias sólo
// cubría los atributos, así que por ese hueco decidía sin preguntar.
describe('ia.chat (elegir entre productos que difieren en gusto)', () => {
  it('tells the model to ask when two products differ only in a matter of taste', async () => {
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35] })
      .mockResolvedValueOnce({ type: 'question', text: '¿interior?' });

    await ia.chat(USER_ID, [{ role: 'user', text: 'pintar' }]);

    const prompt = callGemini.mock.calls[1][0].systemPrompt;
    expect(prompt).toMatch(/terminación/i);
    expect(prompt).toMatch(/preguntá cuál/i);
  });
});

// El usuario pidió látex beige y recibió Blanco Mate sin una palabra. El
// catálogo no tiene látex de pared en ningún color salvo blanco — beige sólo
// existe como COLOR de los esmaltes sintéticos, que son para aberturas —, así
// que la respuesta correcta era decirlo, no entregar otra cosa parecida.
describe('ia.chat (nunca sustituir en silencio)', () => {
  async function prompt() {
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35] })
      .mockResolvedValueOnce({ type: 'question', text: '¿interior?' });
    await ia.chat(USER_ID, [{ role: 'user', text: 'quiero pintar de beige' }]);
    return callGemini.mock.calls[1][0].systemPrompt;
  }

  it('forbids handing over something else when the catalogue lacks what was asked', async () => {
    const p = await prompt();
    expect(p).toMatch(/nunca sustituyas en silencio/i);
    expect(p).toMatch(/decílo|decilo/i);
  });

  it('tells the model that wall latex has no colour to offer', async () => {
    const p = await prompt();
    expect(p).toMatch(/látex.*sólo en blanco|sólo existe en blanco/i);
  });
});

// Las guías salen de "informacion para la ia/<Rubro>/Listado_*.xlsx" vía
// `npm run guias`. Un rubro sin guía generada no rompe nada visible: el
// asistente sigue contestando, sólo que sin el conocimiento del rubro y nadie
// se entera. Este test es el que avisa que falta correr la conversión.
describe('guías por rubro', () => {
  const fs = require('fs');
  const path = require('path');
  const { RUBROS_ACTIVOS } = require('../src/config/rubros');
  const DIR = path.join(__dirname, '..', 'src', 'config', 'guias');

  it('has a generated guide for every active rubro', () => {
    const faltan = RUBROS_ACTIVOS.filter(id => !fs.existsSync(path.join(DIR, id + '.txt')));
    expect(faltan).toEqual([]);
  });

  it('carries the assumptions and the worked examples of the rubro', async () => {
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35] })
      .mockResolvedValueOnce({ type: 'question', text: '¿interior?' });

    await ia.chat(USER_ID, [{ role: 'user', text: 'pintar' }]);
    const prompt = callGemini.mock.calls[1][0].systemPrompt;

    expect(prompt).toContain('10 m²/L por mano');   // supuesto de rendimiento
    expect(prompt).toContain('piso x 2,8');         // regla para estimar la pared
    expect(prompt).toContain('Rodillo de Lana');    // sale de un ejemplo resuelto
    expect(prompt).toMatch(/no son plantillas|no plantillas|no son plantillas|no para copiar/i);
  });

  // Estas dos vivían en código, duplicadas: describen el catálogo y no el
  // oficio. Ahora están en la hoja Supuestos, bajo "Datos de este catálogo", y
  // llegan por la misma vía que el resto. El test sigue porque son las que
  // evitan el papelón de ofrecer látex beige.
  it('carries the catalogue facts now that they live in the spreadsheet', async () => {
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35] })
      .mockResolvedValueOnce({ type: 'question', text: '¿interior?' });

    await ia.chat(USER_ID, [{ role: 'user', text: 'pintar' }]);
    const prompt = callGemini.mock.calls[1][0].systemPrompt;

    expect(prompt).toMatch(/sólo en blanco/i);  // el látex no tiene color elegible
    expect(prompt).toMatch(/antihongo/i);
  });
});
