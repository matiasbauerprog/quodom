const { lugarDeGeocoding, mejorResultado } = require('../src/helpers/lugarDeGeocoding');
const { direccionDeGoogle } = require('../src/helpers/direccionDeGoogle');

// La forma de la Geocoding API, que es distinta de la de Places API (New):
// `address_components` con `long_name`, `geometry.location.lat`, `place_id`.
// MEDIDO el 2026-10-15 con `node scripts/verificar-punto.js` sobre las tres
// zonas urbanas y un punto en el agua: el formato coincide y las tres
// provincias matchean (Buenos Aires, CABA, Córdoba). Esa corrida encontró algo
// que estos fixtures no cubrían — ver el último describe.
const BALLESTER = {
  place_id: 'ChIJ-ballester',
  formatted_address: 'Ídolo 3720, B1653 Villa Ballester, Provincia de Buenos Aires, Argentina',
  types: ['street_address'],
  geometry: { location: { lat: -34.5468, lng: -58.5562 }, location_type: 'ROOFTOP' },
  address_components: [
    { long_name: '3720', short_name: '3720', types: ['street_number'] },
    { long_name: 'Ídolo', short_name: 'Ídolo', types: ['route'] },
    { long_name: 'Villa Ballester', short_name: 'Villa Ballester', types: ['locality', 'political'] },
    { long_name: 'General San Martín', short_name: 'Gral. San Martín', types: ['administrative_area_level_2', 'political'] },
    { long_name: 'Provincia de Buenos Aires', short_name: 'BA', types: ['administrative_area_level_1', 'political'] },
    { long_name: 'Argentina', short_name: 'AR', types: ['country', 'political'] },
    { long_name: 'B1653', short_name: 'B1653', types: ['postal_code'] }
  ]
};

// CABA: `locality` es "Buenos Aires" para la ciudad entera y el barrio vive en
// `sublocality`. Es la regla que este helper existe para no duplicar.
const PALERMO = {
  place_id: 'ChIJ-palermo',
  formatted_address: 'Thames 1500, C1414 Cdad. Autónoma de Buenos Aires, Argentina',
  types: ['street_address'],
  geometry: { location: { lat: -34.5889, lng: -58.4306 } },
  address_components: [
    { long_name: '1500', short_name: '1500', types: ['street_number'] },
    { long_name: 'Thames', short_name: 'Thames', types: ['route'] },
    { long_name: 'Palermo', short_name: 'Palermo', types: ['sublocality', 'sublocality_level_1', 'political'] },
    { long_name: 'Buenos Aires', short_name: 'CABA', types: ['locality', 'political'] },
    { long_name: 'Ciudad Autónoma de Buenos Aires', short_name: 'CABA', types: ['administrative_area_level_1', 'political'] },
    { long_name: 'Argentina', short_name: 'AR', types: ['country', 'political'] }
  ]
};

describe('lugarDeGeocoding', () => {
  it('traduce los nombres de campo de la Geocoding API a los de Places', () => {
    const l = lugarDeGeocoding(BALLESTER);

    expect(l.id).toBe('ChIJ-ballester');
    expect(l.formattedAddress).toContain('Ídolo 3720');
    expect(l.location).toEqual({ latitude: -34.5468, longitude: -58.5562 });
    expect(l.addressComponents[0]).toEqual({ types: ['street_number'], longText: '3720', shortText: '3720' });
  });

  it('devuelve null sin resultado', () => {
    expect(lugarDeGeocoding(null)).toBeNull();
    expect(lugarDeGeocoding(undefined)).toBeNull();
  });

  it('deja location en null si el punto no viene', () => {
    expect(lugarDeGeocoding({ place_id: 'x', geometry: {} }).location).toBeNull();
  });

  // Lo que de verdad importa: que el parser de siempre pueda leerlo. Si este
  // test pasa, las 24 provincias y la regla de CABA sirven para los dos
  // caminos sin una segunda copia.
  it('el resultado lo entiende direccionDeGoogle, con todo lo suyo', () => {
    const d = direccionDeGoogle(lugarDeGeocoding(BALLESTER));

    expect(d.calle).toBe('Ídolo');
    expect(d.numero).toBe('3720');
    expect(d.localidad).toBe('Villa Ballester');
    expect(d.partido).toBe('General San Martín');
    expect(d.cp).toBe('B1653');
    // "Provincia de Buenos Aires" tiene que matchear: es el prefijo que Google
    // antepone y que ya rompió esto una vez, dejando la provincia en null.
    expect(d.idprovincia).not.toBeNull();
  });

  it('en CABA toma el barrio y no "Buenos Aires"', () => {
    const d = direccionDeGoogle(lugarDeGeocoding(PALERMO));

    expect(d.localidad).toBe('Palermo');
  });
});

