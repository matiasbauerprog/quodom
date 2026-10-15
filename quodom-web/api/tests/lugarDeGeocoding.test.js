const { lugarDeGeocoding, mejorResultado } = require('../src/helpers/lugarDeGeocoding');
const { direccionDeGoogle } = require('../src/helpers/direccionDeGoogle');

// La forma de la Geocoding API, que es distinta de la de Places API (New):
// `address_components` con `long_name`, `geometry.location.lat`, `place_id`.
// PENDIENTE DE MEDICIÓN: la API no estaba habilitada en el proyecto el
// 2026-10-15 (REQUEST_DENIED, "This API is not activated"), así que estos
// fixtures salen del formato documentado y no de una respuesta real. Cuando se
// habilite, correr `node scripts/verificar-punto.js` y confirmar que coinciden.
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

  // En un descampado el primero puede ser un código postal o una ciudad. Se usa
  // igual: una localidad alcanza para confirmar, y los campos son editables.
  it('si no hay dirección de calle usa el primero', () => {
    const ciudad = { types: ['locality'], place_id: 'loc' };

    expect(mejorResultado([ciudad]).place_id).toBe('loc');
  });

  it('sin resultados devuelve null', () => {
    expect(mejorResultado([])).toBeNull();
    expect(mejorResultado(undefined)).toBeNull();
  });
});
