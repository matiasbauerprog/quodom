jest.mock('../src/helpers/gemini');
const { callGemini } = require('../src/helpers/gemini');
const db = require('../src/helpers/db');
const { procesarLista } = require('../src/controllers/lista.controller');

beforeAll(async () => {
  await db.ready;
  await db.Category.bulkCreate([
    { id: 1, nombrecategoria: 'Limpieza', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 92, nombrecategoria: 'Lavandinas', idcategoriapadre: 1, activa: true, orden: 1 },
    { id: 2, nombrecategoria: 'Librería', idcategoriapadre: 0, activa: true, orden: 2 },
    { id: 93, nombrecategoria: 'Papeles', idcategoriapadre: 2, activa: true, orden: 1 },
    { id: 8, nombrecategoria: 'Seguridad Industrial', idcategoriapadre: 0, activa: true, orden: 3 },
    { id: 94, nombrecategoria: 'Cascos', idcategoriapadre: 8, activa: true, orden: 1 }
  ], { ignoreDuplicates: true });
  await db.Products.bulkCreate([
    { id: 8001, nombreproducto: 'Lavandina 5L', categoria: 92, categoriaPadre: 1 },
    { id: 8002, nombreproducto: 'Resma A4 75g', categoria: 93, categoriaPadre: 2 },
    { id: 8003, nombreproducto: 'Casco obra', categoria: 94, categoriaPadre: 8 }
  ], { ignoreDuplicates: true });
});

beforeEach(() => { callGemini.mockReset(); });
// Si un test que la setea falla a mitad, la variable no se lleva puestos los siguientes.
afterEach(() => { delete process.env.IA_LISTA_MAX_LINEAS; });

const TEXTO_DOS_RUBROS = { tipo: 'texto', texto: '3 lavandinas 5L\n2 resmas A4' };

