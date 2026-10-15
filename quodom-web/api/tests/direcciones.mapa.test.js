const db = require('../src/helpers/db');

beforeAll(async () => { await db.ready; });

describe('users_direcciones con datos del mapa', () => {
  it('tiene las columnas del mapa', async () => {
    const [cols] = await db.sequelize.query('PRAGMA table_info(users_direcciones)');
    const nombres = cols.map(c => c.name);
    expect(nombres).toContain('placeid');
    expect(nombres).toContain('lat');
    expect(nombres).toContain('lng');
    expect(nombres).toContain('coords_actualizado');
  });

  it('guarda y devuelve las coordenadas como números', async () => {
    const d = await db.user_direcciones.create({
      userid: 'u-mapa', calle: 'Corrientes', numero: '1234',
      placeid: 'ChIJ-abc', lat: -34.6037, lng: -58.3816,
      coords_actualizado: new Date()
    });
    const leida = await db.user_direcciones.findByPk(d.id);
    expect(leida.placeid).toBe('ChIJ-abc');
    expect(leida.lat).toBeCloseTo(-34.6037, 4);
    expect(leida.lng).toBeCloseTo(-58.3816, 4);
  });

  // Una dirección cargada a mano, sin pasar por el mapa, sigue siendo válida:
  // es el camino de hoy y el que queda cuando no hay clave de Google.
  it('acepta una dirección sin placeid ni coordenadas', async () => {
    const d = await db.user_direcciones.create({
      userid: 'u-mano', calle: 'Mitre', numero: '450'
    });
    expect(d.id).toBeGreaterThan(0);

    // Se afirma sobre la fila leída y no sobre la instancia recién creada:
    // Sequelize deja en `undefined` los atributos que no viajaron en el INSERT,
    // así que la instancia no dice nada sobre lo que quedó guardado.
    const leida = await db.user_direcciones.findByPk(d.id);
    expect(leida.lat).toBeNull();
    expect(leida.lng).toBeNull();
    expect(leida.placeid).toBeNull();
    expect(leida.coords_actualizado).toBeNull();
  });
});
