const db = require('../helpers/db');
const serie = require('../helpers/series');
const { httpError } = require('../helpers/http-error');
const { esRubroActivo } = require('../config/rubros');

module.exports = {
    getById,
    getMyQuodoms,
    getPorcById,
    create,
    update,
    delete: _delete,
    getActivoPorRubro,
    getQuodomCreados,
    whatsappLink,
    repetir
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
    const rubro = await db.Category.findOne({
        where: { id: params.idrubro, idcategoriapadre: 0 }
    });
    // Un rubro fuera de la whitelist no se ofrece en el catálogo, así que un
    // alta contra él sólo puede venir de un cliente viejo o de una URL a mano.
    if (!rubro || !esRubroActivo(params.idrubro)) {
        throw httpError(400, 'idrubro_invalido', 'El rubro indicado no existe.');
    }

    const abierto = await db.Quodom.findOne({
        where: { createdBy: userId, idrubro: params.idrubro, estado: 'CREADO' }
    });
    if (abierto) {
        throw rubroDuplicado(rubro, abierto);
    }

    if (!params.iddireccion) {
        const direccionDefault = await getDireccionDefault(userId);
        params.iddireccion = direccionDefault ? direccionDefault.id : null;
    }

    params.nro = await serie.incrementar('QUODOM');
    params.createdBy = userId;
    params.estado = 'CREADO';

    try {
        const { id } = await db.Quodom.create(params);
        return (id);
    } catch (e) {
        // The check above lost a race: another request opened a Quodom of this
        // rubro between the lookup and this insert, and the partial unique index
        // stopped the duplicate. Answer exactly as the check would have, so the
        // caller cannot tell which of the two guards fired.
        if (e instanceof db.Sequelize.UniqueConstraintError) {
            const ganador = await db.Quodom.findOne({
                where: { createdBy: userId, idrubro: params.idrubro, estado: 'CREADO' }
            });
            throw rubroDuplicado(rubro, ganador);
        }
        throw e;
    }
}

function rubroDuplicado(rubro, abierto) {
    return httpError(409, 'rubro_duplicado',
        'Ya tenés un Quodom abierto de ' + rubro.nombrecategoria + '.',
        abierto ? { idquodom: abierto.id } : {});
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

// The open ('CREADO') quodom of a rubro, or null. Deliberately does NOT create:
// creating a quodom now needs the user to confirm, so it cannot be a side effect
// of a lookup.
async function getActivoPorRubro(userId, idrubro) {
    const quodom = await db.v_Quodoms.findOne({
        where: { createdBy: userId, estado: 'CREADO', idrubro: idrubro },
        attributes: { exclude: ['createdBy', 'updatedAt'] },
        order: [['createdAt', 'DESC']]
    });
    return quodom || null;
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

async function repetir(id, userId) {
    const source = await getQuodom(id);
    if (source.createdBy !== userId) {
        throw 'El Id Quodom no pertenece a el usuario.';
    }

    const lines = await db.Quodom_Lines.findAll({ where: { idquodom: id } });
    if (lines.length === 0) {
        throw 'El Quodom no tiene productos para repetir.';
    }

    const nuevoId = await create({
        descripcion: source.descripcion,
        idrubro: source.idrubro,
        iddireccion: source.iddireccion
    }, userId);

    for (const l of lines) {
        const raw = l.get();
        delete raw.id;
        delete raw.createdAt;
        delete raw.updatedAt;
        raw.idquodom = nuevoId;
        raw.createdBy = userId;
        await db.Quodom_Lines.create(raw);
    }

    return nuevoId;
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
