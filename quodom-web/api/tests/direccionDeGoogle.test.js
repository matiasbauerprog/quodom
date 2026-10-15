const { direccionDeGoogle } = require('../src/helpers/direccionDeGoogle');

// La forma que devuelve Places API (New): addressComponents con longText y types.
function comp(longText, ...types) {
  return { longText, shortText: longText, types };
}

const CORRIENTES_1234 = {
  id: 'ChIJ-caba-1',
  formattedAddress: 'Av. Corrientes 1234, C1043 Cdad. Autónoma de Buenos Aires, Argentina',
  location: { latitude: -34.6037, longitude: -58.3816 },
  addressComponents: [
    comp('1234', 'street_number'),
    comp('Avenida Corrientes', 'route'),
    comp('San Nicolás', 'sublocality', 'sublocality_level_1'),
    comp('Buenos Aires', 'locality'),
    comp('Ciudad Autónoma de Buenos Aires', 'administrative_area_level_1'),
    comp('C1043', 'postal_code')
  ]
};

describe('direccionDeGoogle', () => {
  it('desarma una dirección de CABA en nuestros campos', () => {
    expect(direccionDeGoogle(CORRIENTES_1234)).toEqual({
      placeid: 'ChIJ-caba-1',
      calle: 'Avenida Corrientes',
      numero: '1234',
      localidad: 'San Nicolás',
      partido: '',
      idprovincia: 2,
      cp: 'C1043',
      lat: -34.6037,
      lng: -58.3816,
      direccion: 'Av. Corrientes 1234, C1043 Cdad. Autónoma de Buenos Aires, Argentina'
    });
  });

  // En CABA, `locality` dice "Buenos Aires" para toda la ciudad: el barrio está
  // en `sublocality`. Guardar "Buenos Aires" como localidad no le dice nada al
  // proveedor, y es el dato que viaja en el mensaje de WhatsApp.
  it('en CABA prefiere el barrio (sublocality) sobre la localidad', () => {
    expect(direccionDeGoogle(CORRIENTES_1234).localidad).toBe('San Nicolás');
  });

  it('en el Gran Buenos Aires usa locality y guarda el partido', () => {
    const out = direccionDeGoogle({
      id: 'ChIJ-gba-1',
      formattedAddress: 'Mitre 450, B1642 San Isidro, Provincia de Buenos Aires, Argentina',
      location: { latitude: -34.4707, longitude: -58.5075 },
      addressComponents: [
        comp('450', 'street_number'),
        comp('Bartolomé Mitre', 'route'),
        comp('San Isidro', 'locality'),
        comp('San Isidro', 'administrative_area_level_2'),
        comp('Buenos Aires', 'administrative_area_level_1'),
        comp('B1642', 'postal_code')
      ]
    });
    expect(out.localidad).toBe('San Isidro');
    expect(out.partido).toBe('San Isidro');
    expect(out.idprovincia).toBe(1);
  });

  // Review Focus 1: una esquina o un lugar con nombre no tiene altura.
  // La dirección tiene que poder cargarse igual; el usuario completa el número.
  it('deja el número vacío cuando Google no lo da, sin fallar', () => {
    const out = direccionDeGoogle({
      id: 'ChIJ-esquina',
      formattedAddress: 'Av. Corrientes & Callao, Buenos Aires',
      location: { latitude: -34.6, longitude: -58.39 },
      addressComponents: [
        comp('Avenida Corrientes', 'route'),
        comp('Ciudad Autónoma de Buenos Aires', 'administrative_area_level_1')
      ]
    });
    expect(out.numero).toBe('');
    expect(out.calle).toBe('Avenida Corrientes');
    expect(out.cp).toBe('');
    expect(out.idprovincia).toBe(2);
  });

  // Review Focus 5: fuera de Argentina no hay id de provincia. Se guarda sin
  // provincia en vez de rechazar; la columna es nullable desde siempre.
  it('devuelve idprovincia null cuando la provincia no es argentina', () => {
    const out = direccionDeGoogle({
      id: 'ChIJ-br',
      formattedAddress: 'Av. Paulista 1000, São Paulo, Brasil',
      location: { latitude: -23.56, longitude: -46.65 },
      addressComponents: [comp('São Paulo', 'administrative_area_level_1')]
    });
    expect(out.idprovincia).toBeNull();
  });

  // Review Focus 5: sin coordenadas el lugar es inservible para el selector.
  // El parser no decide: informa lat/lng en null y el endpoint rechaza.
  it('devuelve lat y lng en null cuando falta location', () => {
    const out = direccionDeGoogle({ id: 'ChIJ-x', addressComponents: [] });
    expect(out.lat).toBeNull();
    expect(out.lng).toBeNull();
  });
});
