/**
 * Devuelve a `%20` los espacios que la reescritura de Render convierte en `+`.
 *
 * MEDIDO en producción el 2026-10-15, y **sólo pasa ahí**. El sitio le habla al
 * API por `/api/*`, que en Render es una regla de reescritura — y tiene que
 * serlo, porque la sesión es una cookie y Safari descarta las de otro sitio.
 * Esa reescritura reescribe el `%20` de la query como `+`, que es la
 * codificación de formulario. Entonces el validador del contrato lo rechaza:
 *
 *   Bad Request: Parameter 'q' must be url encoded.
 *   Its value may not contain reserved characters.
 *
 * El `+` está en su lista de reservados
 * (`/[:\/?#\[\]@!$&'()*+,;=]/` en `req.parameter.mutator.js`), el espacio no.
 * Y el cliente codifica bien: lo que rompe está en el medio, y el síntoma es un
 * 400 que culpa al parámetro.
 *
 * Rompía **todo texto libre**, no sólo lo nuevo: el autocompletado de
 * direcciones (`q`) y la búsqueda de productos del home (`b`), que en
 * producción devolvía 400 con dos palabras —"latex interior"— y andaba perfecto
 * en local.
 *
 * Dos cosas que hacen falta para que el arreglo sirva, las dos medidas:
 *
 * 1. **Se toca `originalUrl` además de `url`.** El validador lee
 *    `url.parse(req.originalUrl).query`, no `req.url`, así que cambiar sólo
 *    `url` —como hace `stripTrailingSlash`, que le alcanza porque ahí lo que
 *    importa es el path— no arregla nada. Un primer intento falló por esto.
 * 2. **Se convierte `+` y no el espacio.** El espacio no está en la lista de
 *    reservados del validador; el que la dispara es el `+`.
 *
 * El significado se preserva: en una query, `+` **es** un espacio
 * (form-encoding), y `%20` también. Un `+` que el cliente quiso de verdad viaja
 * como `%2B` y no se toca.
 *
 * Local no lo ve: el proxy de Vite reenvía la URL tal cual y los tests entran
 * por `app` directamente, así que esto es invisible para todo el desarrollo —
 * por eso sobrevivió a un deploy.
 */
function recodificar(url) {
  const i = url.indexOf('?');
  if (i === -1) return url;
  const query = url.slice(i);
  if (query.indexOf('+') === -1 && query.indexOf(' ') === -1) return url;
  return url.slice(0, i) + query.replace(/\+/g, '%20').replace(/ /g, '%20');
}

module.exports = function encodeQuerySpaces(req, res, next) {
  req.url = recodificar(req.url);
  // El validador lee `originalUrl`. Sin esta línea el arreglo no hace nada.
  if (typeof req.originalUrl === 'string') req.originalUrl = recodificar(req.originalUrl);
  next();
};
