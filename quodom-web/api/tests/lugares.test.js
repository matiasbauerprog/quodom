jest.mock('../src/helpers/places');

const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');
const { sessionToken } = require('./helpers/session');
const places = require('../src/helpers/places');
const rateLimit = require('../src/middleware/rateLimit');
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

beforeEach(() => {
  jest.resetAllMocks();
  rateLimit._reset();
});

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

  // El tope es control de gasto y se alcanza tipeando: el aviso tiene que
  // nombrar lo que el usuario estaba haciendo. Con el mensaje por defecto del
  // middleware —el del chat de IA— quien sólo escribió una dirección leía
  // "Muchos mensajes muy rápido" y se iba a buscar el problema a sus mensajes.
  it('el 429 habla de buscar direcciones y no de mensajes', async () => {
    const antes = process.env.LUGARES_RATE_LIMIT_PER_MINUTE;
    process.env.LUGARES_RATE_LIMIT_PER_MINUTE = '1';
    places.sugerencias.mockResolvedValue([]);

    try {
      await auth(request(app).get('/lugares/sugerencias?q=corrientes&sesion=s1'));
      const res = await auth(request(app).get('/lugares/sugerencias?q=corrientes&sesion=s1'));

      expect(res.status).toBe(429);
      expect(res.body.message).toMatch(/direcciones/i);
      expect(res.body.message).not.toMatch(/mensajes/i);
    } finally {
      if (antes === undefined) delete process.env.LUGARES_RATE_LIMIT_PER_MINUTE;
      else process.env.LUGARES_RATE_LIMIT_PER_MINUTE = antes;
    }
  });

  // El de por minuto acota el RITMO y no el TOTAL. Por este balde pasan el
  // autocompletado y el pin arrastrable, y 40/min sostenidos son 57.600
  // consultas pagas en un dia: un bucle de recarga en caliente, en desarrollo,
  // llega solo. Es el mismo defecto que ya se arreglo en proveedores, que
  // quedo con tope diario mientras este se quedo sin ninguno.
  it('tiene tope por dia, y su aviso no manda a esperar un rato', async () => {
    const antes = process.env.LUGARES_RATE_LIMIT_PER_DAY;
    process.env.LUGARES_RATE_LIMIT_PER_DAY = '1';
    places.sugerencias.mockResolvedValue([]);

    try {
      await auth(request(app).get('/lugares/sugerencias?q=corrientes&sesion=s1'));
      const res = await auth(request(app).get('/lugares/sugerencias?q=corrientes&sesion=s1'));

      expect(res.status).toBe(429);
      expect(res.body.message).toMatch(/hoy|mañana/i);
      // "Esperá un momento" es consejo equivocado cuando la respuesta es mañana.
      expect(res.body.message).not.toMatch(/esperá un momento/i);
    } finally {
      if (antes === undefined) delete process.env.LUGARES_RATE_LIMIT_PER_DAY;
      else process.env.LUGARES_RATE_LIMIT_PER_DAY = antes;
    }
  });

  // El tope diario tambien cubre el pin: es el mismo balde, y es el camino que
  // mas facil se dispara en un bucle, porque no lo tipea nadie.
  it('el tope por dia tambien alcanza al punto del mapa', async () => {
    const antes = process.env.LUGARES_RATE_LIMIT_PER_DAY;
    process.env.LUGARES_RATE_LIMIT_PER_DAY = '1';
    places.direccionDePunto.mockResolvedValue(null);

    try {
      await auth(request(app).get('/lugares/punto?lat=-34.5&lng=-58.5'));
      const res = await auth(request(app).get('/lugares/punto?lat=-34.5&lng=-58.5'));

      expect(res.status).toBe(429);
    } finally {
      if (antes === undefined) delete process.env.LUGARES_RATE_LIMIT_PER_DAY;
      else process.env.LUGARES_RATE_LIMIT_PER_DAY = antes;
    }
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

  // El error-handler serializa objetos planos, asi que un fallo de Google
  // aparecia en el log como 'ERROR LOG: [object Object]': sin codigo y sin
  // mensaje. Quien mire los logs de produccion no tiene con que empezar.
  it('loguea el fallo de Google con su codigo y su mensaje', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    places.sugerencias.mockRejectedValue(new PlacesError('timeout', 'places: timeout'));

    await auth(request(app).get('/lugares/sugerencias?q=corrientes&sesion=s1'));

    const linea = warn.mock.calls.map(c => c.join(' ')).join(' | ');
    expect(linea).toMatch(/timeout/);
    warn.mockRestore();
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

  // La spec pide que la provincia que no matchea se loguee. Es la falla
  // silenciosa por diseno: la direccion se guarda igual, asi que si un dia
  // deja de matchear (un cambio de nombre en Google, una renumeracion del
  // seed) nadie se enteraria. Sin el log no hay con que diagnosticarlo.
  it('loguea la provincia que no matcheo, con el texto y el placeid', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    places.detalleDireccion.mockResolvedValue({
      id: 'ChIJ-br',
      formattedAddress: 'Av. Paulista 1000, Sao Paulo',
      location: { latitude: -23.56, longitude: -46.65 },
      addressComponents: [{ longText: 'Sao Paulo', types: ['administrative_area_level_1'] }]
    });

    await auth(request(app).get('/lugares/ChIJ-br?sesion=s1'));

    const linea = warn.mock.calls.map(c => c.join(' ')).join(' | ');
    expect(linea).toMatch(/Sao Paulo/);
    expect(linea).toMatch(/ChIJ-br/);
    warn.mockRestore();
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