describe('procesarLista', () => {
  it('agrupa por rubro los productos matcheados', async () => {
    callGemini.mockResolvedValueOnce({
      items: [
        { textoOriginal: '3 lavandinas 5L', idproducto: 8001, cantidad: 3 },
        { textoOriginal: '2 resmas A4', idproducto: 8002, cantidad: 2 }
      ],
      noEncontrados: []
    });

    const out = await procesarLista(TEXTO_DOS_RUBROS);

    expect(out.grupos).toHaveLength(2);
    const limpieza = out.grupos.find(g => g.idrubro === 1);
    expect(limpieza.rubro).toBe('Limpieza');
    expect(limpieza.items).toEqual([
      { textoOriginal: '3 lavandinas 5L', idproducto: 8001, nombreProducto: 'Lavandina 5L', cantidad: 3 }
    ]);
    expect(out.noEncontrados).toEqual([]);
    expect(out.lineasIgnoradas).toBe(0);
  });

  it('manda al modelo sólo productos de rubros activos', async () => {
    callGemini.mockResolvedValueOnce({ items: [], noEncontrados: [] });

    await procesarLista({ tipo: 'texto', texto: 'un casco' });

    const prompt = callGemini.mock.calls[0][0].systemPrompt;
    expect(prompt).toContain('Lavandina 5L');
    expect(prompt).not.toContain('Casco obra');
  });

  it('manda a noEncontrados un idproducto que el modelo inventó', async () => {
    callGemini.mockResolvedValueOnce({
      items: [{ textoOriginal: '3 lavandinas 5L', idproducto: 999999, cantidad: 3 }],
      noEncontrados: []
    });

    const out = await procesarLista({ tipo: 'texto', texto: '3 lavandinas 5L' });

    expect(out.grupos).toEqual([]);
    expect(out.noEncontrados).toEqual([
      { textoOriginal: '3 lavandinas 5L', motivo: 'no está en el catálogo' }
    ]);
  });

  it('manda a noEncontrados un producto de un rubro desactivado', async () => {
    callGemini.mockResolvedValueOnce({
      items: [{ textoOriginal: 'un casco', idproducto: 8003, cantidad: 1 }],
      noEncontrados: []
    });

    const out = await procesarLista({ tipo: 'texto', texto: 'un casco' });

    expect(out.grupos).toEqual([]);
    expect(out.noEncontrados[0].textoOriginal).toBe('un casco');
  });

  it('agrega a noEncontrados las líneas que el modelo omitió', async () => {
    callGemini.mockResolvedValueOnce({
      items: [{ textoOriginal: '3 lavandinas 5L', idproducto: 8001, cantidad: 3 }],
      noEncontrados: []
    });

    const out = await procesarLista(TEXTO_DOS_RUBROS);

    expect(out.noEncontrados).toEqual([
      { textoOriginal: '2 resmas A4', motivo: 'no se pudo interpretar' }
    ]);
  });

  it('cuando el modelo manda la misma línea en items y en noEncontrados, gana el match', async () => {
    callGemini.mockResolvedValueOnce({
      items: [{ textoOriginal: '3 lavandinas 5L', idproducto: 8001, cantidad: 3 }],
      noEncontrados: [{ textoOriginal: '3 lavandinas 5L', motivo: 'no hay stock' }]
    });

    const out = await procesarLista({ tipo: 'texto', texto: '3 lavandinas 5L' });

    expect(out.grupos).toHaveLength(1);
    expect(out.grupos[0].items).toEqual([
      { textoOriginal: '3 lavandinas 5L', idproducto: 8001, nombreProducto: 'Lavandina 5L', cantidad: 3 }
    ]);
    expect(out.noEncontrados).toEqual([]);
  });

  it('conserva el motivo que devuelve el modelo', async () => {
    callGemini.mockResolvedValueOnce({
      items: [],
      noEncontrados: [{ textoOriginal: '3 lavandinas 5L', motivo: 'no hay ese tamaño' }]
    });

    const out = await procesarLista({ tipo: 'texto', texto: '3 lavandinas 5L' });

    expect(out.noEncontrados).toEqual([
      { textoOriginal: '3 lavandinas 5L', motivo: 'no hay ese tamaño' }
    ]);
  });

  it('deja la cantidad en 1 cuando el modelo no la manda o es inválida', async () => {
    callGemini.mockResolvedValueOnce({
      items: [{ textoOriginal: 'lavandina', idproducto: 8001, cantidad: 0 }],
      noEncontrados: []
    });

    const out = await procesarLista({ tipo: 'texto', texto: 'lavandina' });

    expect(out.grupos[0].items[0].cantidad).toBe(1);
  });

  it('fusiona dos líneas de la entrada que matchean el mismo producto', async () => {
    callGemini.mockResolvedValueOnce({
      items: [
        { textoOriginal: '2 resmas A4', idproducto: 8002, cantidad: 2 },
        { textoOriginal: '5 resmas A4 75g', idproducto: 8002, cantidad: 5 }
      ],
      noEncontrados: []
    });

    const out = await procesarLista({ tipo: 'texto', texto: '2 resmas A4\n5 resmas A4 75g' });

    const libreria = out.grupos.find(g => g.idrubro === 2);
    expect(libreria.items).toHaveLength(1);
    expect(libreria.items[0].idproducto).toBe(8002);
    expect(libreria.items[0].cantidad).toBe(7);
    expect(libreria.items[0].textoOriginal).toContain('2 resmas A4');
    expect(libreria.items[0].textoOriginal).toContain('5 resmas A4 75g');
  });

  it('recorta una planilla larga antes del llamado e informa el resto', async () => {
    process.env.IA_LISTA_MAX_LINEAS = '2';
    callGemini.mockResolvedValueOnce({ items: [], noEncontrados: [] });

    const texto = ['linea 1', 'linea 2', 'linea 3', 'linea 4'].join('\n');
    const out = await procesarLista({ tipo: 'texto', texto });

    expect(out.lineasIgnoradas).toBe(2);
    const enviado = callGemini.mock.calls[0][0].contents[0].parts[0].text;
    expect(enviado).toBe('linea 1\nlinea 2');
  });

  it('recorta después del llamado cuando la entrada es una foto', async () => {
    process.env.IA_LISTA_MAX_LINEAS = '1';
    callGemini.mockResolvedValueOnce({
      items: [
        { textoOriginal: '3 lavandinas', idproducto: 8001, cantidad: 3 },
        { textoOriginal: '2 resmas', idproducto: 8002, cantidad: 2 }
      ],
      noEncontrados: []
    });

    const out = await procesarLista({
      tipo: 'archivo',
      archivo: { nombre: 'foto.jpg', mime: 'image/jpeg', datosBase64: 'QUJD' }
    });

    expect(out.grupos).toHaveLength(1);
    expect(out.lineasIgnoradas).toBe(1);
  });
});
