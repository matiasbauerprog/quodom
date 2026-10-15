jest.mock('../src/helpers/places');

const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');
const places = require('../src/helpers/places');
const { sessionToken } = require('./helpers/session');

let token;

beforeAll(async () => {
  await db.ready;
  await request(app).post('/users/signup').send({
    username: 'punto', email: 'punto@test.com', nombre: 'Punto', password: 'secreto123',
    codArea: '11', telefono: '55558888'
  });
  const login = await request(app).post('/users/signin').send({ username: 'punto@test.com', password: 'secreto123' });
  token = sessionToken(login);
});

beforeEach(() => jest.resetAllMocks());

const BALLESTER = {
  place_id: 'ChIJ-ballester',
  formatted_address: 'Ídolo 3720, B1653 Villa Ballester, Provincia de Buenos Aires, Argentina',
  types: ['street_address'],
  geometry: { location: { lat: -34.5468, lng: -58.5562 } },
  address_components: [
    { long_name: '3720', short_name: '3720', types: ['street_number'] },
    { long_name: 'Ídolo', short_name: 'Ídolo', types: ['route'] },
    { long_name: 'Villa Ballester', short_name: 'Villa Ballester', types: ['locality', 'political'] },
    { long_name: 'General San Martín', short_name: 'Gral. San Martín', types: ['administrative_area_level_2', 'political'] },
    { long_name: 'Provincia de Buenos Aires', short_name: 'BA', types: ['administrative_area_level_1', 'political'] },
    { long_name: 'B1653', short_name: 'B1653', types: ['postal_code'] }
  ]
};

function pedir(q) {
  return request(app).get('/lugares/punto' + q).set('Authorization', 'Bearer ' + token);
}

describe('GET /lugares/punto', () => {
  it('devuelve la dirección que hay en el punto', async () => {
    places.direccionDePunto.mockResolvedValue([BALLESTER]);

    const res = await pedir('?lat=-34.5468&lng=-58.5562');

    expect(res.status).toBe(200);
    expect(res.body.calle).toBe('Ídolo');
    expect(res.body.numero).toBe('3720');
    expect(res.body.localidad).toBe('Villa Ballester');
    expect(res.body.idprovincia).not.toBeNull();
  });

  // El punto que vale es el que marcó el usuario, no el que Google emparejó:
  // devolver el de Google le corre el pin unos metros sin avisarle, y en una
  // esquina eso es la casa de al lado.
  it('devuelve el punto pedido y no el que Google emparejó', async () => {
    places.direccionDePunto.mockResolvedValue([{
      ...BALLESTER,
      geometry: { location: { lat: -34.9999, lng: -58.9999 } }
    }]);

    const res = await pedir('?lat=-34.5468&lng=-58.5562');

    expect(res.body.lat).toBeCloseTo(-34.5468, 4);
    expect(res.body.lng).toBeCloseTo(-58.5562, 4);
  });

  // El placeid de la inversa es el de la dirección MÁS CERCANA que Google
  // conoce, no el del punto elegido: guardarlo le daría a `puntoDelQuodom` dos
  // fuentes para un mismo punto.
  it('no devuelve el placeid de la inversa como si fuera el de la dirección', async () => {
    places.direccionDePunto.mockResolvedValue([BALLESTER]);

    const res = await pedir('?lat=-34.5468&lng=-58.5562');

    expect(res.body.placeid).toBe('');
  });

  it('rechaza coordenadas que faltan o están fuera de rango', async () => {
    places.direccionDePunto.mockResolvedValue([BALLESTER]);

    expect((await pedir('')).status).toBe(400);
    expect((await pedir('?lat=-34.5')).status).toBe(400);
    expect((await pedir('?lat=91&lng=0')).status).toBe(400);
    expect((await pedir('?lat=0&lng=181')).status).toBe(400);
    expect((await pedir('?lat=hola&lng=0')).status).toBe(400);
    // Ni una sola consulta paga con un punto que no sirve.
    expect(places.direccionDePunto).not.toHaveBeenCalled();
  });

  // Movió el pin al mar o al campo. Es un caso suyo, no una falla nuestra.
  it('404 cuando Google no conoce ninguna dirección ahí', async () => {
    places.direccionDePunto.mockResolvedValue(null);

    const res = await pedir('?lat=-40&lng=-60');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/mov[eé] el pin/i);
  });

  it('404 también cuando la lista viene vacía', async () => {
    places.direccionDePunto.mockResolvedValue([]);

    expect((await pedir('?lat=-40&lng=-60')).status).toBe(404);
  });

  // Es el error real medido el 2026-10-15: la Geocoding API no estaba
  // habilitada en el proyecto y Google contestó REQUEST_DENIED con HTTP 200.
  // Tiene que llegar como 503 y no como "ese punto no tiene dirección", que
  // manda a diagnosticar el lugar equivocado.
  it('un fallo de Google es 503 y no un 404', async () => {
    const { PlacesError } = jest.requireActual('../src/helpers/places');
    places.direccionDePunto.mockRejectedValue(
      new PlacesError('google_error', 'geocode: REQUEST_DENIED This API is not activated')
    );

    const res = await pedir('?lat=-34.5&lng=-58.5');

    expect(res.status).toBe(503);
  });

  it('sin sesión no se consulta nada', async () => {
    const res = await request(app).get('/lugares/punto?lat=-34.5&lng=-58.5');

    expect(res.status).toBe(401);
    expect(places.direccionDePunto).not.toHaveBeenCalled();
  });

  // `/punto` tiene que ganarle a `/:placeid`, que si no lo trataría como un
  // identificador de lugar: Google diría que no existe y el pin informaría que
  // no hay dirección en ninguna parte. Misma trampa que /quodom/proveedores.
  it('no lo atrapa la ruta /:placeid', async () => {
    places.direccionDePunto.mockResolvedValue([BALLESTER]);

    const res = await pedir('?lat=-34.5468&lng=-58.5562');

    expect(res.status).toBe(200);
    expect(places.detalleDireccion).not.toHaveBeenCalled();
  });
});
