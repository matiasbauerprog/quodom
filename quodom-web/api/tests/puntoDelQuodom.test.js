jest.mock('../src/helpers/places');

const db = require('../src/helpers/db');
const places = require('../src/helpers/places');
const { puntoDelQuodom } = require('../src/helpers/puntoDelQuodom');

beforeAll(async () => { await db.ready; });
beforeEach(() => jest.resetAllMocks());

async function direccion(datos) {
  return db.user_direcciones.create({ userid: datos.userid, default: true, ...datos });
}

describe('puntoDelQuodom', () => {
  it('usa las coordenadas de la dirección cuando las tiene', async () => {
    await direccion({ userid: 'u-1', calle: 'Corrientes', numero: '1234', localidad: 'San Nicolás', lat: -34.6037, lng: -58.3816, placeid: 'p-1' });

    const p = await puntoDelQuodom('u-1');

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

    const p = await puntoDelQuodom('u-2');

    expect(p.lat).toBeCloseTo(-34.5492, 4);
    expect(p.preciso).toBe(false);
    expect(p.desde).toContain('Villa Ballester');
    expect(places.puntoDeLocalidad).toHaveBeenCalledWith('Villa Ballester, Buenos Aires');
  });

  // Se paga una vez por dirección, no una por envío.
  it('guarda el punto de la localidad en la dirección', async () => {
    const d = await direccion({ userid: 'u-3', calle: 'X', numero: '1', localidad: 'Tandil', provincia: 'Buenos Aires' });
    places.puntoDeLocalidad.mockResolvedValue({ lat: -37.3338, lng: -59.1406, nombre: 'Tandil' });

    await puntoDelQuodom('u-3');

    const guardada = await db.user_direcciones.findByPk(d.id);
    expect(guardada.lat).toBeCloseTo(-37.3338, 3);
    expect(guardada.coords_actualizado).toBeInstanceOf(Date);
  });

  it('la segunda vez ya no le pregunta a Google', async () => {
    await direccion({ userid: 'u-4', calle: 'X', numero: '1', localidad: 'Rosario', provincia: 'Santa Fe' });
    places.puntoDeLocalidad.mockResolvedValue({ lat: -32.94, lng: -60.63, nombre: 'Rosario' });

    await puntoDelQuodom('u-4');
    await puntoDelQuodom('u-4');

    expect(places.puntoDeLocalidad).toHaveBeenCalledTimes(1);
  });

  it('devuelve null cuando ni la localidad resuelve', async () => {
    await direccion({ userid: 'u-5', calle: 'X', numero: '1', localidad: 'Qwertyuiop' });
    places.puntoDeLocalidad.mockResolvedValue(null);

    expect(await puntoDelQuodom('u-5')).toBeNull();
  });

  it('devuelve null cuando el usuario no tiene ninguna dirección', async () => {
    expect(await puntoDelQuodom('u-sin-direccion')).toBeNull();
  });

  // Un punto marcado como preciso que en realidad salió de la localidad haría
  // que la pantalla mienta sobre desde dónde mide. El flag no se deduce de que
  // haya coordenadas: se deduce de que haya placeid.
  it('una dirección con punto de localidad guardado sigue siendo imprecisa', async () => {
    await direccion({ userid: 'u-6', calle: 'X', numero: '1', localidad: 'Tandil', lat: -37.33, lng: -59.14, placeid: null });

    const p = await puntoDelQuodom('u-6');
    expect(p.preciso).toBe(false);
  });

  // Guardar el punto de la localidad en una fila que ya tiene placeid la deja
  // con centro de pueblo Y placeid: la llamada siguiente la reporta como
  // exacta, que es justo la mentira que la pantalla no puede mostrar.
  it('no guarda el punto de la localidad en una direccion con placeid', async () => {
    const d = await direccion({ userid: 'u-7', calle: 'Idolo', numero: '3720', localidad: 'Villa Ballester', provincia: 'Buenos Aires', placeid: 'p-7' });
    places.puntoDeLocalidad.mockResolvedValue({ lat: -34.5492, lng: -58.5588, nombre: 'Villa Ballester' });

    const p1 = await puntoDelQuodom('u-7');
    const guardada = await db.user_direcciones.findByPk(d.id);
    const p2 = await puntoDelQuodom('u-7');

    expect(p1.preciso).toBe(false);
    expect(guardada.lat).toBeNull();
    expect(p2.preciso).toBe(false);
    expect(p2.lat).toBeCloseTo(-34.5492, 4);
  });
});
