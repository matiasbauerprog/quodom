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

// Un Quodom recién armado y con una línea, que ningún test anterior tocó. Hace
// falta uno propio para afirmar que un envío rechazado NO movió el estado: el
// `idquodom` compartido ya está en ENVIADO después del primer test, y contra ése
// la afirmación pasaría sola. La línea tampoco es decorado: sin ella el endpoint
// cortaría antes por "no tiene productos" y el test pasaría por otro motivo.
async function quodomNuevoConLinea() {
  const q = await request(app).post('/quodom/create').set('Authorization', 'Bearer ' + token)
    .send({ descripcion: 'Obra nueva', idrubro: 5 });
  const [producto] = await db.Products.findAll({ limit: 1 });
  await db.Quodom_Lines.create({
    idquodom: q.body.idquodom, idproducto: producto.id,
    nombreProducto: producto.nombreproducto, cantidad: 1
  });
  return q.body.idquodom;
}

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
  it('contactar dos veces al mismo proveedor refresca la marca y no duplica la fila', async () => {
    // La fila de partida la pone este test (`findOrCreate`, no `update`): si
    // dependiera de la que dejó el test anterior, correr este solo con `-t` la
    // encontraría vacía y pasaría sin comprobar nada. La marca se atrasa a mano
    // porque dos requests seguidos pueden caer en el mismo milisegundo, y
    // entonces "avanzó" no sería comprobable. Fecha relativa, nunca absoluta.
    const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000);
    const [previa] = await db.quodom_proveedores.findOrCreate({
      where: { idquodom, placeid: 'ChIJ-lebleu' },
      defaults: { idquodom, placeid: 'ChIJ-lebleu' }
    });
    previa.contactado_en = haceUnaHora;
    await previa.save();

    const res = await auth(request(app)
      .get('/quodom/whatsapp/' + idquodom + '?proveedor=ChIJ-lebleu&tel=%2B541166687854'));

    // Sin esto el test pasa igual si un día se rechaza re-contactar un Quodom
    // ya enviado: la fila seguiría siendo una y el count no se enteraría.
    expect(res.status).toBe(200);
    expect(res.body.link).toContain('wa.me/541166687854');

    const filas = await db.quodom_proveedores.count({ where: { idquodom, placeid: 'ChIJ-lebleu' } });
    expect(filas).toBe(1);

    const fila = await db.quodom_proveedores.findOne({ where: { idquodom, placeid: 'ChIJ-lebleu' } });
    expect(fila.contactado_en.getTime()).toBeGreaterThan(haceUnaHora.getTime());
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

  // Lo que de verdad protege al comprador de un teléfono que no sirve: el
  // Quodom tiene que seguir en CREADO. Si el número se revisara después de la
  // transición, el 400 llegaría con el pedido ya en ENVIADO y con una
  // notificación de "Quodom enviado" por un mensaje que nadie recibió, y el
  // comprador no podría volver a mandarlo.
  it('un teléfono rechazado deja el Quodom en CREADO y sin notificación', async () => {
    const otro = await quodomNuevoConLinea();

    const res = await auth(request(app)
      .get('/quodom/whatsapp/' + otro + '?proveedor=ChIJ-rex&tel=0800-777-7739'));
    expect(res.status).toBe(400);

    const q = await db.Quodom.findByPk(otro);
    expect(q.estado).toBe('CREADO');
    expect(q.fechaenvio).toBeNull();
    expect(await db.oper_notificaciones.count({ where: { idquodom: otro } })).toBe(0);
  });

  // Medio par es siempre un bug del cliente, y es alcanzable de verdad: un
  // proveedor puede venir con `telefono: null` (un 0800, o un local sin
  // teléfono), y un front que siempre agrega el parámetro manda `tel=`. Tratarlo
  // como "sin proveedor" devolvía 200 con el chat vacío de WhatsApp, el Quodom
  // ya en ENVIADO y el popup mostrando al proveedor como nunca contactado.
  it('el proveedor con el teléfono vacío se rechaza y no mueve el estado', async () => {
    const otro = await quodomNuevoConLinea();

    const res = await auth(request(app)
      .get('/quodom/whatsapp/' + otro + '?proveedor=ChIJ-rex&tel='));
    expect(res.status).toBe(400);

    const q = await db.Quodom.findByPk(otro);
    expect(q.estado).toBe('CREADO');
  });

  it('el teléfono sin el proveedor también se rechaza', async () => {
    const otro = await quodomNuevoConLinea();

    const res = await auth(request(app)
      .get('/quodom/whatsapp/' + otro + '?tel=%2B541166687854'));
    expect(res.status).toBe(400);

    const q = await db.Quodom.findByPk(otro);
    expect(q.estado).toBe('CREADO');
  });
});

