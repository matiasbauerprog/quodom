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
    expect(p.distanciakm).toBeGreaterThan(0);
    expect(p.telefono).toBe('+541166687854');
    expect(p.esfijo).toBe(true);
    // Buscó con el término medido del rubro 5.
    expect(places.buscarProveedores).toHaveBeenCalledWith(expect.objectContaining({ texto: 'pinturería' }));
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

  // Review Focus 1: un rubro sin nada cerca.
  it('sin resultados devuelve la lista vacía y un 200, no un error', async () => {
    places.buscarProveedores.mockResolvedValue([]);

    const res = await auth(request(app).get('/quodom/proveedores/' + idquodom));

    expect(res.status).toBe(200);
    expect(res.body.proveedores).toEqual([]);
  });

  // Review Focus 5: que el buscador falle NO puede impedir mandar el pedido.
  it('si Google falla responde 503 con su código, sin tocar el Quodom', async () => {
    places.buscarProveedores.mockRejectedValue(new PlacesError('google_error', 'places: HTTP 503'));

    const res = await auth(request(app).get('/quodom/proveedores/' + idquodom));

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('google_error');
    const q = await db.Quodom.findByPk(idquodom);
    expect(q.estado).toBe('CREADO');
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

  it('exige sesión', async () => {
    const res = await request(app).get('/quodom/proveedores/' + idquodom);
    expect(res.status).toBe(401);
  });
});
