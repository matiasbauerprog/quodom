const { sugerencias, detalleDireccion } = require('../src/helpers/places');

describe('places helper', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GOOGLE_MAPS_API_KEY;

  beforeEach(() => { process.env.GOOGLE_MAPS_API_KEY = 'test-key'; });
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = originalKey;
    delete process.env.PLACES_TIMEOUT_MS;
  });

  it('pide sugerencias con la clave, acotadas a Argentina, y las devuelve planas', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestions: [
          { placePrediction: { placeId: 'ChIJ-1', text: { text: 'Av. Corrientes 1234, CABA' } } },
          { placePrediction: { placeId: 'ChIJ-2', text: { text: 'Av. Corrientes 1234, Rosario' } } }
        ]
      })
    });

    const out = await sugerencias({ q: 'corrientes 1234', sesion: 'ses-1' });

    expect(out).toEqual([
      { placeid: 'ChIJ-1', texto: 'Av. Corrientes 1234, CABA' },
      { placeid: 'ChIJ-2', texto: 'Av. Corrientes 1234, Rosario' }
    ]);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('places:autocomplete');
    expect(opts.headers['X-Goog-Api-Key']).toBe('test-key');
    const body = JSON.parse(opts.body);
    expect(body.input).toBe('corrientes 1234');
    expect(body.sessionToken).toBe('ses-1');
    expect(body.includedRegionCodes).toEqual(['ar']);
  });

  // Review Focus 2: cada tecla no puede ser una consulta paga.
  it('con menos de 3 caracteres no llama a Google en absoluto', async () => {
    global.fetch = jest.fn();

    expect(await sugerencias({ q: 'co', sesion: 's' })).toEqual([]);
    expect(await sugerencias({ q: '   ', sesion: 's' })).toEqual([]);
    expect(await sugerencias({ q: '', sesion: 's' })).toEqual([]);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  // Review Focus 3: en desarrollo la clave no va a estar. El error tiene que
  // nombrar la variable, no decir "fetch failed".
  it('sin clave falla nombrando la variable que falta, sin llamar a Google', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    global.fetch = jest.fn();

    await expect(sugerencias({ q: 'corrientes', sesion: 's' }))
      .rejects.toThrow(/GOOGLE_MAPS_API_KEY/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // Review Focus 4.
  it('un 503 de Google se reporta como google_error con el status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 503, text: async () => 'overloaded'
    });

    await expect(sugerencias({ q: 'corrientes', sesion: 's' }))
      .rejects.toMatchObject({ codigo: 'google_error' });
  });

  it('un timeout se reporta como timeout y no cuelga', async () => {
    process.env.PLACES_TIMEOUT_MS = '10';
    global.fetch = jest.fn((url, opts) => new Promise((_, reject) => {
      opts.signal.addEventListener('abort', () => {
        const e = new Error('aborted');
        e.name = 'AbortError';
        reject(e);
      });
    }));

    await expect(sugerencias({ q: 'corrientes', sesion: 's' }))
      .rejects.toMatchObject({ codigo: 'timeout' });
  });

  it('el detalle pide sólo los campos del nivel básico y cierra la sesión', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'ChIJ-1', formattedAddress: 'x', addressComponents: [] })
    });

    const out = await detalleDireccion({ placeid: 'ChIJ-1', sesion: 'ses-1' });

    expect(out.id).toBe('ChIJ-1');
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('/v1/places/ChIJ-1');
    // El sessionToken en el detalle es lo que hace que la tanda de sugerencias
    // no se cobre aparte.
    expect(url).toContain('sessionToken=ses-1');
    // Nada del nivel caro: ni rating, ni teléfono, ni displayName.
    const mask = opts.headers['X-Goog-FieldMask'];
    expect(mask).toContain('addressComponents');
    expect(mask).toContain('location');
    expect(mask).not.toMatch(/rating|phone/i);
  });
});
