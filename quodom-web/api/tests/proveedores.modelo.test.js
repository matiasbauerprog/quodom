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

  // La única garantía automática de "de Google sólo se guarda el place_id". Es
  // una aserción NEGATIVA a propósito: el nombre, la puntuación, las reseñas y
  // el teléfono no se pueden archivar (sus términos los dan para mostrar en el
  // momento), así que la prueba no es que haya un campo sino que no lo haya.
  // Agregar una de esas columnas "para no volver a consultar" es exactamente el
  // cambio que nadie revisaría dos veces.
  it('ninguna de las dos tablas guarda datos de Places más allá del place_id', async () => {
    const prohibidas = ['nombre', 'rating', 'puntuacion', 'resenas', 'userratingcount',
      'telefono', 'phone', 'direccion', 'address', 'lat', 'lng', 'location'];

    for (const tabla of ['quodom_proveedores', 'lugares_sinwhatsapp']) {
      const [cols] = await db.sequelize.query('PRAGMA table_info(' + tabla + ')');
      const nombres = cols.map(c => c.name.toLowerCase());
      expect(nombres.filter(n => prohibidas.includes(n))).toEqual([]);
    }
  });

  it('las dos tablas existen en la base', async () => {
    const [t] = await db.sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('quodom_proveedores','lugares_sinwhatsapp')");
    expect(t.map(x => x.name).sort()).toEqual(['lugares_sinwhatsapp', 'quodom_proveedores']);
  });
});
