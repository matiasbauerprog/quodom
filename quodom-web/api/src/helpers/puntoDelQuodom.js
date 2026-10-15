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
 * `preciso` **nunca** sale de que haya coordenadas: una dirección cuyas
 * coordenadas vinieron de la localidad también las tiene, y decir que es precisa
 * haría que la pantalla mienta sobre desde dónde midió. Sale de dos cosas, y
 * cualquiera alcanza:
 *
 * - `punto_manual`: el usuario puso el pin en el mapa con la mano.
 * - `placeid`: eligió la dirección del autocompletado de Google.
 */
const db = require('./db');
const { puntoDeLocalidad, detalleDireccion } = require('./places');
const { resolverDireccion } = require('./direccionDelQuodom');

// Los términos de Google dejan archivar el `place_id` sin límite y las
// coordenadas hasta 30 días corridos. Esto es el LECTOR de esa caché:
// `coords_actualizado` se escribe en cuatro lugares y hasta acá no se leía en
// ninguno, así que las coordenadas se conservaban para siempre. No es una
// preferencia nuestra, es una afirmación sobre sus términos — y de paso una
// dirección cuyo punto cambió deja de arrastrar el viejo.
const DIAS_CACHE = 30;

/**
 * Una fila **sin fecha** y con coordenadas es de antes de que la columna
 * existiera: no hay nada que pruebe que venció, y tratarla como vencida pagaría
 * una consulta por cada dirección vieja. Hoy el servidor sella la fecha en cada
 * escritura (`user_direcciones.controller`), así que el caso no se vuelve a
 * crear.
 */
function coordsVencidas(dir) {
    if (!dir.coords_actualizado) return false;
    const edad = Date.now() - new Date(dir.coords_actualizado).getTime();
    return edad > DIAS_CACHE * 24 * 60 * 60 * 1000;
}

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

    const vencidas = coordsVencidas(dir);

    // El punto que el usuario puso a mano va PRIMERO y **no vence**.
    //
    // Los 30 días son una condición de los términos de Google sobre datos de
    // Google; este punto lo eligió una persona y es dato nuestro, como el
    // reporte de "no tiene WhatsApp". Si cayera en la caché, a los 30 días una
    // dirección con placeid se volvería a resolver por él y le **pisaría al
    // usuario la corrección que vino a hacer** — justo el caso de quien arrastró
    // el pin porque Google lo había ubicado mal, que es para lo que existe.
    if (dir.punto_manual && dir.lat != null && dir.lng != null) {
        return { lat: dir.lat, lng: dir.lng, preciso: true, desde: calle || dir.localidad || '' };
    }

    if (dir.placeid && dir.lat != null && dir.lng != null && !vencidas) {
        return { lat: dir.lat, lng: dir.lng, preciso: true, desde: calle || dir.localidad || '' };
    }

    // Una dirección elegida del mapa con la caché vencida se vuelve a pedir
    // **por su place_id**, que sí es permanente, y no cae al centro de la
    // localidad: sería precisa y la pantalla diría que no, y encima la
    // invariante "con placeid, coordenadas exactas o ninguna" impide guardar
    // ese punto, así que cada envío pagaría la consulta de nuevo. Un error de
    // Google sube, igual que el de la localidad: lo traduce quien atiende el
    // pedido, que además deja enviar sin elegir proveedor.
    if (dir.placeid && vencidas) {
        const lugar = await detalleDireccion({ placeid: dir.placeid });
        const loc = lugar && lugar.location;
        if (loc) {
            dir.lat = loc.latitude;
            dir.lng = loc.longitude;
            dir.coords_actualizado = new Date();
            await dir.save();
            return { lat: dir.lat, lng: dir.lng, preciso: true, desde: calle || dir.localidad || '' };
        }
        // El place_id ya no resuelve (el lugar se dio de baja): se sigue por la
        // localidad, que es el escalón de abajo.
    }

    if (dir.lat != null && dir.lng != null && !vencidas) {
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
