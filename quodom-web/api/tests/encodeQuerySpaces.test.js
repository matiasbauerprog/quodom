const request = require('supertest');
const app = require('../src/server');
const encodeQuerySpaces = require('../src/middleware/encodeQuerySpaces');

function correr(url, originalUrl) {
  const req = { url, originalUrl: originalUrl === undefined ? url : originalUrl };
  encodeQuerySpaces(req, {}, () => {});
  return req;
}

/**
 * MEDIDO en producción el 2026-10-15, y sólo pasa ahí.
 *
 * El sitio le habla al API por `/api/*`, que en Render es una regla de
 * reescritura (tiene que ser el mismo origen: la sesión es una cookie y Safari
 * descarta las de otro sitio). Esa reescritura **reescribe el `%20` de la query
 * como `+`**, y el validador del contrato lo rechaza:
 *
 *   Bad Request: Parameter 'q' must be url encoded.
 *   Its value may not contain reserved characters.
 *
 * El `+` está en su lista de reservados; el espacio no. Comprobado mandando las
 * tres formas directo al API desplegado:
 *
 *   q=idolo%201  -> 401 (pasa el validador)
 *   q=idolo+1    -> 400 <-- el culpable
 *   q=idolo%2B1  -> 401 (pasa)
 *
 * Rompía todo texto libre: el autocompletado de direcciones (`q`) y la búsqueda
 * de productos del home (`b`), que con dos palabras daba 400 en producción.
 */
describe('encodeQuerySpaces', () => {
  it('convierte el + de la query en %20', () => {
    expect(correr('/lugares/sugerencias?q=idolo+1&sesion=abc').url)
      .toBe('/lugares/sugerencias?q=idolo%201&sesion=abc');
  });

  /**
   * El validador lee `url.parse(req.originalUrl).query`, **no** `req.url`. Un
   * primer intento tocó sólo `url` y no arregló nada en producción: la suite
   * pasaba y el 400 seguía igual. Este test es el que lo habría atajado.
   */
  it('toca originalUrl, que es el que mira el validador', () => {
    const req = correr('/busqueda?b=latex+interior');
    expect(req.originalUrl).toBe('/busqueda?b=latex%20interior');
  });

  it('convierte varios, en varios parámetros', () => {
    expect(correr('/busqueda?b=latex+interior+blanco&otro=dos+palabras').url)
      .toBe('/busqueda?b=latex%20interior%20blanco&otro=dos%20palabras');
  });

  // Un espacio literal tampoco debería llegar, pero si llega se normaliza igual:
  // cuesta una línea y evita depender de qué forma exacta mande el intermediario.
  it('también normaliza un espacio literal', () => {
    expect(correr('/busqueda?b=latex interior').url).toBe('/busqueda?b=latex%20interior');
  });

  /**
   * Un `+` que el cliente quiso de verdad viaja como `%2B`, y eso no se toca:
   * convertirlo sería cambiarle el texto al usuario. `encodeURIComponent('+')`
   * da `%2B`, así que el cliente de la app siempre cae de este lado.
   */
  it('no toca un + que viene codificado como %2B', () => {
    const url = '/busqueda?b=a%2Bb';
    expect(correr(url).url).toBe(url);
  });

  it('deja intacta una URL sin + ni espacios', () => {
    expect(correr('/busqueda?b=latex').url).toBe('/busqueda?b=latex');
    expect(correr('/categorias').url).toBe('/categorias');
  });

  // El `+` del path no es el caso medido y no se toca: ahí no significa espacio.
  it('no toca el path', () => {
    expect(correr('/ruta+rara?b=dos+palabras').url).toBe('/ruta+rara?b=dos%20palabras');
  });

  it('aguanta una request sin originalUrl', () => {
    const req = { url: '/busqueda?b=a+b' };
    encodeQuerySpaces(req, {}, () => {});
    expect(req.url).toBe('/busqueda?b=a%20b');
  });

  /**
   * De punta a punta, por la app real. El unitario de arriba prueba el
   * middleware; este prueba que este montado ANTES del validador y que le
   * cambie lo que el validador lee. Un 400 aca es el bug de produccion; un 401
   * es que paso el contrato y lo freno la sesion, que es lo correcto.
   */
  it('una query con + llega al handler en vez de morir en el validador', async () => {
    const res = await request(app).get('/lugares/sugerencias?q=idolo+1&sesion=abc');
    expect(res.status).toBe(401);
  });

  it('la busqueda de productos tambien, que es la que rompia en el home', async () => {
    const res = await request(app).get('/busqueda?b=latex+interior');
    expect(res.status).not.toBe(400);
  });
});
