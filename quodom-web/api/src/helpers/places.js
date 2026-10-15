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

// La máscara del nivel caro: puntuación, reseñas y teléfono. Los tres van en la
// MISMA consulta a propósito — Google cobra por el campo más caro de la máscara,
// así que pedir el teléfono aparte es otra consulta al mismo precio.
const CAMPOS_PROVEEDOR = [
  'places.id',
  'places.displayName',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.nationalPhoneNumber',
  'places.shortFormattedAddress'
].join(',');

// Sólo ubicación: es del nivel básico y se usa para el centro de una localidad.
const CAMPOS_PUNTO = 'places.location,places.formattedAddress';

const RADIO_METROS = 50000;
const MAX_RESULTADOS = 20;

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

/**
 * Los comercios del rubro alrededor de un punto.
 *
 * Es `searchText` y no `searchNearby` porque está medido (2026-10-15): buscar
 * por tipo de Places devuelve kioscos para Librería y `paint_store` ni siquiera
 * existe. El texto de cada rubro está en `config/rubrosPlaces.js`.
 *
 * `locationBias` es una preferencia, no un límite: pueden venir resultados
 * lejanos. No importa — la distancia la calcula `rankearProveedores` y el orden
 * final es nuestro.
 */
async function buscarProveedores({ texto, lat, lng }) {
  const key = clave();
  const data = await pedir(BASE + '/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': CAMPOS_PROVEEDOR
    },
    body: JSON.stringify({
      textQuery: texto,
      maxResultCount: MAX_RESULTADOS,
      languageCode: 'es-419',
      regionCode: 'AR',
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: RADIO_METROS } }
    })
  });

  return (data.places || []).map(p => ({
    placeid: p.id,
    nombre: (p.displayName && p.displayName.text) || '',
    lat: p.location ? p.location.latitude : null,
    lng: p.location ? p.location.longitude : null,
    rating: p.rating != null ? p.rating : null,
    resenas: p.userRatingCount || 0,
    telefono: p.nationalPhoneNumber || null,
    direccion: p.shortFormattedAddress || ''
  }));
}

/**
 * El punto de una localidad, para las direcciones cargadas a mano.
 *
 * Medido con un usuario real: hay calles que Google no tiene, y esas direcciones
 * se guardan sin coordenadas. La localidad sí resuelve siempre, y para buscar
 * los cinco comercios más cercanos el centro del pueblo alcanza.
 */
async function puntoDeLocalidad(texto) {
  const q = (texto || '').trim();
  if (q === '') return null;

  const key = clave();
  const data = await pedir(BASE + '/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': CAMPOS_PUNTO },
    body: JSON.stringify({ textQuery: q, maxResultCount: 1, languageCode: 'es-419', regionCode: 'AR' })
  });

  const p = (data.places || [])[0];
  if (!p || !p.location) return null;
  return { lat: p.location.latitude, lng: p.location.longitude, nombre: p.formattedAddress || q };
}

module.exports = { sugerencias, detalleDireccion, buscarProveedores, puntoDeLocalidad, PlacesError };
