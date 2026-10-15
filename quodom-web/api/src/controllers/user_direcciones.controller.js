const db = require('../helpers/db');

module.exports = {
    getById,
    getDireccionDefault,
    create,
    update,
    updatePrincipal,
    delete: _delete
};

async function getDireccionDefault(userId) {
    return await db.user_direcciones.findOne({
        where: { userid: userId, default: true },
        attributes: { exclude: ['createdAt', 'updatedAt'] }
    });
}

async function getById(id, userId) {
    const direcciones = await getDirecciones(id);
    if (direcciones.userid !== userId) {
        throw 'La dirección no pertenece a el usuario.';
    }
    return direcciones;
}

async function create(params, userId) {
    params.userid = userId;

    const Provincia = await db.provincia.findByPk(params.idprovincia);
    if (Provincia) {
        params.provincia = Provincia.provincia;
    }


    // La fecha de las coordenadas la pone el servidor y no el cliente: es la
    // que decide cuando vencen los 30 dias de cache que permite Google, y un
    // reloj de cliente atrasado dejaria coordenadas viejas pareciendo frescas.
    if (params.lat != null && params.lng != null) {
        params.coords_actualizado = new Date();
    } else if (params.lat === null || params.lng === null) {
        // Coordenadas borradas a proposito (el usuario edito la direccion a
        // mano): la fecha tambien se va. Dejarla sellada diria que hay
        // coordenadas frescas cuando no hay ninguna.
        params.coords_actualizado = null;
    }

    await db.user_direcciones.create(params);
}

async function update(id, params, userId) {
    const direcciones = await getDirecciones(id);
    if (direcciones.userid !== userId) {
        throw 'La dirección no pertenece a el usuario.';
    }

    const Provincia = await db.provincia.findByPk(params.idprovincia);
    if (Provincia) {
        params.provincia = Provincia.provincia;
    }


    // La fecha de las coordenadas la pone el servidor y no el cliente: es la
    // que decide cuando vencen los 30 dias de cache que permite Google, y un
    // reloj de cliente atrasado dejaria coordenadas viejas pareciendo frescas.
    if (params.lat != null && params.lng != null) {
        params.coords_actualizado = new Date();
    } else if (params.lat === null || params.lng === null) {
        // Coordenadas borradas a proposito (el usuario edito la direccion a
        // mano): la fecha tambien se va. Dejarla sellada diria que hay
        // coordenadas frescas cuando no hay ninguna.
        params.coords_actualizado = null;
    }

    Object.assign(direcciones, params);
    await direcciones.save();
}

async function updatePrincipal(id, userId) {
    // Original crashed when no row had default=true (dir.default on null)
    const dir = await db.user_direcciones.findOne({ where: { default: true, userid: userId } });
    if (dir) {
        dir.default = false;
        await dir.save();
    }

    const direcciones = await getDirecciones(id);
    if (direcciones.userid !== userId) {
        throw 'La dirección no pertenece a el usuario.';
    }
    direcciones.default = true;
    await direcciones.save();
}

async function _delete(id, userId) {
    const direcciones = await getDirecciones(id);
    if (direcciones.userid !== userId) {
        throw 'La dirección no pertenece a el usuario.';
    }
    await direcciones.destroy();
}

// helpers
async function getDirecciones(id) {
    const direcciones = await db.user_direcciones.findByPk(id);
    if (!direcciones) throw 'Direccion not found';
    return direcciones;
}
