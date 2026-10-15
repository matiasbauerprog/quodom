const places = require('../helpers/places');
const { direccionDeGoogle } = require('../helpers/direccionDeGoogle');
const { httpError } = require('../helpers/http-error');

module.exports = { sugerencias, direccion };

async function sugerencias(q, sesion) {
  return { sugerencias: await places.sugerencias({ q, sesion }) };
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
