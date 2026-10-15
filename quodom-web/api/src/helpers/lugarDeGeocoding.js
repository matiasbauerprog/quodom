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
 * De los resultados que devuelve la inversa, el que sirve.
 *
 * Google ordena del más específico al más general: primero la dirección con
 * altura y al final el país. Tomar `results[0]` a ciegas funciona casi siempre,
 * pero en un descampado el primero puede ser un código postal o una ciudad
 * entera, y eso llenaría el formulario con una localidad y ninguna calle sin
 * que nada falle. Se busca el primero que sea una dirección de calle y, si no
 * hay, se cae al primero: una localidad es mejor que nada para confirmar, y el
 * usuario igual puede corregir los campos a mano.
 */
function mejorResultado(resultados) {
  const lista = resultados || [];
  if (lista.length === 0) return null;
  const conCalle = lista.find(r => (r.types || []).includes('street_address'))
    || lista.find(r => (r.types || []).includes('premise'))
    || lista.find(r => (r.types || []).includes('route'));
  return conCalle || lista[0];
}

module.exports = { lugarDeGeocoding, mejorResultado };