// El estado del que sale un reporte legítimo: el lugar se le OFRECIÓ al
// comprador (`orden`, que lo pone `anotarOfrecidos` al mostrar la lista) y el
// comprador le MANDÓ (`contactado_en`). Se arma a mano porque el camino real
// —abrir el selector— consulta a Google, y en este archivo no hay mock de
// `places` a propósito.
async function ofrecidoYContactado(placeid) {
  const [fila] = await db.quodom_proveedores.findOrCreate({
    where: { idquodom, placeid }, defaults: { idquodom, placeid }
  });
  fila.orden = 1;
  fila.contactado_en = new Date();
  await fila.save();
  return fila;
}

describe('POST /quodom/proveedores/:id/no-enviado', () => {
  it('desmarca el contactado', async () => {
    const res = await auth(request(app).post('/quodom/proveedores/' + idquodom + '/no-enviado')
      .send({ placeid: 'ChIJ-lebleu' }));

    expect(res.status).toBe(200);
    const fila = await db.quodom_proveedores.findOne({ where: { idquodom, placeid: 'ChIJ-lebleu' } });
    expect(fila.contactado_en).toBeNull();
  });

  // El aprendizaje: lo que hace que la lista de una zona mejore con el uso.
  // La cuenta va con `toBe` y no con `toBeGreaterThanOrEqual`: con el `>=`, un
  // incremento que nunca corre pasa igual, que es justo el bug que podría
  // esconderse acá.
  it('con motivo sin_whatsapp lo anota contra el lugar, para todos', async () => {
    await db.lugares_sinwhatsapp.destroy({ where: {} });
    await ofrecidoYContactado('ChIJ-lebleu');

    await auth(request(app).post('/quodom/proveedores/' + idquodom + '/no-enviado')
      .send({ placeid: 'ChIJ-lebleu', motivo: 'sin_whatsapp' }));

    const anotado = await db.lugares_sinwhatsapp.findByPk('ChIJ-lebleu');
    expect(anotado.reportes).toBe(1);
  });

  it('dos reportes del mismo lugar suman, no fallan', async () => {
    await db.lugares_sinwhatsapp.destroy({ where: {} });

    for (let i = 0; i < 2; i++) {
      await ofrecidoYContactado('ChIJ-lebleu');
      await auth(request(app).post('/quodom/proveedores/' + idquodom + '/no-enviado')
        .send({ placeid: 'ChIJ-lebleu', motivo: 'sin_whatsapp' }));
    }

    const anotado = await db.lugares_sinwhatsapp.findByPk('ChIJ-lebleu');
    expect(anotado.reportes).toBe(2);
  });

  // `lugares_sinwhatsapp` es global, permanente, compartido por todos los
  // compradores del país y no hay forma de deshacerlo: un comercio marcado
  // arrastra "Otro usuario reportó que no tiene WhatsApp" para siempre. Lo
  // único que puede escribirlo es "toqué el botón recién y WhatsApp no abrió",
  // y eso quiere decir que el lugar fue ofrecido Y contactado. Sin esta guarda
  // alcanza con crear un Quodom y mandar el POST en bucle sobre placeids
  // sacados de Maps: el endpoint no consulta a Google, así que tampoco tiene
  // cupo que lo frene.
  it('un lugar que nunca se ofreció no se puede reportar', async () => {
    await db.lugares_sinwhatsapp.destroy({ where: {} });

    const res = await auth(request(app).post('/quodom/proveedores/' + idquodom + '/no-enviado')
      .send({ placeid: 'ChIJ-jamas-ofrecido', motivo: 'sin_whatsapp' }));

    expect(res.status).toBe(200);
    expect(await db.lugares_sinwhatsapp.findByPk('ChIJ-jamas-ofrecido')).toBeNull();
  });

  // El otro vector, y sin mala intención: `whatsappLink` crea la fila para
  // cualquier `proveedor=` con un celular válido, así que después hay fila que
  // encontrar. Una fila sin `orden` y sin contacto no es "lo vi y no me abrió".
  it('una fila sin contacto ni orden tampoco alcanza para reportar', async () => {
    await db.lugares_sinwhatsapp.destroy({ where: {} });
    await db.quodom_proveedores.create({ idquodom, placeid: 'ChIJ-colado' });

    await auth(request(app).post('/quodom/proveedores/' + idquodom + '/no-enviado')
      .send({ placeid: 'ChIJ-colado', motivo: 'sin_whatsapp' }));

    expect(await db.lugares_sinwhatsapp.findByPk('ChIJ-colado')).toBeNull();
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
