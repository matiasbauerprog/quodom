const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');

// productos.atributo1/atributo2 guardan el NOMBRE del grupo ("MEDIDAS"); los
// valores elegibles viven en productos_atributos. La lista necesita los dos.
beforeAll(async () => {
  await db.ready;
  await db.Category.bulkCreate([
    { id: 5, nombrecategoria: 'Pintura', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 35, nombrecategoria: 'Latex', idcategoriapadre: 5, activa: true, orden: 1 }
  ]);
  await db.Products.bulkCreate([
    { id: 200, nombreproducto: 'Bolsa de residuos', categoria: 35, categoriaPadre: 5, atributo1: 'TIPO' },
    { id: 201, nombreproducto: 'Latex Interior', categoria: 35, categoriaPadre: 5, atributo1: 'LITROS', atributo2: 'MARCA' },
    { id: 202, nombreproducto: 'Rodillo', categoria: 35, categoriaPadre: 5 }
  ]);
  await db.productos_atributos.bulkCreate([
    { idproducto: 200, idatributo: 2, nombreatributo: 'TIPO', valoratributo: 'Negra 60 x 90', esvendedor: '0', orden: 2 },
    { idproducto: 200, idatributo: 2, nombreatributo: 'TIPO', valoratributo: 'Consorcio 80 x 110', esvendedor: '0', orden: 1 },
    { idproducto: 200, idatributo: 2, nombreatributo: 'TIPO', valoratributo: 'Sólo vendedor', esvendedor: '1', orden: 3 },
    { idproducto: 201, idatributo: 5, nombreatributo: 'LITROS', valoratributo: '4 L', esvendedor: '0', orden: 1 },
    { idproducto: 201, idatributo: 5, nombreatributo: 'LITROS', valoratributo: '20 L', esvendedor: '0', orden: 2 },
    { idproducto: 201, idatributo: 6, nombreatributo: 'MARCA', valoratributo: 'Alba', esvendedor: '0', orden: 1 }
  ]);
});

describe('GET /productos/categoria/:id con atributos', () => {
  async function porId() {
    const res = await request(app).get('/productos/categoria/35');
    expect(res.status).toBe(200);
    return Object.fromEntries(res.body.map(p => [p.id, p]));
  }

  it('adjunta los valores del primer grupo, ordenados por orden', async () => {
    const p = (await porId())[200];
    expect(p.atributo1).toBe('TIPO');
    expect(p.valoresAtributo1).toEqual(['Consorcio 80 x 110', 'Negra 60 x 90']);
    expect(p.valoresAtributo2).toEqual([]);
  });

  it('deja afuera los valores de vendedor', async () => {
    const p = (await porId())[200];
    expect(p.valoresAtributo1).not.toContain('Sólo vendedor');
  });

  it('separa los dos grupos de un producto que tiene dos', async () => {
    const p = (await porId())[201];
    expect(p.valoresAtributo1).toEqual(['4 L', '20 L']);
    expect(p.valoresAtributo2).toEqual(['Alba']);
  });

  it('devuelve listas vacías para un producto sin atributos', async () => {
    const p = (await porId())[202];
    expect(p.valoresAtributo1).toEqual([]);
    expect(p.valoresAtributo2).toEqual([]);
  });
});
