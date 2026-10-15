const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');
const { sessionToken } = require('./helpers/session');

let token;

beforeAll(async () => {
  await db.ready;
  await db.provincia.create({ id: 1, provincia: 'Buenos Aires' });
  await request(app).post('/users/signup').send({
    username: 'pm', email: 'pm@test.com', nombre: 'PM', password: 'secreto123',
    codArea: '11', telefono: '55557777'
  });
  const login = await request(app).post('/users/signin').send({ username: 'pm@test.com', password: 'secreto123' });
  token = sessionToken(login);
});

function crear(body) {
  return request(app).post('/user_direcciones/create')
    .set('Authorization', 'Bearer ' + token)
    .send({ alias: 'Casa', calle: 'Ídolo', numero: '3720', localidad: 'Villa Ballester', idprovincia: 1, ...body });
}

async function leerDefault() {
  const res = await request(app).get('/user_direcciones/direcciondefault')
    .set('Authorization', 'Bearer ' + token);
  return res.body;
}

// El validador **borra todo campo que el contrato no declare**, y lo hace en
// silencio: sin `punto_manual` en `DireccionInput`, el pin se guardaría sin la
// marca, `puntoDelQuodom` lo leería como impreciso y la pantalla seguiría
// diciendo "tu dirección no está ubicada con precisión" sobre el punto que el
// usuario acababa de poner. No hay error que mirar — por eso este test.
describe('punto_manual sobrevive el viaje de la app a la base', () => {
  it('se guarda cuando la app lo manda', async () => {
    const res = await crear({ default: true, lat: -34.5468, lng: -58.5562, punto_manual: true });
    expect(res.status).toBe(200);

    const d = await leerDefault();

    expect(d.punto_manual).toBe(true);
    expect(d.lat).toBeCloseTo(-34.5468, 4);
    // La fecha la sella el servidor, como con cualquier coordenada.
    expect(d.coords_actualizado).toBeTruthy();
  });

  it('se puede borrar, igual que las coordenadas', async () => {
    await crear({ default: true, lat: -34.5468, lng: -58.5562, punto_manual: true });
    const antes = await leerDefault();

    const res = await request(app).put('/user_direcciones/' + antes.id)
      .set('Authorization', 'Bearer ' + token)
      .send({ calle: 'Otra', numero: '1', lat: null, lng: null, punto_manual: null });
    expect(res.status).toBe(200);

    const d = await leerDefault();

    // Editó la calle a mano: el pin ya no describe esta dirección.
    expect(d.punto_manual).toBeFalsy();
    expect(d.lat).toBeNull();
    expect(d.coords_actualizado).toBeNull();
  });
});
