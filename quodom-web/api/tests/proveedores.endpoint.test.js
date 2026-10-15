// `places` va mockeado en todo el archivo: cada búsqueda real se le paga a
// Google, así que ningún test puede llamarlo.
jest.mock('../src/helpers/places');

const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');
const rateLimit = require('../src/middleware/rateLimit');
const { sessionToken } = require('./helpers/session');
const places = require('../src/helpers/places');
const { PlacesError } = jest.requireActual('../src/helpers/places');

let token, userId, idquodom;

beforeAll(async () => {
  await db.ready;
  await db.series.create({ codigo: 'QUODOM', utilizado: 0, sigla: 'QD-' });
  await db.Category.create({ id: 5, nombrecategoria: 'Pintura', idcategoriapadre: 0, activa: true, orden: 1 });
  await db.provincia.create({ id: 1, provincia: 'Buenos Aires' });
  await request(app).post('/users/signup').send({
    username: 'prov', email: 'prov@test.com', nombre: 'Prov', password: 'secreto123',
    codArea: '11', telefono: '55559999'
  });
  const login = await request(app).post('/users/signin').send({ username: 'prov@test.com', password: 'secreto123' });
  token = sessionToken(login);
  userId = login.body.id;

  await request(app).post('/user_direcciones/create').set('Authorization', 'Bearer ' + token)
    .send({ alias: 'Casa', calle: 'Almte Brown', numero: '3185', localidad: 'Villa Ballester',
            idprovincia: 1, placeid: 'ChIJ-casa', lat: -34.5492, lng: -58.5588, default: true });

  const q = await request(app).post('/quodom/create').set('Authorization', 'Bearer ' + token)
    .send({ descripcion: 'Obra', idrubro: 5 });
  idquodom = q.body.idquodom;
});

beforeEach(async () => {
  jest.resetAllMocks();
  // El cupo es de 10 por minuto y el archivo hace más consultas que eso con el
  // mismo usuario: sin esto los últimos tests fallarían con 429.
  rateLimit._reset();
  await db.quodom_proveedores.destroy({ where: {} });
  await db.lugares_sinwhatsapp.destroy({ where: {} });
});

const auth = req => req.set('Authorization', 'Bearer ' + token);

const UNO = {
  placeid: 'ChIJ-lebleu', nombre: 'Pinturerías Le Bleu', lat: -34.5461, lng: -58.5613,
  rating: 4.9, resenas: 190, telefono: '011 6668-7854', direccion: 'Almte Brown 3185'
};

