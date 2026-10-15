jest.mock('../src/helpers/places');

const db = require('../src/helpers/db');
const places = require('../src/helpers/places');
const { puntoDelQuodom } = require('../src/helpers/puntoDelQuodom');

beforeAll(async () => { await db.ready; });
beforeEach(() => jest.resetAllMocks());

async function direccion(datos) {
  return db.user_direcciones.create({ userid: datos.userid, default: true, ...datos });
}

// El Quodom va como objeto mínimo: lo único que el helper le pide es
// `iddireccion` y poder guardarse, así que no hace falta una fila real con su
// serie y su rubro. Los casos que no hablan de la dirección del Quodom usan uno
// sin ella, que es como cae en la default del usuario.
function quodomSinDireccion() {
  return { iddireccion: null, save: async () => {} };
}

describe('puntoDelQuodom', () => {
  it('usa las coordenadas de la dirección cuando las tiene', async () => {
    await direccion({ userid: 'u-1', calle: 'Corrientes', numero: '1234', localidad: 'San Nicolás', lat: -34.6037, lng: -58.3816, placeid: 'p-1' });

    const p = await puntoDelQuodom(quodomSinDireccion(), 'u-1');

    expect(p.lat).toBeCloseTo(-34.6037, 4);
    expect(p.preciso).toBe(true);
    expect(p.desde).toContain('Corrientes');
    expect(places.puntoDeLocalidad).not.toHaveBeenCalled();
  });

  // Medido con un usuario real: hay calles que Google no tiene, y esas
  // direcciones se cargan a mano, sin coordenadas.
  it('cae a la localidad cuando la dirección no tiene coordenadas', async () => {
    await direccion({ userid: 'u-2', calle: 'Ídolo', numero: '3720', localidad: 'Villa Ballester', provincia: 'Buenos Aires' });
    places.puntoDeLocalidad.mockResolvedValue({ lat: -34.5492, lng: -58.5588, nombre: 'Villa Ballester' });

    const p = await puntoDelQuodom(quodomSinDireccion(), 'u-2');

    expect(p.lat).toBeCloseTo(-34.5492, 4);
    expect(p.preciso).toBe(false);
    expect(p.desde).toContain('Villa Ballester');
    expect(places.puntoDeLocalidad).toHaveBeenCalledWith('Villa Ballester, Buenos Aires');
  });

  // Se paga una vez por dirección, no una por envío.
  it('guarda el punto de la localidad en la dirección', async () => {
    const d = await direccion({ userid: 'u-3', calle: 'X', numero: '1', localidad: 'Tandil', provincia: 'Buenos Aires' });
    places.puntoDeLocalidad.mockResolvedValue({ lat: -37.3338, lng: -59.1406, nombre: 'Tandil' });

    await puntoDelQuodom(quodomSinDireccion(), 'u-3');

    const guardada = await db.user_direcciones.findByPk(d.id);
    expect(guardada.lat).toBeCloseTo(-37.3338, 3);
    expect(guardada.coords_actualizado).toBeInstanceOf(Date);
  });

  it('la segunda vez ya no le pregunta a Google', async () => {
    await direccion({ userid: 'u-4', calle: 'X', numero: '1', localidad: 'Rosario', provincia: 'Santa Fe' });
    places.puntoDeLocalidad.mockResolvedValue({ lat: -32.94, lng: -60.63, nombre: 'Rosario' });

    await puntoDelQuodom(quodomSinDireccion(), 'u-4');
    await puntoDelQuodom(quodomSinDireccion(), 'u-4');

    expect(places.puntoDeLocalidad).toHaveBeenCalledTimes(1);
  });

  it('devuelve null cuando ni la localidad resuelve', async () => {
    await direccion({ userid: 'u-5', calle: 'X', numero: '1', localidad: 'Qwertyuiop' });
    places.puntoDeLocalidad.mockResolvedValue(null);

    expect(await puntoDelQuodom(quodomSinDireccion(), 'u-5')).toBeNull();
  });

  it('devuelve null cuando el usuario no tiene ninguna dirección', async () => {
    expect(await puntoDelQuodom(quodomSinDireccion(), 'u-sin-direccion')).toBeNull();
  });

  // Un punto marcado como preciso que en realidad salió de la localidad haría
  // que la pantalla mienta sobre desde dónde mide. El flag no se deduce de que
  // haya coordenadas: se deduce de que haya placeid.
  it('una dirección con punto de localidad guardado sigue siendo imprecisa', async () => {
    await direccion({ userid: 'u-6', calle: 'X', numero: '1', localidad: 'Tandil', lat: -37.33, lng: -59.14, placeid: null });

    const p = await puntoDelQuodom(quodomSinDireccion(), 'u-6');
    expect(p.preciso).toBe(false);
  });

  // Guardar el punto de la localidad en una fila que ya tiene placeid la deja
  // con centro de pueblo Y placeid: la llamada siguiente la reporta como
  // exacta, que es justo la mentira que la pantalla no puede mostrar.
  it('no guarda el punto de la localidad en una direccion con placeid', async () => {
    const d = await direccion({ userid: 'u-7', calle: 'Idolo', numero: '3720', localidad: 'Villa Ballester', provincia: 'Buenos Aires', placeid: 'p-7' });
    places.puntoDeLocalidad.mockResolvedValue({ lat: -34.5492, lng: -58.5588, nombre: 'Villa Ballester' });

    const p1 = await puntoDelQuodom(quodomSinDireccion(), 'u-7');
    const guardada = await db.user_direcciones.findByPk(d.id);
    const p2 = await puntoDelQuodom(quodomSinDireccion(), 'u-7');

    expect(p1.preciso).toBe(false);
    expect(guardada.lat).toBeNull();
    expect(p2.preciso).toBe(false);
    expect(p2.lat).toBeCloseTo(-34.5492, 4);
  });

  // Los 30 días están declarados en la spec, en el modelo y en `claude.md`:
  // `coords_actualizado` se escribía en cuatro lugares y no se leía en ninguno,
  // así que las coordenadas que vienen de Google se conservaban para siempre.
  // Es una afirmación sobre sus términos, no una preferencia. De paso arregla
  // "una dirección cuyo punto cambió conserva el viejo".
  it('unas coordenadas de localidad de más de 30 días se resuelven de nuevo', async () => {
    const hace31Dias = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const d = await direccion({
      userid: 'u-10', calle: 'X', numero: '1', localidad: 'Tandil', provincia: 'Buenos Aires',
      lat: -1, lng: -1, coords_actualizado: hace31Dias
    });
    places.puntoDeLocalidad.mockResolvedValue({ lat: -37.3338, lng: -59.1406, nombre: 'Tandil' });

    const p = await puntoDelQuodom(quodomSinDireccion(), 'u-10');

    expect(places.puntoDeLocalidad).toHaveBeenCalled();
    expect(p.lat).toBeCloseTo(-37.3338, 3);
    const guardada = await db.user_direcciones.findByPk(d.id);
    expect(guardada.lat).toBeCloseTo(-37.3338, 3);
    expect(guardada.coords_actualizado.getTime()).toBeGreaterThan(hace31Dias.getTime());
  });

  // Una dirección elegida del mapa no puede caer al centro de la localidad
  // cuando su caché vence: sería precisa y la pantalla diría que no, y encima
  // la invariante "con placeid, coordenadas exactas o ninguna" impide guardar
  // ese punto, así que cada envío pagaría una consulta. El place_id sí es
  // permanente: se vuelve a pedir el punto exacto con él.
  it('una dirección del mapa con la caché vencida se vuelve a pedir por su placeid', async () => {
    const hace31Dias = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const d = await direccion({
      userid: 'u-11', calle: 'Corrientes', numero: '1234', localidad: 'San Nicolás',
      placeid: 'p-11', lat: -34.60, lng: -58.38, coords_actualizado: hace31Dias
    });
    places.detalleDireccion.mockResolvedValue({ id: 'p-11', location: { latitude: -34.61, longitude: -58.39 } });

    const p = await puntoDelQuodom(quodomSinDireccion(), 'u-11');

    expect(places.detalleDireccion).toHaveBeenCalledWith({ placeid: 'p-11' });
    expect(places.puntoDeLocalidad).not.toHaveBeenCalled();
    expect(p.preciso).toBe(true);
    expect(p.lat).toBeCloseTo(-34.61, 4);
    const guardada = await db.user_direcciones.findByPk(d.id);
    expect(guardada.lat).toBeCloseTo(-34.61, 4);
    expect(guardada.coords_actualizado.getTime()).toBeGreaterThan(hace31Dias.getTime());
  });

  // Una fila con coordenadas y **sin fecha** es de antes de que la columna
  // existiera: no hay nada que pruebe que venció, y tratarla como vencida
  // pagaría una consulta por cada dirección vieja. Hoy el servidor sella la
  // fecha en cada escritura, así que el caso no se vuelve a crear.
  it('unas coordenadas sin fecha se usan como están', async () => {
    await direccion({
      userid: 'u-12', calle: 'X', numero: '1', localidad: 'Tandil',
      lat: -37.33, lng: -59.14, coords_actualizado: null
    });

    const p = await puntoDelQuodom(quodomSinDireccion(), 'u-12');

    expect(p.lat).toBeCloseTo(-37.33, 2);
    expect(places.puntoDeLocalidad).not.toHaveBeenCalled();
    expect(places.detalleDireccion).not.toHaveBeenCalled();
  });

  // Un try/catch que devolviera null acá convertiría una caída de Google en
  // "no pudimos ubicar tu dirección", y el usuario iría a corregir un dato que
  // está bien. El error sube: lo traduce quien atiende el pedido, no este helper.
  // El error se arma a mano porque `places` está automockeado y su PlacesError
  // también: una instancia del mock no es un Error de verdad.
  it('propaga el error cuando Google se cae', async () => {
    await direccion({ userid: 'u-8', calle: 'X', numero: '1', localidad: 'Tandil', provincia: 'Buenos Aires' });
    const falla = new Error('Places respondió 503');
    falla.name = 'PlacesError';
    falla.codigo = 'upstream';
    places.puntoDeLocalidad.mockRejectedValue(falla);

    await expect(puntoDelQuodom(quodomSinDireccion(), 'u-8')).rejects.toThrow('Places respondió 503');
  });

  // El punto y la dirección que recibe el proveedor tienen que salir de la MISMA
  // fila. Divergen en un camino que existe hoy: "Repetí un pedido" copia el
  // `iddireccion` del original, así que el Quodom nuevo apunta a la dirección de
  // entonces y no a la default de ahora.
  it('toma la dirección del Quodom y no la default del usuario', async () => {
    const vieja = await direccion({ userid: 'u-9', default: false, calle: 'Rivadavia', numero: '100', localidad: 'Tandil', placeid: 'p-vieja', lat: -37.33, lng: -59.14 });
    await direccion({ userid: 'u-9', default: true, calle: 'Corrientes', numero: '1234', localidad: 'San Nicolás', placeid: 'p-nueva', lat: -34.60, lng: -58.38 });

    const delQuodom = await puntoDelQuodom({ iddireccion: vieja.id, save: async () => {} }, 'u-9');

    expect(delQuodom.desde).toContain('Rivadavia');
    expect(delQuodom.lat).toBeCloseTo(-37.33, 2);

    // Sin `iddireccion` manda la default, que acá no es la primera por id.
    const sinDireccion = await puntoDelQuodom({ iddireccion: null, save: async () => {} }, 'u-9');

    expect(sinDireccion.desde).toContain('Corrientes');
    expect(places.puntoDeLocalidad).not.toHaveBeenCalled();
  });
});

