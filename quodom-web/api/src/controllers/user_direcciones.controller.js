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

async function getById(id) {
    return await getDirecciones(id);
}

async function create(params, userId) {
    params.userid = userId;

    const Provincia = await db.provincia.findByPk(params.idprovincia);
    if (Provincia) {
        params.provincia = Provincia.provincia;
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
