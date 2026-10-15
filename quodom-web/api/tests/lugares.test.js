jest.mock('../src/helpers/places');

const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');
const { sessionToken } = require('./helpers/session');
const places = require('../src/helpers/places');
const { PlacesError } = jest.requireActual('../src/helpers/places');

let token;

beforeAll(async () => {
  await db.ready;
  await request(app).post('/users/signup').send({
    username: 'lugar', email: 'lugar@test.com', nombre: 'Lu', password: 'secreto123',
    codArea: '11', telefono: '55551111'
  });
  const login = await request(app).post('/users/signin')
    .send({ username: 'lugar@test.com', password: 'secreto123' });
  token = sessionToken(login);
});

beforeEach(() => jest.resetAllMocks());

const auth = req => req.set('Authorization', 'Bearer ' + token);

describe('GET /lugares/sugerencias', () => {
  it('devuelve las sugerencias de Google', async () => {
    places.sugerencias.mockResolvedValue([{ placeid: 'ChIJ-1', texto: 'Corrientes 1234, CABA' }]);

    const res = await auth(request(app).get('/lugares/sugerencias?q=corrientes&sesion=s1'));

    expect(res.status).toBe(200);
    expect(res.body.sugerencias).toEqual([{ placeid: 'ChIJ-1', texto: 'Corrientes 1234, CABA' }]);
    expect(places.sugerencias).toHaveBeenCalledWith({ q: 'corrientes', sesion: 's1' });
  });

  it('exige sesión', async () => {
    const res = await request(app).get('/lugares/sugerencias?q=corrientes&sesion=s1');
    expect(res.status).toBe(401);
  });

  // Review Focus 3: el error tiene que nombrar lo que falta, no ser un 500 mudo.
  it('sin clave configurada responde 503 nombrando la variable', async () => {
    places.sugerencias.mockRejectedValue(
      new PlacesError('sin_clave', 'Falta GOOGLE_MAPS_API_KEY. Cargala en el entorno.'));

    const res = await auth(request(app).get('/lugares/sugerencias?q=corrientes&sesion=s1'));

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('sin_clave');
    expect(res.body.message).toMatch(/GOOGLE_MAPS_API_KEY/);
  });

  // Review Focus 4.
  it('un timeout de Google responde 503 y no 500', async () => {
    places.sugerencias.mockRejectedValue(new PlacesError('timeout', 'places: timeout'));

    const res = await auth(request(app).get('/lugares/sugerencias?q=corrientes&sesion=s1'));

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('timeout');
  });
});

describe('GET /lugares/:placeid', () => {
  it('devuelve la dirección desarmada con sus coordenadas', async () => {
    places.detalleDireccion.mockResolvedValue({
      id: 'ChIJ-1',
      formattedAddress: 'Av. Corrientes 1234, CABA, Argentina',
      location: { latitude: -34.6037, longitude: -58.3816 },
      addressComponents: [
        { longText: '1234', types: ['street_number'] },
        { longText: 'Avenida Corrientes', types: ['route'] },
        { longText: 'San Nicolás', types: ['sublocality'] },
        { longText: 'Ciudad Autónoma de Buenos Aires', types: ['administrative_area_level_1'] }
      ]
    });

    const res = await auth(request(app).get('/lugares/ChIJ-1?sesion=s1'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      placeid: 'ChIJ-1', calle: 'Avenida Corrientes', numero: '1234',
      localidad: 'San Nicolás', idprovincia: 2, lat: -34.6037, lng: -58.3816
    });
  });

  // Review Focus 5: sin coordenadas el lugar no sirve para buscar proveedores.
  // Rechazar es mejor que guardar una dirección que después miente.
  it('rechaza un lugar sin coordenadas', async () => {
    places.detalleDireccion.mockResolvedValue({ id: 'ChIJ-x', addressComponents: [] });

    const res = await auth(request(app).get('/lugares/ChIJ-x?sesion=s1'));

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('lugar_sin_coordenadas');
  });

  // Review Focus 5: fuera de Argentina no hay provincia nuestra, pero la
  // dirección se devuelve igual: la columna es nullable.
  it('devuelve idprovincia null para una provincia que no es argentina', async () => {
    places.detalleDireccion.mockResolvedValue({
      id: 'ChIJ-br',
      formattedAddress: 'Av. Paulista 1000, São Paulo',
      location: { latitude: -23.56, longitude: -46.65 },
      addressComponents: [{ longText: 'São Paulo', types: ['administrative_area_level_1'] }]
    });

    const res = await auth(request(app).get('/lugares/ChIJ-br?sesion=s1'));

    expect(res.status).toBe(200);
    expect(res.body.idprovincia).toBeNull();
  });
});
