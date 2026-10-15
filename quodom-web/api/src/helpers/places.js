/**
 * El único archivo que habla con Google Places. Nadie más conoce su formato.
 *
 * Misma forma que `gemini.js`, que es el precedente de un HTTP externo y pago
 * en este repo: dueño del `fetch`, timeout propio, clave desde el entorno.
 *
 * Mitad A usa sólo los dos de direcciones. La búsqueda de proveedores (mitad B)
 * se agrega acá, con su propia máscara de campos.
 */
const BASE = 'https://places.googleapis.com/v1';
const TIMEOUT_POR_DEFECTO = 8000;
const MIN_CARACTERES = 3;

// Sólo lo que hace falta para desarmar una dirección. Pedir un campo del nivel
// caro acá (rating, teléfono, displayName) sube el precio de TODA la consulta.
const CAMPOS_DIRECCION = 'id,formattedAddress,addressComponents,location';

class PlacesError extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = 'PlacesError';
    this.codigo = codigo;
  }
}

function clave() {
  const k = process.env.GOOGLE_MAPS_API_KEY;
  if (!k) {
    throw new PlacesError('sin_clave',
      'Falta GOOGLE_MAPS_API_KEY. Cargala en el entorno (en Render va a mano en el dashboard).');
  }
  return k;
}

function timeoutMs() {
  const n = Number(process.env.PLACES_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : TIMEOUT_POR_DEFECTO;
}

async function pedir(url, opts) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      throw new PlacesError('google_error', 'places: HTTP ' + res.status + ' ' + detalle.slice(0, 200));
    }
    return await res.json();
  } catch (e) {
    if (e instanceof PlacesError) throw e;
    if (e.name === 'AbortError') throw new PlacesError('timeout', 'places: timeout');
    throw new PlacesError('google_error', 'places: ' + e.message);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sugerencias de dirección mientras el usuario tipea.
 *
 * El corte en 3 caracteres es control de gasto, no cosmética: sin él, cada
 * tecla es una consulta. El `sesion` es el token que agrupa la tanda con el
 * detalle final para que Google no cobre las sugerencias aparte.
 */
async function sugerencias({ q, sesion }) {
  const texto = (q || '').trim();
  if (texto.length < MIN_CARACTERES) return [];

  const key = clave();
  const data = await pedir(BASE + '/places:autocomplete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
    body: JSON.stringify({
      input: texto,
      sessionToken: sesion,
      includedRegionCodes: ['ar'],
      languageCode: 'es-419'
    })
  });

  return (data.suggestions || [])
    .map(s => s.placePrediction)
    .filter(Boolean)
    .map(p => ({ placeid: p.placeId, texto: (p.text && p.text.text) || '' }));
}

/** El lugar crudo. Lo traduce `direccionDeGoogle`, que es puro y testeable. */
async function detalleDireccion({ placeid, sesion }) {
  const key = clave();
  const url = BASE + '/places/' + encodeURIComponent(placeid)
    + '?languageCode=es-419'
    + (sesion ? '&sessionToken=' + encodeURIComponent(sesion) : '');

  return await pedir(url, {
    method: 'GET',
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': CAMPOS_DIRECCION }
  });
}

module.exports = { sugerencias, detalleDireccion, PlacesError };
