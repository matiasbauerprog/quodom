/**
 * Traduce un lugar de Places API (New) a los campos de `users_direcciones`.
 *
 * Separado del cliente HTTP a propósito: estas reglas de mapeo son las que hay
 * que ajustar cuando se ven direcciones reales, y pegadas al `fetch` cada
 * ajuste necesitaría simular una respuesta de Google.
 *
 * Los campos de texto se devuelven en '' y no en null porque van a columnas
 * que el mensaje de WhatsApp concatena.
 */
const { idProvinciaDesdeGoogle } = require('../config/provinciasGoogle');

function porTipo(componentes, tipo) {
  const c = (componentes || []).find(x => (x.types || []).includes(tipo));
  return c ? (c.longText || '') : '';
}

function direccionDeGoogle(lugar) {
  const comps = (lugar && lugar.addressComponents) || [];
  const loc = (lugar && lugar.location) || null;

  // En CABA `locality` es "Buenos Aires" para los 200 km2 de la ciudad entera y
  // el barrio vive en `sublocality`. El barrio es lo que le sirve al proveedor.
  //
  // Medido el 2026-10-14 con scripts/verificar-direcciones.js: fuera de CABA
  // Google no manda `sublocality` (Rosario trae `neighborhood`, que no miramos),
  // asi que esta preferencia no pisa nada afuera. Si algun dia aparece una
  // ciudad con sublocality, revisar si conviene acotarla a CABA.
  const barrio = porTipo(comps, 'sublocality') || porTipo(comps, 'sublocality_level_1');

  return {
    placeid: (lugar && lugar.id) || '',
    calle: porTipo(comps, 'route'),
    numero: porTipo(comps, 'street_number'),
    localidad: barrio || porTipo(comps, 'locality'),
    partido: porTipo(comps, 'administrative_area_level_2'),
    idprovincia: idProvinciaDesdeGoogle(porTipo(comps, 'administrative_area_level_1')),
    cp: porTipo(comps, 'postal_code'),
    lat: loc && typeof loc.latitude === 'number' ? loc.latitude : null,
    lng: loc && typeof loc.longitude === 'number' ? loc.longitude : null,
    direccion: (lugar && lugar.formattedAddress) || ''
  };
}

module.exports = { direccionDeGoogle };
