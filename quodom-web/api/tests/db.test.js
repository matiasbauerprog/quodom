const db = require('../src/helpers/db');

describe('database initialization', () => {
  beforeAll(async () => { await db.ready; });

  it('creates all tables', async () => {
    const [tables] = await db.sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    const names = tables.map(t => t.name);
    for (const t of ['users', 'categorias', 'productos', 'productos_atributos',
      'quodom_headers', 'quodom_lines', 'users_direcciones', 'provincias',
      'localidades', 'hist_busquedas', 'oper_notificaciones', 'series']) {
      expect(names).toContain(t);
    }
  });

  it('creates all views', async () => {
    const [views] = await db.sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='view'"
    );
    const names = views.map(v => v.name);
    for (const v of ['v_Busquedas', 'v_Quodoms', 'v_Quodoms_Lines', 'v_InfoCompradors']) {
      expect(names).toContain(v);
    }
  });

  it('computes cantproductos and porccompletado in v_Quodoms', async () => {
    const q = await db.Quodom.create({ descripcion: 'Test', createdBy: 'u1', estado: 'CREADO', nro: 'QD-1', idrubro: 5 });
    await db.Quodom_Lines.create({ idquodom: q.id, idproducto: 1, cantidad: 2, nombreAtributo1: 'Color', atributo1: null, createdBy: 'u1' });
    await db.Quodom_Lines.create({ idquodom: q.id, idproducto: 2, cantidad: 1, nombreAtributo1: 'Color', atributo1: 'Blanco', createdBy: 'u1' });
    const vq = await db.v_Quodoms.findOne({ where: { id: q.id } });
    expect(vq.cantproductos).toBe(2);
    expect(Number(vq.porccompletado)).toBe(50);
  });
});
