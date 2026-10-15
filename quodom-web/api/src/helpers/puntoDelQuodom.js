/**
 * Desde qué punto se buscan los proveedores.
 *
 * Dos escalones, y la pantalla tiene que poder decir cuál se usó:
 *
 * 1. La dirección fue elegida del mapa → punto exacto (`preciso: true`).
 * 2. Se cargó a mano → el centro de su localidad (`preciso: false`). Medido con
 *    un usuario real: hay calles que Google no tiene, y esas direcciones se
 *    cargan a mano. Sin este escalón el feature no existiría para ellos.
 *
 * El punto de la localidad se **guarda** en la dirección: se paga una vez por
 * dirección y no una por envío.
 *
 * `preciso` sale de que haya `placeid` —o sea, de que el usuario haya elegido la
 * dirección del mapa— y no de que haya coordenadas: una dirección cuyas
 * coordenadas vinieron de la localidad también las tiene, y decir que es precisa
 * haría que la pantalla mienta sobre desde dónde midió.
 */
const db = require('./db');
const { puntoDeLocalidad } = require('./places');

async function puntoDelQuodom(userId) {
    const dir = await db.user_direcciones.findOne({
        where: { userid: userId },
        order: [['default', 'DESC'], ['id', 'ASC']]
    });
    if (!dir) return null;

    const calle = [dir.calle, dir.numero].filter(Boolean).join(' ').trim();

    if (dir.placeid && dir.lat != null && dir.lng != null) {
        return { lat: dir.lat, lng: dir.lng, preciso: true, desde: calle || dir.localidad || '' };
    }

    if (dir.lat != null && dir.lng != null) {
        return { lat: dir.lat, lng: dir.lng, preciso: false, desde: dir.localidad || '' };
    }

    const texto = [dir.localidad, dir.provincia].filter(Boolean).join(', ');
    const p = await puntoDeLocalidad(texto);
    if (!p) return null;

    dir.lat = p.lat;
    dir.lng = p.lng;
    dir.coords_actualizado = new Date();
    await dir.save();

    return { lat: p.lat, lng: p.lng, preciso: false, desde: dir.localidad || p.nombre };
}

module.exports = { puntoDelQuodom };
