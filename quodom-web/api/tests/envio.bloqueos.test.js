/**
 * Qué impide enviar un Quodom. Hasta ahora la única condición era tener al
 * menos un producto: un pedido sin dirección salía igual (el armado del mensaje
 * omite el renglón en silencio) y el proveedor lo recibía sin domicilio, y una
 * línea sin el atributo elegido salía sin decir de qué medida era.
 */
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');
const { sessionToken } = require('./helpers/session');

const AUTH = 'Authorization';

async function crearUsuario(nombre) {
  const email = nombre + '@test.com';
  await request(app).post('/users/signup').send({
    email, nombre, apellido: 'Test', password: 'secreto123', telefono: '55554444'
  });
  const login = await request(app).post('/users/signin').send({ username: email, password: 'secreto123' });
  return sessionToken(login);
}

async function cargarDireccion(token) {
  await request(app).post('/user_direcciones/create')
    .set(AUTH, 'Bearer ' + token)
    .send({
      alias: 'Casa', calle: 'Corrientes', numero: '1234', cp: '1043',
      localidad: 'CABA', idprovincia: 1, default: true
    });
}

async function crearQuodom(token, idrubro = 5) {
  const q = await request(app).post('/quodom/create')
    .set(AUTH, 'Bearer ' + token)
    .send({ descripcion: 'Pintura', idrubro });
  return q.body.idquodom;
}

async function agregarLinea(token, idquodom, extra = {}) {
  const res = await request(app).post('/quodom_lines/add')
    .set(AUTH, 'Bearer ' + token)
    .send({
      idquodom, idproducto: 100, cantidad: 2,
      nombreProducto: 'Latex interior', nombreAtributo1: 'LITROS',
      ...extra
    });
  return res.body.id;
}

function enviar(token, idquodom) {
  return request(app).get('/quodom/whatsapp/' + idquodom).set(AUTH, 'Bearer ' + token);
}

beforeAll(async () => {
  await db.ready;
  await db.series.create({ codigo: 'QUODOM', utilizado: 0, sigla: 'QD-' });
  await db.provincia.create({ id: 1, provincia: 'Buenos Aires' });
  await db.Category.bulkCreate([
    { id: 5, nombrecategoria: 'Pintura', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 35, nombrecategoria: 'Latex', idcategoriapadre: 5, activa: true, orden: 1 }
  ]);
  await db.Products.create({
    id: 100, nombreproducto: 'Latex interior', categoria: 35, categoriaPadre: 5,
    atributo1: 'LITROS', atributo2: null
  });
});

describe('falta la dirección', () => {
  it('no deja enviar si el usuario no tiene ninguna dirección cargada', async () => {
    const token = await crearUsuario('sindireccion');
    const idquodom = await crearQuodom(token);
    await agregarLinea(token, idquodom, { atributo1: '20 litros' });

    const res = await enviar(token, idquodom);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('falta_direccion');
    expect(res.body.message).toMatch(/dirección/i);
  });

  it('deja el Quodom en CREADO cuando lo bloquea', async () => {
    const token = await crearUsuario('sigueabierto');
    const idquodom = await crearQuodom(token);
    await agregarLinea(token, idquodom, { atributo1: '20 litros' });

    await enviar(token, idquodom);

    const q = await db.Quodom.findByPk(idquodom);
    expect(q.estado).toBe('CREADO');
    expect(q.fechaenvio).toBeFalsy();
    expect(await db.oper_notificaciones.count({ where: { idquodom } })).toBe(0);
  });

  // La dirección se copia al crear el Quodom. Quien no tenía ninguna entonces
  // quedaba con iddireccion en null para siempre, incluso después de cargarla.
  it('resuelve la dirección al enviar si el Quodom se creó sin ella', async () => {
    const token = await crearUsuario('cargodespues');
    const idquodom = await crearQuodom(token);
    await agregarLinea(token, idquodom, { atributo1: '20 litros' });
    expect((await db.Quodom.findByPk(idquodom)).iddireccion).toBeNull();

    await cargarDireccion(token);
    const res = await enviar(token, idquodom);

    expect(res.status).toBe(200);
    const msg = decodeURIComponent(res.body.link.replace('https://wa.me/?text=', ''));
    expect(msg).toContain('Corrientes 1234');

    const q = await db.Quodom.findByPk(idquodom);
    expect(q.iddireccion).toBeTruthy();
    expect(q.estado).toBe('ENVIADO');
  });
});

describe('faltan atributos', () => {
  it('no deja enviar una línea sin el atributo que el producto declara', async () => {
    const token = await crearUsuario('sinatributo');
    await cargarDireccion(token);
    const idquodom = await crearQuodom(token);
    await agregarLinea(token, idquodom);

    const res = await enviar(token, idquodom);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('falta_atributo');
    expect(res.body.message).toContain('LITROS');
    expect(res.body.message).toContain('Latex interior');
  });

  it('cuenta como faltante un atributo guardado en blanco', async () => {
    const token = await crearUsuario('atributoenblanco');
    await cargarDireccion(token);
    const idquodom = await crearQuodom(token);
    const idlinea = await agregarLinea(token, idquodom, { atributo1: '20 litros' });
    await db.Quodom_Lines.update({ atributo1: '   ' }, { where: { id: idlinea } });

    const res = await enviar(token, idquodom);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('falta_atributo');
  });

  it('nombra todas las líneas incompletas, no sólo la primera', async () => {
    const token = await crearUsuario('dosincompletas');
    await cargarDireccion(token);
    const idquodom = await crearQuodom(token);
    await db.Products.create({
      id: 101, nombreproducto: 'Esmalte sintético', categoria: 35, categoriaPadre: 5,
      atributo1: 'COLOR', atributo2: null
    });
    await agregarLinea(token, idquodom);
    await agregarLinea(token, idquodom, {
      idproducto: 101, nombreProducto: 'Esmalte sintético', nombreAtributo1: 'COLOR'
    });

    const res = await enviar(token, idquodom);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Latex interior');
    expect(res.body.message).toContain('Esmalte sintético');
  });

  it('envía cuando todas las líneas tienen su atributo elegido', async () => {
    const token = await crearUsuario('completo');
    await cargarDireccion(token);
    const idquodom = await crearQuodom(token);
    await agregarLinea(token, idquodom, { atributo1: '20 litros' });

    const res = await enviar(token, idquodom);

    expect(res.status).toBe(200);
    const msg = decodeURIComponent(res.body.link.replace('https://wa.me/?text=', ''));
    expect(msg).toContain('LITROS: 20 litros');
  });

  // Una línea cuyo producto no declara atributos está completa sin elegir nada.
  it('no pide atributos a un producto que no los tiene', async () => {
    const token = await crearUsuario('sinatributos');
    await cargarDireccion(token);
    const idquodom = await crearQuodom(token);
    await db.Products.create({
      id: 102, nombreproducto: 'Cinta de papel', categoria: 35, categoriaPadre: 5,
      atributo1: null, atributo2: null
    });
    await request(app).post('/quodom_lines/add')
      .set(AUTH, 'Bearer ' + token)
      .send({ idquodom, idproducto: 102, cantidad: 1, nombreProducto: 'Cinta de papel' });

    const res = await enviar(token, idquodom);

    expect(res.status).toBe(200);
  });
});
