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
 * dirección y no una por envío. Con una excepción, abajo: en una dirección con
 * placeid no se guarda, porque la dejaría pareciendo exacta.
 *
 * La dirección no se elige acá: la resuelve `direccionDelQuodom`, el mismo helper
 * que usa el WhatsApp que recibe el proveedor. Así el punto y el domicilio del
 * mensaje salen de la misma fila **por construcción** y no por coincidencia: si
 * divergieran, el comprador elegiría un local cerca de una dirección mientras al
 * proveedor le piden entregar en otra, y ninguno de los dos puede notarlo.
 *
 * `preciso` sale de que haya `placeid` —o sea, de que el usuario haya elegido la
 * dirección del mapa— y no de que haya coordenadas: una dirección cuyas
 * coordenadas vinieron de la localidad también las tiene, y decir que es precisa
 * haría que la pantalla mienta sobre desde dónde midió.
 */
const db = require('./db');
const { puntoDeLocalidad } = require('./places');
const { resolverDireccion } = require('./direccionDelQuodom');

async function puntoDelQuodom(quodom, userId) {
    // Sin ninguna dirección cargada no hay punto, y acá eso es `null` y no el 409
    // `falta_direccion`: el que frena el envío es el endpoint de WhatsApp, esta
    // pantalla solamente no tiene desde dónde medir.
    const tieneAlguna = await db.user_direcciones.findOne({ where: { userid: userId } });
    if (!tieneAlguna) return null;

    const iddireccion = await resolverDireccion(quodom, userId);
    const dir = await db.user_direcciones.findByPk(iddireccion);
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

    // El punto se guarda sólo si la dirección NO tiene placeid. Guardarlo en una
    // que lo tiene la dejaría con centro de localidad Y placeid, y la llamada
    // siguiente —que deduce `preciso` del placeid— la reportaría como exacta: la
    // pantalla mostraría una distancia medida desde el pueblo diciendo que la
    // midió desde la puerta. La invariante que se protege es "una fila con
    // placeid tiene coordenadas exactas, o ninguna". Esa fila es rara (el
    // placeid está pero la caché de coordenadas no), así que el costo es una
    // consulta barata por envío: centavos contra una fila corrupta para siempre.
    if (!dir.placeid) {
        dir.lat = p.lat;
        dir.lng = p.lng;
        dir.coords_actualizado = new Date();
        await dir.save();
    }

    return { lat: p.lat, lng: p.lng, preciso: false, desde: dir.localidad || p.nombre };
}

module.exports = { puntoDelQuodom };
