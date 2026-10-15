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
 * `esFijo` sirve para avisar que puede no tener WhatsApp. Es un aviso y no un
 * bloqueo: un fijo puede tener WhatsApp Business.
 *
 * Se importa `libphonenumber-js/max` y no el paquete base: el base trae metadata
 * mínima y `getType()` devuelve `undefined` para todo, con lo que ni el fijo ni
 * el 0800 se distinguirían de un celular (medido).
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
    esFijo: tipo === 'FIXED_LINE',
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
      esFijo: tel ? tel.esFijo : false,
      sinWhatsapp: reportados.has(c.placeid)
    };
  });
}

module.exports = { analizarTelefono, candidatosConTelefono };
