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
  return d;
}
