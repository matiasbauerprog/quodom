const encodeQuerySpaces = require('../src/middleware/encodeQuerySpaces');

function correr(url) {
  const req = { url };
  encodeQuerySpaces(req, {}, () => {});
  return req.url;
}

/**
 * MEDIDO en producción el 2026-10-15, y sólo pasa ahí.
 *
 * El sitio le habla al API por `/api/*`, que en Render es una regla de
 * reescritura (tiene que ser el mismo origen: la sesión es una cookie y Safari
 * descarta las de otro sitio). Esa reescritura **decodifica `%20` antes de
 * reenviar**, así que al API le llega un espacio literal en la URL y el
 * validador del contrato lo rechaza:
 *
 *   Bad Request: Parameter 'q' must be url encoded.
 *   Its value may not contain reserved characters.
 *
 * El cliente codifica bien; lo que rompe está en el medio. Y rompe **todo
 * parámetro de texto libre**: el autocompletado de direcciones (`q`) y la
 * búsqueda de productos del home (`b`), que con dos palabras devolvía 400 en
 * producción mientras andaba perfecto en local.
 *
 * Local no lo ve porque el proxy de Vite reenvía la URL tal cual, así que esto
 * es invisible para los tests de integración y para todo el desarrollo.
 */
describe('encodeQuerySpaces', () => {
  it('codifica un espacio literal en la query', () => {
    expect(correr('/lugares/sugerencias?q=idolo 1&sesion=abc'))
      .toBe('/lugares/sugerencias?q=idolo%201&sesion=abc');
  });

  it('codifica varios espacios, en varios parámetros', () => {
    expect(correr('/busqueda?b=latex interior blanco&otro=dos palabras'))
      .toBe('/busqueda?b=latex%20interior%20blanco&otro=dos%20palabras');
  });

  // Lo que ya viene codificado no se toca: volver a codificarlo convertiría
  // `%20` en `%2520` y el handler recibiría el texto con el porcentaje adentro.
  it('no toca lo que ya está codificado', () => {
    const url = '/lugares/sugerencias?q=idolo%201&sesion=abc';
    expect(correr(url)).toBe(url);
  });

  it('deja intacta una URL sin espacios', () => {
    expect(correr('/categorias')).toBe('/categorias');
    expect(correr('/busqueda?b=latex')).toBe('/busqueda?b=latex');
  });

  it('no toca el path, sólo la query', () => {
    // Un espacio en el path es otro problema y no el que se midió: tocarlo acá
    // sería arreglar a ciegas algo que nadie vio fallar.
    expect(correr('/una ruta?b=con espacio')).toBe('/una ruta?b=con%20espacio');
  });

  it('aguanta una URL sin query', () => {
    expect(correr('/users/current')).toBe('/users/current');
  });
});
