// quodom-web/api/src/helpers/telefonoWhatsapp.js
/**
 * El teléfono que devuelve Google, llevado al formato que abre WhatsApp.
 *
 * Un celular argentino va con el **9** después del 54 y **sin el 15**. Si se le
 * pasa a `wa.me` como viene, no abre el chat **aunque el comercio sí tenga
 * WhatsApp**: el feature falla por cómo escribimos el número, no por el comercio.
 *
 * Se usa libphonenumber y no reglas propias porque Argentina tiene más de 300
 * códigos de área de 2 a 4 dígitos, y hay que saber dónde termina el área para
 * saber si el `15` que sigue es parte del número o la marca de celular.
 *
 * **No se afirma si el número es fijo o celular, porque no se puede saber.**
 * Medido el 2026-10-15 sobre los 21 teléfonos que Google devolvió en Villa
 * Ballester: libphonenumber clasifica `FIXED_LINE` a todos los que vienen sin
 * el `15`, y los 21 son `MOBILE` válidos si se les agrega — incluidos los
 * prefijos 4767 y 4720, que parecen fijo clásico. En un número argentino sin
 * el `15`, `FIXED_LINE` es el supuesto por defecto de la biblioteca y no un
 * dato. Como la mayoría de los comercios publica su celular sin el `15`, el
 * aviso "puede no tener WhatsApp" salía en 22 de 25 renglones: un aviso que no
 * se puede sostener, puesto en casi todos, se lee como "ningún proveedor
 * sirve". Lo que sí se distingue —y se sigue marcando— es el 0800.
 *
 * Se importa `libphonenumber-js/max` y no el paquete base: el base trae metadata
 * mínima y `getType()` devuelve `undefined` para todo, con lo que el 0800
 * tampoco se distinguiría de un celular (medido).
 */
const { parsePhoneNumberFromString } = require('libphonenumber-js/max');

function analizarTelefono(nacional) {
  const original = (nacional || '').trim();
  if (original === '') return null;

  const n = parsePhoneNumberFromString(original, 'AR');
  if (!n || !n.isValid()) return null;

  const tipo = n.getType();

  // Un 0800 es un número válido que NO recibe WhatsApp (medido: Rex, Córdoba,
  // 0800-777-7739, con 453 reseñas). Lo mismo cualquier número de tarifa
  // especial. Se devuelven igual, para poder mostrarlos y ofrecer "llamar",
  // pero marcados: ofrecer WhatsApp ahí es mandar al usuario a un chat que no
  // abre, y eso se lee como "el comercio no tiene WhatsApp".
  const noRecibe = ['TOLL_FREE', 'PREMIUM_RATE', 'SHARED_COST', 'VOICEMAIL'];

  return {
    e164: n.number,
    sirveWhatsapp: !noRecibe.includes(tipo),
    original
  };
}

/**
 * Un lugar crudo de Places, con su teléfono ya resuelto y su marca de reportado.
 *
 * Vive acá y no en el controlador porque lo llaman los dos: el endpoint y
 * `scripts/verificar-proveedores.js`, que es el chequeo manual de los términos
 * de búsqueda. Ese script afirma en su encabezado que "lo que se prueba es lo
 * que corre en producción", y tenía su propia copia de este mapeo: con dos
 * copias, el día que una cambie el script seguiría mostrando la lista vieja y
 * la calibración se haría contra algo que no es lo que ve el comprador.
 *
 * `telefono` es el número con el que se abre WhatsApp y `telefonoVisible` el
 * que se muestra y se llama: un 0800 es válido y no recibe WhatsApp, así que
 * viaja sin el primero y con el segundo.
 */
function candidatosConTelefono(lugares, sinWhatsapp) {
  const reportados = sinWhatsapp || new Set();
  return (lugares || []).map(c => {
    const tel = analizarTelefono(c.telefono);
    return {
      ...c,
      telefono: tel && tel.sirveWhatsapp ? tel.e164 : null,
      telefonoVisible: tel ? tel.original : null,
      sinWhatsapp: reportados.has(c.placeid)
    };
  });
}

module.exports = { analizarTelefono, candidatosConTelefono };