describe('mejorResultado', () => {
  it('prefiere la dirección de calle sobre lo más general', () => {
    const cp = { types: ['postal_code'], place_id: 'cp' };
    const r = mejorResultado([cp, BALLESTER]);

    expect(r.place_id).toBe('ChIJ-ballester');
  });

  // Sin calle, una localidad alcanza: es el caso del pueblo chico y sirve para
  // confirmar dónde quedó el pin. Lo que NO sirve es un resultado sin calle ni
  // localidad (plus_code, partido, provincia) — ver el describe de abajo, que
  // sale de medir la API de verdad.
  it('si no hay dirección de calle usa la localidad', () => {
    const ciudad = {
      types: ['locality'], place_id: 'loc', formatted_address: 'Pueblo',
      geometry: { location: { lat: -34, lng: -58 } },
      address_components: [{ long_name: 'Pueblo', short_name: 'Pueblo', types: ['locality', 'political'] }]
    };

    expect(mejorResultado([ciudad]).place_id).toBe('loc');
  });

  it('sin resultados devuelve null', () => {
    expect(mejorResultado([])).toBeNull();
    expect(mejorResultado(undefined)).toBeNull();
  });
});

// MEDIDO el 2026-10-15 con la API ya habilitada, y esto es lo que mi primera
// version se habia perdido: **un punto sin direccion NO devuelve ZERO_RESULTS**.
//
//   en el Rio de la Plata  -> 1 resultado, solo un plus_code (48Q46G22+22)
//   en campo abierto       -> 4 resultados: plus_code, partido (Utracan),
//                             provincia y pais. Ninguno con calle ni localidad.
//
// Sin esta regla el endpoint contestaba 200, el 404 no se disparaba nunca, y el
// usuario confirmaba un punto cuya direccion decia "48Q46G22+22". Un Plus Code
// es la coordenada escrita de otra forma: es exactamente lo que la ventana
// existe para no mostrar.
const RIO = {
  place_id: 'GhIJZmZmZmZmQcARAAAAAADATMA',
  formatted_address: '48Q46G22+22',
  types: ['plus_code'],
  geometry: { location: { lat: -34.8, lng: -57.5 } },
  address_components: [{ long_name: '48Q46G22+22', short_name: '48Q46G22+22', types: ['plus_code'] }]
};

const CAMPO_PARTIDO = {
  place_id: 'ChIJ-utracan',
  formatted_address: 'Utracán, La Pampa, Argentina',
  types: ['administrative_area_level_2', 'political'],
  geometry: { location: { lat: -37.5, lng: -64.8 } },
  address_components: [
    { long_name: 'Utracán', short_name: 'Utracán', types: ['administrative_area_level_2', 'political'] },
    { long_name: 'La Pampa', short_name: 'LP', types: ['administrative_area_level_1', 'political'] },
    { long_name: 'Argentina', short_name: 'AR', types: ['country', 'political'] }
  ]
};

describe('mejorResultado: un punto que no tiene direccion', () => {
  it('descarta un plus_code, que es la coordenada escrita de otra forma', () => {
    expect(mejorResultado([RIO])).toBeNull();
  });

  it('descarta un partido sin calle ni localidad', () => {
    expect(mejorResultado([RIO, CAMPO_PARTIDO])).toBeNull();
  });

  // Una localidad sola SI sirve: es el caso del pueblo chico, y alcanza para
  // confirmar donde quedo el pin.
  it('acepta una localidad sin calle', () => {
    const pueblo = {
      place_id: 'p', formatted_address: 'Villa Ballester', types: ['locality'],
      geometry: { location: { lat: -34.54, lng: -58.55 } },
      address_components: [{ long_name: 'Villa Ballester', short_name: 'VB', types: ['locality', 'political'] }]
    };
    expect(mejorResultado([RIO, pueblo])).not.toBeNull();
  });
});
