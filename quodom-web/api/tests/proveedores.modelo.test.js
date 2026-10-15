const db = require('../src/helpers/db');

beforeAll(async () => { await db.ready; });

describe('tablas de proveedores', () => {
  it('quodom_proveedores guarda a quién se le ofreció y a quién se le mandó', async () => {
    await db.quodom_proveedores.create({ idquodom: 'q-1', placeid: 'ChIJ-a', orden: 1 });
    await db.quodom_proveedores.create({ idquodom: 'q-1', placeid: 'ChIJ-b', orden: 2, contactado_en: new Date() });

    const filas = await db.quodom_proveedores.findAll({ where: { idquodom: 'q-1' }, order: [['orden', 'ASC']] });
    expect(filas).toHaveLength(2);
    expect(filas[0].placeid).toBe('ChIJ-a');
    expect(filas[0].contactado_en).toBeNull();
    expect(filas[1].contactado_en).toBeInstanceOf(Date);
  });

  // Es lo único propio que acumula el feature, y lo que lo hace mejorar con el
  // uso. Google deja guardar el place_id sin límite, y el reporte es nuestro.
  it('lugares_sinwhatsapp acumula reportes por lugar', async () => {
    await db.lugares_sinwhatsapp.create({ placeid: 'ChIJ-sin', reportes: 1 });
    const fila = await db.lugares_sinwhatsapp.findByPk('ChIJ-sin');
    expect(fila.reportes).toBe(1);
  });

  it('las dos tablas existen en la base', async () => {
    const [t] = await db.sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('quodom_proveedores','lugares_sinwhatsapp')");
    expect(t.map(x => x.name).sort()).toEqual(['lugares_sinwhatsapp', 'quodom_proveedores']);
  });
});
