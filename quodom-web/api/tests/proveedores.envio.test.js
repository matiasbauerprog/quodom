/**
 * Elegir un proveedor y mandarle el Quodom, y deshacerlo.
 *
 * No hay mock de `places` porque no hace falta ninguna consulta a Google: el
 * teléfono del proveedor llega como parámetro, ya resuelto por la pantalla que
 * mostró la lista.
 */
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');
const { sessionToken } = require('./helpers/session');

let token, idquodom;

beforeAll(async () => {
  await db.ready;
  await db.series.create({ codigo: 'QUODOM', utilizado: 0, sigla: 'QD-' });
  await db.provincia.create({ id: 1, provincia: 'Buenos Aires' });
  await db.Category.bulkCreate([
    { id: 5, nombrecategoria: 'Pintura', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 35, nombrecategoria: 'Latex', idcategoriapadre: 5, activa: true, orden: 1 }
  ]);
  // El rubro de la línea no se mira acá: se inserta directo, así que cualquier
  // producto sirve. Por eso tampoco se filtra por `categoriaPadre`, que miente
  // en 24 productos del catálogo real.
  await db.Products.create({
    id: 100, nombreproducto: 'Latex interior 20L', categoria: 35, categoriaPadre: 5
  });

  await request(app).post('/users/signup').send({
    username: 'envio', email: 'envio@test.com', nombre: 'En', apellido: 'Vio',
    password: 'secreto123', codArea: '11', telefono: '55557777'
  });
  const login = await request(app).post('/users/signin').send({ username: 'envio@test.com', password: 'secreto123' });
  token = sessionToken(login);

  await request(app).post('/user_direcciones/create').set('Authorization', 'Bearer ' + token)
    .send({ alias: 'Casa', calle: 'Brown', numero: '3185', localidad: 'Villa Ballester', idprovincia: 1, default: true });

  const q = await request(app).post('/quodom/create').set('Authorization', 'Bearer ' + token)
    .send({ descripcion: 'Obra', idrubro: 5 });
  idquodom = q.body.idquodom;

  // Una línea sin atributos declarados, para que el envío no esté bloqueado.
  const [producto] = await db.Products.findAll({ limit: 1 });
  await db.Quodom_Lines.create({
    idquodom, idproducto: producto.id, nombreProducto: producto.nombreproducto, cantidad: 1
  });
});

const auth = req => req.set('Authorization', 'Bearer ' + token);

describe('elegir un proveedor', () => {
  it('arma el link al número del proveedor y lo marca contactado', async () => {
    const res = await auth(request(app)
      .get('/quodom/whatsapp/' + idquodom + '?proveedor=ChIJ-lebleu&tel=%2B541166687854'));

    expect(res.status).toBe(200);
    expect(res.body.link).toContain('wa.me/541166687854');
    expect(res.body.link).toContain('text=');

    const fila = await db.quodom_proveedores.findOne({ where: { idquodom, placeid: 'ChIJ-lebleu' } });
    expect(fila.contactado_en).toBeInstanceOf(Date);
  });

  it('el Quodom queda ENVIADO con el primero', async () => {
    const q = await db.Quodom.findByPk(idquodom);
    expect(q.estado).toBe('ENVIADO');
  });

  // La tabla no tiene unique sobre (idquodom, placeid): si el segundo contacto
  // creara otra fila, el popup mostraría el mismo proveedor dos veces.
  it('contactar dos veces al mismo proveedor no duplica la fila', async () => {
    await auth(request(app)
      .get('/quodom/whatsapp/' + idquodom + '?proveedor=ChIJ-lebleu&tel=%2B541166687854'));

    const filas = await db.quodom_proveedores.count({ where: { idquodom, placeid: 'ChIJ-lebleu' } });
    expect(filas).toBe(1);
  });

  // El camino de hoy sigue vivo: es la salida cuando no hay proveedores, cuando
  // Google falla, y para mandarle a un proveedor propio que no está en la lista.
  it('sin el parámetro proveedor devuelve el link sin destinatario, como siempre', async () => {
    const res = await auth(request(app).get('/quodom/whatsapp/' + idquodom));
    expect(res.status).toBe(200);
    expect(res.body.link).toContain('wa.me/?text=');
  });

  it('un teléfono que no es un número válido se rechaza', async () => {
    const res = await auth(request(app)
      .get('/quodom/whatsapp/' + idquodom + '?proveedor=ChIJ-x&tel=hola'));
    expect(res.status).toBe(400);
  });

  // Un 0800 es válido y NO recibe WhatsApp (medido: Rex, Córdoba, 453 reseñas).
  // Armar el link igual manda al comprador a un chat que no abre, y eso se lee
  // como "el comercio no tiene WhatsApp". La app ya esconde el botón; esto es
  // la red del servidor.
  it('un 0800 se rechaza aunque sea un número válido', async () => {
    const res = await auth(request(app)
      .get('/quodom/whatsapp/' + idquodom + '?proveedor=ChIJ-rex&tel=0800-777-7739'));
    expect(res.status).toBe(400);

    const fila = await db.quodom_proveedores.findOne({ where: { idquodom, placeid: 'ChIJ-rex' } });
    expect(fila).toBeNull();
  });
});

describe('POST /quodom/proveedores/:id/no-enviado', () => {
  it('desmarca el contactado', async () => {
    const res = await auth(request(app).post('/quodom/proveedores/' + idquodom + '/no-enviado')
      .send({ placeid: 'ChIJ-lebleu' }));

    expect(res.status).toBe(200);
    const fila = await db.quodom_proveedores.findOne({ where: { idquodom, placeid: 'ChIJ-lebleu' } });
    expect(fila.contactado_en).toBeNull();
  });

  // El aprendizaje: lo que hace que la lista de una zona mejore con el uso.
  it('con motivo sin_whatsapp lo anota contra el lugar, para todos', async () => {
    await auth(request(app).post('/quodom/proveedores/' + idquodom + '/no-enviado')
      .send({ placeid: 'ChIJ-lebleu', motivo: 'sin_whatsapp' }));

    const anotado = await db.lugares_sinwhatsapp.findByPk('ChIJ-lebleu');
    expect(anotado.reportes).toBeGreaterThanOrEqual(1);
  });

  it('dos reportes del mismo lugar suman, no fallan', async () => {
    await auth(request(app).post('/quodom/proveedores/' + idquodom + '/no-enviado')
      .send({ placeid: 'ChIJ-lebleu', motivo: 'sin_whatsapp' }));

    const anotado = await db.lugares_sinwhatsapp.findByPk('ChIJ-lebleu');
    expect(anotado.reportes).toBeGreaterThanOrEqual(2);
  });

  it('el Quodom de otro usuario no se puede desmarcar', async () => {
    await request(app).post('/users/signup').send({
      email: 'otro@test.com', nombre: 'Otro', password: 'secreto123', telefono: '44443333'
    });
    const login = await request(app).post('/users/signin').send({ username: 'otro@test.com', password: 'secreto123' });

    const res = await request(app).post('/quodom/proveedores/' + idquodom + '/no-enviado')
      .set('Authorization', 'Bearer ' + sessionToken(login))
      .send({ placeid: 'ChIJ-lebleu' });
    expect(res.status).toBe(400);
  });
});
