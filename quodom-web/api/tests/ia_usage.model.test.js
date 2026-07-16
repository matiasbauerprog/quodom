const db = require('../src/helpers/db');

describe('ia_usage model', () => {
  beforeAll(async () => { await db.ready; });

  it('is registered on db and creates rows', async () => {
    expect(db.ia_usage).toBeDefined();
    const row = await db.ia_usage.create({ iduser: 'user-a', fecha: '2026-07-15', contador: 1 });
    expect(row.contador).toBe(1);
  });

  it('enforces unique (iduser, fecha)', async () => {
    await db.ia_usage.create({ iduser: 'user-b', fecha: '2026-07-15', contador: 1 });
    await expect(db.ia_usage.create({ iduser: 'user-b', fecha: '2026-07-15', contador: 1 }))
      .rejects.toThrow();
  });
});
