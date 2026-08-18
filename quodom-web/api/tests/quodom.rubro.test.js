const db = require('../src/helpers/db');

beforeAll(async () => {
  await db.ready;
  await db.Category.bulkCreate([
    { id: 7, nombrecategoria: 'Bebidas', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 4, nombrecategoria: 'Construcción', idcategoriapadre: 0, activa: true, orden: 2 }
  ]);
});

describe('quodom rubro column', () => {
  it('stores idrubro on the quodom header', async () => {
    const q = await db.Quodom.create({
      descripcion: 'Bebidas oficina', createdBy: 'u-1', estado: 'CREADO', idrubro: 7
    });
    const reloaded = await db.Quodom.findByPk(q.id);
    expect(reloaded.idrubro).toBe(7);
  });

  it('exposes idrubro and nombrerubro through v_Quodoms', async () => {
    const q = await db.Quodom.create({
      descripcion: 'Obra', createdBy: 'u-2', estado: 'CREADO', idrubro: 4
    });
    const row = await db.v_Quodoms.findOne({ where: { id: q.id } });
    expect(row.idrubro).toBe(4);
    expect(row.nombrerubro).toBe('Construcción');
  });
});
