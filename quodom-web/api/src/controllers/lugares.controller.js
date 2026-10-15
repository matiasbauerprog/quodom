const places = require('../helpers/places');
const { direccionDeGoogle } = require('../helpers/direccionDeGoogle');
const { lugarDeGeocoding, mejorResultado } = require('../helpers/lugarDeGeocoding');
const { httpError } = require('../helpers/http-error');

module.exports = { sugerencias, direccion, puntoADireccion };

async function sugerencias(q, sesion) {
  return { sugerencias: await places.sugerencias({ q, sesion }) };
}

/**
 * Qué dirección hay en un punto del mapa, para el pin arrastrable.
 *
 * **`lat`/`lng` vuelven tal como se pidieron, no como Google los emparejó.** El
 * punto que vale es el que marcó el usuario; la dirección es la confirmación de
 * que marcó donde quería. Devolver el punto de Google le correría el pin unos
 * metros sin avisarle, y en una esquina eso es la casa de al lado.
 *
 * Tampoco se devuelve el `placeid` de la inversa como si fuera el de la
 * dirección: es el de la dirección **más cercana** que Google conoce, que no es
 * el punto elegido. Guardarlo haría que `puntoDelQuodom` tuviera dos fuentes
 * para un mismo punto.
 */
async function puntoADireccion(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);

  if (!Number.isFinite(la) || !Number.isFinite(ln) || la < -90 || la > 90 || ln < -180 || ln > 180) {
    throw httpError(400, 'punto_invalido', 'El punto del mapa no es válido.');
  }

  const resultados = await places.direccionDePunto({ lat: la, lng: ln });
  const mejor = mejorResultado(resultados);

  // Google no conoce nada ahí: el usuario movió el pin al mar o al campo. Es un
  // caso suyo y no una falla nuestra, así que el mensaje le dice qué hacer.
  if (!mejor) {
    throw httpError(404, 'punto_sin_direccion', 'No hay ninguna dirección en ese punto. Mové el pin a una calle.');
  }

  const d = direccionDeGoogle(lugarDeGeocoding(mejor));

  if (d.idprovincia === null) {
    console.warn('lugares: provincia sin matchear en la inversa. direccion=' + d.direccion);
  }

  return { ...d, placeid: '', lat: la, lng: ln };
}

async function direccion(placeid, sesion) {
  const lugar = await places.detalleDireccion({ placeid, sesion });
  const d = direccionDeGoogle(lugar);

  // Sin coordenadas la dirección no sirve para lo único que agregan los datos
  // del mapa: buscar proveedores alrededor. Guardarla igual la haría ver
  // cargada y mentir después, cuando ya nadie mire este paso.
  if (d.lat === null || d.lng === null) {
    throw httpError(422, 'lugar_sin_coordenadas', 'El lugar elegido no tiene coordenadas.');
  }

  // La provincia que no matchea es la falla silenciosa de este camino: la
  // dirección se guarda igual, sin `idprovincia`, y nadie se entera. Si un día
  // deja de matchear —Google renombra una provincia, el seed se renumera— esto
  // es lo único que queda para diagnosticarlo. La spec lo pide explícitamente.
  if (d.idprovincia === null) {
    console.warn('lugares: provincia sin matchear. placeid=' + d.placeid + ' direccion=' + d.direccion);
  }

  return d;
}
