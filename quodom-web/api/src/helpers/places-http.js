const { httpError } = require('./http-error');

/**
 * Cómo contesta la API cuando Google Places falla. Vive acá, y no copiado en
 * cada ruta que usa Places, porque es UNA regla: el día que un código tenga que
 * mapear a algo que no sea 503, con el cuerpo duplicado una copia se queda sin
 * tocar y ese endpoint contesta el estado equivocado sin que nadie lo note.
 *
 * Un problema de Google es 503 y no 500: es un servicio de afuera que no está
 * disponible, no un error nuestro. El código viaja para que la app pueda
 * distinguir "falta la clave" de "Google tardó".
 *
 * Se convierte a httpError (objeto plano) en vez de ponerle .status al Error:
 * el manejador serializa con spread, y el `message` de un Error no es
 * enumerable, así que la respuesta saldría sin mensaje.
 *
 * `prefijo` es el nombre de la ruta en el log. Sin esa línea el único rastro es
 * el `ERROR LOG: [object Object]` del error-handler, que serializa objetos
 * planos: ni el código ni el mensaje quedan en el log, y quien mire producción
 * no tiene con qué empezar.
 */
function mapearPlacesError(prefijo) {
  return function mapear(e) {
    if (e && e.name === 'PlacesError') {
      console.warn(prefijo + ': places fallo. codigo=' + e.codigo + ' mensaje=' + e.message);
      return httpError(503, e.codigo || 'google_error', e.message);
    }
    return e;
  };
}

module.exports = { mapearPlacesError };
