/**
 * Cuál es la dirección de un Quodom. Vive acá y no en el controller porque la
 * comparten el WhatsApp que recibe el proveedor y el punto desde el que se
 * buscan los proveedores (`puntoDelQuodom`): si cada uno resolviera la suya, el
 * comprador elegiría un local cerca de una dirección y al proveedor le pedirían
 * entregar en otra, sin que ninguno de los dos pueda darse cuenta.
 */
const db = require('./db');
const { httpError } = require('./http-error');

// La dirección define a qué proveedores les llega el WhatsApp, así que un
// pedido sin ella no se puede cotizar. No alcanza con mirar `iddireccion`: se
// copia al crear el Quodom, y quien no tenía ninguna entonces quedaba con null
// para siempre, incluso después de cargarla. Se resuelve al enviar.
async function resolverDireccion(quodom, userId) {
    if (quodom.iddireccion) {
        const propia = await db.user_direcciones.findOne({
            where: { id: quodom.iddireccion, userid: userId }
        });
        if (propia) return quodom.iddireccion;
    }

    const direccion = await getDireccionDefault(userId)
        || await db.user_direcciones.findOne({ where: { userid: userId } });
    if (!direccion) {
        throw httpError(409, 'falta_direccion',
            'Cargá una dirección antes de enviar: define a qué proveedores les llega el pedido.');
    }

    quodom.iddireccion = direccion.id;
    await quodom.save();
    return direccion.id;
}

async function getDireccionDefault(userId) {
    return await db.user_direcciones.findOne({
        where: { userid: userId, default: true },
        attributes: { exclude: ['createdAt', 'updatedAt'] }
    });
}

module.exports = { resolverDireccion, getDireccionDefault };