describe('GET /quodom/proveedores/:id', () => {
  it('devuelve los proveedores del rubro, con distancia y teléfono listo para WhatsApp', async () => {
    places.buscarProveedores.mockResolvedValue([UNO]);

    const res = await auth(request(app).get('/quodom/proveedores/' + idquodom));

    expect(res.status).toBe(200);
    expect(res.body.preciso).toBe(true);
    expect(res.body.proveedores).toHaveLength(1);
    const p = res.body.proveedores[0];
    expect(p.nombre).toBe('Pinturerías Le Bleu');
    expect(p.telefono).toBe('+541166687854');

    // La promesa del feature es que la distancia que se muestra está medida
    // desde la dirección que el proveedor va a recibir, así que las tres cosas
    // que lo atan se afirman con el número exacto y no con "mayor que cero":
    // con `> 0` y un `objectContaining` que ignora el punto, buscar desde el
    // Obelisco —a 20 km— pasaba los nueve tests.
    //
    // 1. Se buscó con el término medido del rubro 5 y desde el punto de la
    //    dirección, no desde cualquier otro.
    expect(places.buscarProveedores).toHaveBeenCalledWith(
      expect.objectContaining({ texto: 'pinturería', lat: -34.5492, lng: -58.5588 }));
    // 2. La distancia es la real entre ChIJ-casa y ChIJ-lebleu (~0,41 km).
    expect(p.distanciakm).toBeCloseTo(0.4, 1);
    // 3. `desde` nombra esa misma dirección, que es lo que ata el punto a la
    //    fila que resolvió `direccionDelQuodom` y no a otra del usuario.
    expect(res.body.desde).toBe('Almte Brown 3185');
  });

  it('deja anotado a quiénes se le ofreció', async () => {
    places.buscarProveedores.mockResolvedValue([UNO]);

    await auth(request(app).get('/quodom/proveedores/' + idquodom));

    const filas = await db.quodom_proveedores.findAll({ where: { idquodom } });
    expect(filas.map(f => f.placeid)).toContain('ChIJ-lebleu');
  });

  // La tabla no tiene unique sobre (idquodom, placeid), y volver a abrir el
  // popup es lo normal: si el endpoint duplicara filas, "a cuántos se le
  // ofreció" quedaría inflado para siempre.
  it('consultar dos veces no duplica las filas anotadas', async () => {
    places.buscarProveedores.mockResolvedValue([UNO]);

    await auth(request(app).get('/quodom/proveedores/' + idquodom));
    await auth(request(app).get('/quodom/proveedores/' + idquodom));

    const filas = await db.quodom_proveedores.findAll({ where: { idquodom, placeid: 'ChIJ-lebleu' } });
    expect(filas).toHaveLength(1);
  });

  // Un 0800 es un teléfono real que no abre WhatsApp: tiene que llegar como
  // visible, no como "Google no tiene teléfono de este comercio".
  it('un 0800 viaja sin WhatsApp pero con teléfono visible', async () => {
    places.buscarProveedores.mockResolvedValue([
      { ...UNO, placeid: 'ChIJ-rex', nombre: 'Rex', telefono: '0800-777-7739' }
    ]);

    const res = await auth(request(app).get('/quodom/proveedores/' + idquodom));

    const p = res.body.proveedores[0];
    expect(p.telefono).toBeNull();
    expect(p.telefonovisible).toBe('0800-777-7739');
    expect(p.sintelefono).toBe(false);
  });

  // Places devuelve `lat: null` cuando el lugar no tiene ubicación: rankear
  // calcularía NaN y el renglón diría "a NaN km".
  it('descarta un candidato sin coordenadas en vez de mostrarlo a NaN km', async () => {
    places.buscarProveedores.mockResolvedValue([
      UNO,
      { placeid: 'ChIJ-sinpunto', nombre: 'Sin Punto', lat: null, lng: null, rating: 4.5, resenas: 20, telefono: null, direccion: '' }
    ]);

    const res = await auth(request(app).get('/quodom/proveedores/' + idquodom));

    expect(res.body.proveedores.map(p => p.placeid)).toEqual(['ChIJ-lebleu']);
  });

  // El historial del Quodom enviado existe para contestar "a quién le mandé", y
  // se arma con esta misma respuesta. `listar` busca de nuevo cada vez y
  // `searchText` ordena por relevancia —el sesgo de ubicación es una
  // preferencia, no un filtro—, así que un contactado del lunes puede no venir
  // en los cinco de hoy. Armando la respuesta sólo con lo que vino, desaparece
  // de su propio historial: el comprador le escribe de nuevo, o concluye que
  // nunca le escribió.
  it('un contactado que hoy no vino en la búsqueda igual aparece, con su fecha', async () => {
    const haceDosDias = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await db.quodom_proveedores.create({
      idquodom, placeid: 'ChIJ-devoto', orden: 2, contactado_en: haceDosDias
    });
    places.buscarProveedores.mockResolvedValue([UNO]);

    const res = await auth(request(app).get('/quodom/proveedores/' + idquodom));

    const devoto = res.body.proveedores.find(p => p.placeid === 'ChIJ-devoto');
    expect(devoto).toBeDefined();
    expect(new Date(devoto.contactadoen).getTime()).toBeCloseTo(haceDosDias.getTime(), -3);
    // Sin distancia inventada: no vino de Google, así que no hay desde dónde
    // medirlo, y la pantalla no puede mostrar un número medido desde otra parte.
    // `sindatos` es lo que le dice al renglón que de este lugar sólo se sabe el
    // place_id y la fecha — nombre, puntuación y teléfono no se archivan.
    expect(devoto.distanciakm).toBeNull();
    expect(devoto.sindatos).toBe(true);
    expect(devoto.nombre).toBe('');
  });

  // Lo que NO se arrastra: un lugar que se ofreció y nunca se contactó. Esa
  // fila es la lista de ayer, no el historial, y arrastrarla mostraría un
  // renglón sin nombre, sin teléfono y sin nada que hacer con él.
  it('un ofrecido que no se contactó y hoy no vino no se arrastra', async () => {
    await db.quodom_proveedores.create({ idquodom, placeid: 'ChIJ-solo-ofrecido', orden: 3 });
    places.buscarProveedores.mockResolvedValue([UNO]);

    const res = await auth(request(app).get('/quodom/proveedores/' + idquodom));

    expect(res.body.proveedores.map(p => p.placeid)).not.toContain('ChIJ-solo-ofrecido');
  });

  // El que sí vino de Google no se duplica: su renglón es el de hoy, con
  // nombre, distancia y teléfono, y además con su fecha de contacto.
  it('el contactado que hoy sí vino sale una sola vez y con sus datos', async () => {
    await db.quodom_proveedores.create({
      idquodom, placeid: 'ChIJ-lebleu', orden: 1, contactado_en: new Date()
    });
    places.buscarProveedores.mockResolvedValue([UNO]);

    const res = await auth(request(app).get('/quodom/proveedores/' + idquodom));

    const filas = res.body.proveedores.filter(p => p.placeid === 'ChIJ-lebleu');
    expect(filas).toHaveLength(1);
    expect(filas[0].nombre).toBe('Pinturerías Le Bleu');
    expect(filas[0].sindatos).toBe(false);
    expect(filas[0].contactadoen).not.toBeNull();
  });

  // Review Focus 1: un rubro sin nada cerca.
  it('sin resultados devuelve la lista vacía y un 200, no un error', async () => {
    places.buscarProveedores.mockResolvedValue([]);

    const res = await auth(request(app).get('/quodom/proveedores/' + idquodom));

    expect(res.status).toBe(200);
    expect(res.body.proveedores).toEqual([]);
  });

  // Un rubro activo sin término es un olvido de configuración: devuelve lista
  // vacía y no rompe. Pero `preciso: false` ahí hace que el diálogo diga "Tu
  // dirección no está ubicada con precisión" sobre una dirección perfecta, y
  // encima manda al comprador a revisar un dato que está bien. Hoy es
  // inalcanzable (todo rubro activo tiene término, y hay un test que lo exige);
  // se estrena el día que alguien active un rubro y olvide medirlo.
  it('un rubro sin término no afirma que la dirección sea imprecisa', async () => {
    const sinTermino = await db.Quodom.create({
      descripcion: 'Rubro sin término', idrubro: 4, estado: 'CREADO', createdBy: userId, nro: 'QD-ST'
    });

    const res = await auth(request(app).get('/quodom/proveedores/' + sinTermino.id));

    expect(res.status).toBe(200);
    expect(res.body.proveedores).toEqual([]);
    expect(res.body.preciso).toBe(true);
    // Y no se le pagó nada a Google por un rubro que no tiene qué buscar.
    expect(places.buscarProveedores).not.toHaveBeenCalled();
  });

  // La salida de emergencia en su caso más duro: el servidor no puede ubicar la
  // dirección ni por su localidad. Es el 409 que el diálogo traduce a "no
  // pudimos consultar el mapa" con el botón de enviar sin elegir proveedor
  // debajo, y no tenía cobertura en el servidor.
  it('sin forma de ubicar la dirección responde 409 sin tocar el Quodom', async () => {
    places.puntoDeLocalidad.mockResolvedValue(null);
    // Una dirección sin coordenadas ni placeid: el único camino es la localidad.
    const dir = await db.user_direcciones.create({
      userid: userId, alias: 'Campo', calle: 'Ninguna', numero: '1',
      localidad: 'Qwertyuiop', idprovincia: '1', default: false
    });
    const q = await db.Quodom.create({
      descripcion: 'Sin ubicación', idrubro: 5, estado: 'CREADO', createdBy: userId,
      nro: 'QD-SU', iddireccion: String(dir.id)
    });

    const res = await auth(request(app).get('/quodom/proveedores/' + q.id));

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('sin_ubicacion');
    expect(res.body.message).toMatch(/localidad/i);
    expect((await db.Quodom.findByPk(q.id)).estado).toBe('CREADO');
    expect(places.buscarProveedores).not.toHaveBeenCalled();
    expect(await db.quodom_proveedores.count({ where: { idquodom: q.id } })).toBe(0);
  });

  // Review Focus 5: que el buscador falle NO puede impedir mandar el pedido.
  it('si Google falla responde 503 con su código, sin tocar el Quodom', async () => {
    places.buscarProveedores.mockRejectedValue(new PlacesError('google_error', 'places: HTTP 503'));

    const res = await auth(request(app).get('/quodom/proveedores/' + idquodom));

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('google_error');
    const q = await db.Quodom.findByPk(idquodom);
    expect(q.estado).toBe('CREADO');
    // No queda anotado nadie: hoy se cumple sólo porque `anotarOfrecidos` corre
    // después de la búsqueda, que es justo el orden que un refactor mueve sin
    // darse cuenta. Con filas escritas, el Quodom diría que se le ofreció a
    // comercios que nunca se le mostraron.
    expect(await db.quodom_proveedores.count({ where: { idquodom } })).toBe(0);
  });

  it('el Quodom de otro usuario no se puede consultar', async () => {
    await request(app).post('/users/signup').send({
      username: 'otro', email: 'otro@test.com', nombre: 'Otro', password: 'secreto123',
      codArea: '11', telefono: '55558888'
    });
    const login2 = await request(app).post('/users/signin').send({ username: 'otro@test.com', password: 'secreto123' });

    const res = await request(app).get('/quodom/proveedores/' + idquodom)
      .set('Authorization', 'Bearer ' + sessionToken(login2));

    expect(res.status).toBe(400);
  });

  // El tope se alcanza en uso honesto: cada apertura del popup es una consulta
  // a Google y no hay caché, así que comparar unos cuantos Quodoms pasa de 10 en
  // un minuto. El cupo ya está separado del chat por el scope; el texto también
  // tiene que estarlo, porque "muchos mensajes" a quien no mandó ninguno no
  // explica nada y manda a buscar el problema donde no está.
  it('el 429 habla de buscar proveedores y no de mensajes', async () => {
    const antes = process.env.PROVEEDORES_RATE_LIMIT_PER_MINUTE;
    process.env.PROVEEDORES_RATE_LIMIT_PER_MINUTE = '1';
    places.buscarProveedores.mockResolvedValue([UNO]);

    try {
      await auth(request(app).get('/quodom/proveedores/' + idquodom));
      const res = await auth(request(app).get('/quodom/proveedores/' + idquodom));

      expect(res.status).toBe(429);
      expect(res.body.error).toBe('rate_limit');
      expect(res.body.message).toMatch(/proveedores/i);
      expect(res.body.message).not.toMatch(/mensajes/i);
    } finally {
      // `delete` y no asignar `antes` cuando no estaba seteada: asignar
      // `undefined` guarda el string 'undefined', y el `Number()` de la ruta
      // lo lee como NaN, así que el default dejaría de aplicarse para el resto
      // de la corrida.
      if (antes === undefined) delete process.env.PROVEEDORES_RATE_LIMIT_PER_MINUTE;
      else process.env.PROVEEDORES_RATE_LIMIT_PER_MINUTE = antes;
    }
  });

  // Un tope por minuto acota el **ritmo**, no el **total**: una cuenta
  // sostenida en 10/min son 14.400 búsquedas pagas por día, unos US$500
  // diarios, sin que nada lo note. El cupo diario es el que la spec nombra dos
  // veces y el que de verdad acota la factura.
  it('el tope diario corta y habla del día, no de minutos', async () => {
    const antes = process.env.PROVEEDORES_RATE_LIMIT_PER_DAY;
    process.env.PROVEEDORES_RATE_LIMIT_PER_DAY = '1';
    places.buscarProveedores.mockResolvedValue([UNO]);

    try {
      const primera = await auth(request(app).get('/quodom/proveedores/' + idquodom));
      expect(primera.status).toBe(200);

      const res = await auth(request(app).get('/quodom/proveedores/' + idquodom));

      expect(res.status).toBe(429);
      expect(res.body.error).toBe('rate_limit');
      expect(res.body.message).toMatch(/hoy/i);
      // Y nombra la salida: el comprador igual tiene que poder enviar.
      expect(res.body.message).toMatch(/sin elegir proveedor/i);
    } finally {
      if (antes === undefined) delete process.env.PROVEEDORES_RATE_LIMIT_PER_DAY;
      else process.env.PROVEEDORES_RATE_LIMIT_PER_DAY = antes;
    }
  });

  it('exige sesión', async () => {
    const res = await request(app).get('/quodom/proveedores/' + idquodom);
    expect(res.status).toBe(401);
  });
});