// Un punto que el usuario marco a mano en el mapa ES preciso, y no tiene
// placeid: lo eligio el, no se eligio de una lista de Google.
//
// `preciso` se deducia SOLO del placeid, y esa regla existe por una razon real
// —una direccion con el centro de su localidad tambien tiene coordenadas, asi
// que deducirlo de "tiene lat/lng" hacia que la pantalla dijera que midio desde
// la puerta algo que midio desde el centro del pueblo—. Pero con el mapa
// arrastrable aparece un tercer caso que la regla vieja clasificaba al reves:
// el usuario pone el pin en su casa, la pantalla le sigue diciendo "tu
// direccion no esta ubicada con precision". Mentir al reves es mentir igual.
describe('puntoDelQuodom: el punto marcado a mano', () => {
  it('es preciso aunque no tenga placeid', async () => {
    await direccion({
      userid: 'u-pm', calle: 'Idolo', numero: '3720', localidad: 'Villa Ballester',
      lat: -34.5468, lng: -58.5562, placeid: null, punto_manual: true
    });
    const r = await puntoDelQuodom(quodomSinDireccion(), 'u-pm');

    expect(r.preciso).toBe(true);
    expect(r.lat).toBeCloseTo(-34.5468, 4);
    expect(r.desde).toBe('Idolo 3720');
    // No se consulta a Google: el punto ya esta y es el que el usuario eligio.
    expect(places.puntoDeLocalidad).not.toHaveBeenCalled();
  });

  // La razon por la que va primero y no vence. Quien arrastro el pin lo hizo
  // porque Google lo habia ubicado mal; si el punto cayera en la cache de 30
  // dias, al dia 31 se volveria a resolver por el placeid y le pisariamos
  // exactamente la correccion que vino a hacer, en silencio.
  it('a los 31 dias sigue siendo el punto del usuario, sin reconsultar a Google', async () => {
    const hace31Dias = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await direccion({
      userid: 'u-pm3', calle: 'Idolo', numero: '3720', localidad: 'Villa Ballester',
      lat: -34.5468, lng: -58.5562, placeid: 'p-mal-ubicado', punto_manual: true,
      coords_actualizado: hace31Dias
    });

    const r = await puntoDelQuodom(quodomSinDireccion(), 'u-pm3');

    expect(r.preciso).toBe(true);
    expect(r.lat).toBeCloseTo(-34.5468, 4);
    expect(places.detalleDireccion).not.toHaveBeenCalled();
    expect(places.puntoDeLocalidad).not.toHaveBeenCalled();
  });

  // Sin la marca, las mismas coordenadas siguen siendo imprecisas: es el caso
  // de la direccion que tomo el centro de su localidad.
  it('sin la marca, las mismas coordenadas no son precisas', async () => {
    await direccion({
      userid: 'u-pm2', calle: 'Idolo', numero: '3720', localidad: 'Villa Ballester',
      lat: -34.5468, lng: -58.5562, placeid: null
    });
    const r = await puntoDelQuodom(quodomSinDireccion(), 'u-pm2');

    expect(r.preciso).toBe(false);
  });
});
