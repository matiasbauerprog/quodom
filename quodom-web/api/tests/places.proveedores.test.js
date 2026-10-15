// quodom-web/api/tests/places.proveedores.test.js
const { buscarProveedores, puntoDeLocalidad } = require('../src/helpers/places');

describe('places: proveedores', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GOOGLE_MAPS_API_KEY;

  beforeEach(() => { process.env.GOOGLE_MAPS_API_KEY = 'test-key'; });
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = originalKey;
  });

  const UNA_RESPUESTA = {
    places: [{
      id: 'ChIJ-prov-1',
      displayName: { text: 'Pinturerías Le Bleu' },
      location: { latitude: -34.5461, longitude: -58.5613 },
      rating: 4.9,
      userRatingCount: 190,
      nationalPhoneNumber: '011 6668-7854',
      shortFormattedAddress: 'Almte Brown 3185, Villa Ballester'
    }]
  };

  it('busca por texto con sesgo de ubicación y devuelve los campos planos', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => UNA_RESPUESTA });

    const out = await buscarProveedores({ texto: 'pinturería', lat: -34.5492, lng: -58.5588 });

    expect(out).toEqual([{
      placeid: 'ChIJ-prov-1',
      nombre: 'Pinturerías Le Bleu',
      lat: -34.5461,
      lng: -58.5613,
      rating: 4.9,
      resenas: 190,
      telefono: '011 6668-7854',
      direccion: 'Almte Brown 3185, Villa Ballester'
    }]);

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('places:searchText');
    const body = JSON.parse(opts.body);
    expect(body.textQuery).toBe('pinturería');
    expect(body.locationBias.circle.center).toEqual({ latitude: -34.5492, longitude: -58.5588 });
    expect(body.maxResultCount).toBe(20);
  });

  // La máscara decide el precio de TODA la consulta. Estos tres campos son del
  // nivel caro y van juntos a propósito: pedir el teléfono aparte es otra
  // consulta del mismo precio.
  it('pide puntuación, reseñas y teléfono en la misma consulta', () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => UNA_RESPUESTA });

    return buscarProveedores({ texto: 'x', lat: 0, lng: 0 }).then(() => {
      const mask = global.fetch.mock.calls[0][1].headers['X-Goog-FieldMask'];
      expect(mask).toContain('places.rating');
      expect(mask).toContain('places.userRatingCount');
      expect(mask).toContain('places.nationalPhoneNumber');
    });
  });

  // Review Focus 2: medido, Google no tiene el teléfono de todos.
  it('un comercio sin teléfono viaja con telefono en null', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: [{ id: 'p', displayName: { text: 'JB' }, location: { latitude: 1, longitude: 2 }, rating: 4.3, userRatingCount: 3 }] })
    });

    const out = await buscarProveedores({ texto: 'x', lat: 0, lng: 0 });
    expect(out[0].telefono).toBeNull();
  });

  // Review Focus 1: un rubro sin nada en esa zona.
  it('sin resultados devuelve lista vacía, no error', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    expect(await buscarProveedores({ texto: 'x', lat: 0, lng: 0 })).toEqual([]);
  });

  it('un 503 de Google se reporta como google_error', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, text: async () => 'boom' });
    await expect(buscarProveedores({ texto: 'x', lat: 0, lng: 0 }))
      .rejects.toMatchObject({ codigo: 'google_error' });
  });
});

describe('puntoDeLocalidad', () => {
  const originalFetch = global.fetch;
  beforeEach(() => { process.env.GOOGLE_MAPS_API_KEY = 'test-key'; });
  afterEach(() => { global.fetch = originalFetch; });

  it('devuelve el punto de la localidad', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: [{ location: { latitude: -34.5492, longitude: -58.5588 }, formattedAddress: 'B1653 Villa Ballester' }] })
    });

    const p = await puntoDeLocalidad('Villa Ballester, Buenos Aires');
    expect(p.lat).toBeCloseTo(-34.5492, 3);
    expect(p.nombre).toContain('Villa Ballester');
  });

  // Review Focus 3: una localidad mal escrita o que Google no conoce.
  it('devuelve null cuando la localidad no resuelve', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    expect(await puntoDeLocalidad('Qwertyuiop')).toBeNull();
  });

  it('con texto vacío no llama a Google', async () => {
    global.fetch = jest.fn();
    expect(await puntoDeLocalidad('')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
