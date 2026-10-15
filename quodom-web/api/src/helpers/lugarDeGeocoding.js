/**
 * Un resultado de la **Geocoding API** llevado a la forma de Places API (New).
 *
 * Existe para que `direccionDeGoogle` siga siendo el único lugar donde viven
 * las reglas de mapeo: la preferencia de `sublocality` sobre `locality` (que en
 * CABA es la diferencia entre el barrio y "Buenos Aires"), la tabla literal de
 * 24 provincias, y el texto en `''` y no en `null` porque esas columnas las
 * concatena el mensaje de WhatsApp. Con un segundo parser, la primera
 * corrección que entre por un camino no entra por el otro.
 *
 * Son dos productos distintos de Google y hablan distinto:
 *
 * | | Places API (New) | Geocoding API |
 * |---|---|---|
 * | componentes | `addressComponents` | `address_components` |
 * | texto | `longText` / `shortText` | `long_name` / `short_name` |
 * | punto | `location.latitude` | `geometry.location.lat` |
 * | id | `id` | `place_id` |
 * | texto armado | `formattedAddress` | `formatted_address` |
 *
 * Los `types` se llaman igual en los dos, que es lo que hace que el mapeo
 * siga sirviendo.
 */
function lugarDeGeocoding(resultado) {
  if (!resultado) return null;

  const comps = (resultado.address_components || []).map(c => ({
    types: c.types || [],
    longText: c.long_name || '',
    shortText: c.short_name || ''
  }));

  const loc = (resultado.geometry && resultado.geometry.location) || null;

  return {
    id: resultado.place_id || '',
    formattedAddress: resultado.formatted_address || '',
    addressComponents: comps,
    location: loc && typeof loc.lat === 'number' && typeof loc.lng === 'number'
      ? { latitude: loc.lat, longitude: loc.lng }
      : null
  };
}

/**
 * De los resultados que devuelve la inversa, el que sirve como direccion.
 *
 * **Un punto sin direccion no devuelve 'sin resultados'**, y eso esta medido el
 * 2026-10-15 con la API habilitada:
 *
 *   en el Rio de la Plata  -> 1 resultado, solo un plus_code ("48Q46G22+22")
 *   en campo abierto       -> 4 resultados: plus_code, partido ("Utracan"),
 *                             provincia y pais. Ninguno con calle ni localidad.
 *
 * Un Plus Code es la coordenada escrita de otra forma, que es exactamente lo
 * que esta ventana existe para NO mostrar. Y un partido o una provincia no son
 * una direccion: llenarian el formulario con la nada y el mensaje de WhatsApp
 * saldria sin domicilio.
 *
 * Asi que un resultado sirve solo si trae **calle o localidad**. Una localidad
 * sola si alcanza: es el caso del pueblo chico, y basta para confirmar donde
 * quedo el pin. Lo demas es "no hay direccion aca", que el endpoint contesta
 * con 404 y el mensaje de que mueva el pin a una calle.
 *
 * Google ordena del mas especifico al mas general, asi que entre los usables se
 * prefiere el que tiene calle.
 */
function tieneTipo(resultado, tipo) {
  return (resultado.address_components || []).some(c => (c.types || []).includes(tipo));
}

function sirveComoDireccion(resultado) {
  if (!resultado) return false;
  return tieneTipo(resultado, 'route')
    || tieneTipo(resultado, 'locality')
    || tieneTipo(resultado, 'sublocality');
}

function mejorResultado(resultados) {
  const usables = (resultados || []).filter(sirveComoDireccion);
  if (usables.length === 0) return null;
  return usables.find(r => tieneTipo(r, 'route')) || usables[0];
}

module.exports = { lugarDeGeocoding, mejorResultado, sirveComoDireccion };
