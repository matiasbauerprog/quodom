const db = require('../helpers/db');
const serie = require('../helpers/series');

module.exports = {
    getById,
    getMyQuodoms,
    getPorcById,
    create,
    update,
    delete: _delete,
    getLastQuodomOrCreate,
    getQuodomCreados,
    whatsappLink
};

async function getById(id, userId) {
    const quodom = await getQuodom(id);
    if (quodom.createdBy !== userId) {
        throw 'El Id Quodom no pertenece a el usuario.';
    }
    return quodom;
}

async function getMyQuodoms(userId) {
    return await db.v_Quodoms.findAll({
        where: { createdBy: userId },
        attributes: { exclude: ['createdBy', 'updatedAt'] },
        order: [['createdAt', 'DESC']]
    });
}

async function getPorcById(userId, id) {
    return await db.v_Quodoms.findOne({
        where: { id: id, createdBy: userId },
        attributes: ['cantproductos', 'porccompletado']
    });
}

async function create(params, userId) {
    if (!params.iddireccion) {
        const direccionDefault = await getDireccionDefault(userId);
        params.iddireccion = direccionDefault ? direccionDefault.id : null;
    }

    params.nro = await serie.incrementar('QUODOM');
    params.createdBy = userId;
    params.estado = 'CREADO';

    const { id } = await db.Quodom.create(params);

    return (id);
}

async function update(id, params, userId) {
    const quodom = await getQuodom(id);
    if (quodom.createdBy !== userId) {
        throw 'El Id Quodom no pertenece a el usuario.';
    }
    Object.assign(quodom, params);
    await quodom.save();
    return true;
}

async function _delete(id, userId) {
    const quodom = await getQuodom(id);
    if (quodom.createdBy !== userId) {
        throw 'El Id Quodom no pertenece a el usuario.';
    }

    if (quodom.estado === 'CREADO') {
        await quodom.destroy();
        await db.Quodom_Lines.destroy({
            where: { idquodom: id }
        });
    } else {
        Object.assign(quodom, { ocultar: true });
        await quodom.save();
    }
    return true;
}

async function getLastQuodomOrCreate(params, userId) {
    const quodomHeader = await db.v_Quodoms.findOne({
        where: { createdBy: userId, estado: 'CREADO' },
        attributes: { exclude: ['createdBy', 'updatedAt'] },
        order: [['createdAt', 'DESC']]
    });

    if (quodomHeader === null) {
        // Original crashed here when there was no default address (dire.id on
        // null); create() already resolves the default address itself.
        const id = await create(params, userId);
        return await db.v_Quodoms.findOne({
            where: { id: id },
            attributes: { exclude: ['createdBy', 'updatedAt'] }
        });
    }
    return quodomHeader;
}

async function getQuodomCreados(userId) {
    return await db.v_Quodoms.findAll({
        where: { createdBy: userId, estado: 'CREADO' },
        attributes: { exclude: ['createdBy', 'updatedAt'] },
        order: [['createdAt', 'DESC']]
    });
}

async function whatsappLink(id, userId) {
    const quodom = await getQuodom(id);
    if (quodom.createdBy !== userId) {
        throw 'El Id Quodom no pertenece a el usuario.';
    }

    const lines = await db.v_Quodoms_lines.findAll({
        where: { idquodom: id }
    });
    if (lines.length === 0) {
        throw 'El Quodom no tiene productos.';
    }

    const info = await db.v_InfoCompradors.findOne({
        where: { idquodom: id }
    });

    let msg = '*QUODOM ' + quodom.nro + ': ' + quodom.descripcion + '*\n\n';
    msg += '*Productos:*\n';
    for (const l of lines) {
        msg += '- ' + l.cantidad + ' x ' + l.nombreProducto;
        const attrs = [];
        if (l.nombreAtributo1 && l.atributo1) attrs.push(l.nombreAtributo1 + ': ' + l.atributo1);
        if (l.nombreAtributo2 && l.atributo2) attrs.push(l.nombreAtributo2 + ': ' + l.atributo2);
        if (attrs.length > 0) msg += ' (' + attrs.join(', ') + ')';
        msg += '\n';
    }

    msg += '\n*Datos de contacto:*\n';
    msg += 'Nombre: ' + info.NombreComprador.trim() + '\n';
    msg += 'Teléfono: ' + info.telefono + '\n';
    msg += 'Email: ' + info.email + '\n';
    if (info.Direccion && info.Direccion.trim() !== '') {
        msg += 'Dirección: ' + info.Direccion.trim();
        if (info.Localidad) msg += ', ' + info.Localidad;
        if (info.Provincia) msg += ', ' + info.Provincia;
        if (info.cp) msg += ' (CP ' + info.cp + ')';
        msg += '\n';
    }

    if (quodom.estado === 'CREADO') {
        quodom.estado = 'ENVIADO';
        quodom.fechaenvio = new Date();
        await quodom.save();

        await db.oper_notificaciones.create({
            userId: userId,
            titulo: 'Quodom enviado',
            texto: 'Tu Quodom ' + quodom.nro + ' fue enviado por WhatsApp.',
            tiponotificacion: 'QUODOMENVIADO',
            idquodom: id,
            enviada: 0,
            leida: 0
        });
    }

    return 'https://wa.me/?text=' + encodeURIComponent(msg);
}

// helpers
async function getQuodom(id) {
    const quodom = await db.Quodom.findByPk(id);
    if (!quodom) throw 'Err. Quodom no encontrado.';
    return quodom;
}

async function getDireccionDefault(userId) {
    return await db.user_direcciones.findOne({
        where: { userid: userId, default: true },
        attributes: { exclude: ['createdAt', 'updatedAt'] }
    });
}
