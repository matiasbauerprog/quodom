/**
 * Vuelve a codificar los espacios literales de la query.
 *
 * MEDIDO en producción el 2026-10-15, y **sólo pasa ahí**. El sitio le habla al
 * API por `/api/*`, que en Render es una regla de reescritura — y tiene que
 * serlo, porque la sesión es una cookie y Safari descarta las de otro sitio.
 * Esa reescritura **decodifica `%20` antes de reenviar**, así que al API le
 * llega un espacio literal en la URL y el validador del contrato la rechaza:
 *
 *   Bad Request: Parameter 'q' must be url encoded.
 *   Its value may not contain reserved characters.
 *
 * El cliente codifica bien; lo que rompe está en el medio, y el síntoma es un
 * 400 que culpa al parámetro. Rompía **todo texto libre**: el autocompletado de
 * direcciones (`q`) y la búsqueda de productos del home (`b`), que en
 * producción devolvía 400 con dos palabras y andaba perfecto en local.
 *
 * En local el proxy de Vite reenvía la URL tal cual, así que esto es invisible
 * para el desarrollo y para los tests de integración, que entran por `app`
 * directamente. Por eso el arreglo vive acá, delante del validador y junto a
 * `stripTrailingSlash`, que existe por la misma clase de motivo: normalizar lo
 * que llega antes de que el contrato lo juzgue.
 *
 * Sólo el espacio, y sólo en la query. Lo que ya viene codificado se deja como
 * está: codificar de nuevo convertiría `%20` en `%2520` y el handler recibiría
 * el porcentaje adentro del texto.
 */
module.exports = function encodeQuerySpaces(req, res, next) {
  const i = req.url.indexOf('?');
  if (i !== -1 && req.url.indexOf(' ', i) !== -1) {
    req.url = req.url.slice(0, i) + req.url.slice(i).replace(/ /g, '%20');
  }
  next();
};
