const db = require('../src/helpers/db');
const { catalogoActivo, rubroDeCategoria } = require('../src/helpers/catalogoActivo');

beforeAll(async () => {
  await db.ready;
  await db.Category.bulkCreate([
    // Rubro activo con subcategoría.
    { id: 1, nombrecategoria: 'Limpieza', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 90, nombrecategoria: 'Lavandinas', idcategoriapadre: 1, activa: true, orden: 1 },
    // Rubro activo cuyo producto cuelga del rubro mismo.
    { id: 5, nombrecategoria: 'Pintura', idcategoriapadre: 0, activa: true, orden: 2 },
    // Rubro desactivado (8 no está en RUBROS_ACTIVOS) con su subcategoría.
    { id: 8, nombrecategoria: 'Seguridad Industrial', idcategoriapadre: 0, activa: true, orden: 3 },
    { id: 91, nombrecategoria: 'Accesorios', idcategoriapadre: 8, activa: true, orden: 1 }
  ], { ignoreDuplicates: true });
  await db.Products.bulkCreate([
    { id: 9001, nombreproducto: 'Lavandina 5L', categoria: 90, categoriaPadre: 1 },
    // Su categoría ES el rubro: el rubro tiene que salir 5, no 0.
    { id: 9002, nombreproducto: 'Placa de yeso', categoria: 5, categoriaPadre: 5 },
    // categoriaPadre miente: dice Limpieza (activo) pero la categoría es del rubro 8.
    { id: 9003, nombreproducto: 'Cono reflectivo', categoria: 91, categoriaPadre: 1 }
  ], { ignoreDuplicates: true });
});

describe('rubroDeCategoria', () => {
  it('devuelve el padre cuando la categoría es una subcategoría', () => {
    expect(rubroDeCategoria({ id: 90, idcategoriapadre: 1 })).toBe(1);
  });

  it('devuelve la categoría misma cuando ES un rubro', () => {
    expect(rubroDeCategoria({ id: 5, idcategoriapadre: 0 })).toBe(5);
  });
});

describe('catalogoActivo', () => {
  it('resuelve el rubro de un producto de subcategoría', async () => {
    const catalogo = await catalogoActivo();
    const p = catalogo.find(x => x.id === 9001);
    expect(p).toEqual({ id: 9001, nombre: 'Lavandina 5L', idrubro: 1, rubro: 'Limpieza' });
  });

  it('resuelve el rubro de un producto que cuelga del rubro mismo', async () => {
    const catalogo = await catalogoActivo();
    const p = catalogo.find(x => x.id === 9002);
    expect(p).toEqual({ id: 9002, nombre: 'Placa de yeso', idrubro: 5, rubro: 'Pintura' });
  });

  it('ignora productos de rubros desactivados aunque categoriaPadre diga otra cosa', async () => {
    const catalogo = await catalogoActivo();
    expect(catalogo.find(x => x.id === 9003)).toBeUndefined();
  });
});
