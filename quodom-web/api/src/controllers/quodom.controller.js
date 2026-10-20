const db = require('../helpers/db');
const serie = require('../helpers/series');
const { httpError } = require('../helpers/http-error');
const { esRubroActivo } = require('../config/rubros');
const { resolverDireccion, getDireccionDefault } = require('../helpers/direccionDelQuodom');
const { analizarTelefono } = require('../helpers/telefonoWhatsapp');

module.exports = {
    getById,
    getMyQuodoms,
    getPorcById,
    create,
    update,
    delete: _delete,
    getActivosPorRubro,
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

// `origen` es el nro del Quodom que se repitió, para que la notificación lo diga.
async function create(params, userId, origen = null) {
    const rubro = await db.Category.findOne({
        where: { id: params.idrubro, idcategoriapadre: 0 }
    });
    // Un rubro fuera de la whitelist no se ofrece en el catálogo, así que un
    // alta contra él sólo puede venir de un cliente viejo o de una URL a mano.
    if (!rubro || !esRubroActivo(params.idrubro)) {
        throw httpError(400, 'idrubro_invalido', 'El rubro indicado no existe.');
    }

    if (!params.iddireccion) {
        const direccionDefault = await getDireccionDefault(userId);
        params.iddireccion = direccionDefault ? direccionDefault.id : null;
    }

    params.nro = await serie.incrementar('QUODOM');
    params.createdBy = userId;
    params.estado = 'CREADO';

    const { id } = await db.Quodom.create(params);

    // Todo alta pasa por acá —"Nuevo", repetir y la migración del carrito de
    // invitado al iniciar sesión—, así que la notificación sale una vez por
    // Quodom sin que ningún camino tenga que acordarse.
    await db.oper_notificaciones.create({
        userId: userId,
        titulo: 'Quodom creado',
        texto: origen
            ? 'Repetiste ' + origen + ': el nuevo es ' + params.nro + '.'
            : 'Creaste el Quodom ' + params.nro + '.',
        tiponotificacion: 'QUODOMCREADO',
        idquodom: id,
        enviada: 0,
        leida: 0
    });
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
        // Nunca salió, así que lo único que lo nombra es su "creado": dejarlo
        // sería una notificación de algo que ya no existe y que no se puede tocar.
        await db.oper_notificaciones.destroy({
            where: { idquodom: id }
        });
    } else {
        Object.assign(quodom, { ocultar: true });
        await quodom.save();
    }
    return true;
}

// The open ('CREADO') quodoms of a rubro, newest first. Deliberately does NOT
// create: creating a quodom needs the user to confirm, so it cannot be a side
// effect of a lookup.
async function getActivosPorRubro(userId, idrubro) {
    return await db.v_Quodoms.findAll({
        where: { createdBy: userId, estado: 'CREADO', idrubro: idrubro },
        attributes: { exclude: ['createdBy', 'updatedAt'] },
        order: [['createdAt', 'DESC']]
    });
}

async function getQuodomCreados(userId) {
    return await db.v_Quodoms.findAll({
        where: { createdBy: userId, estado: 'CREADO' },
        attributes: { exclude: ['createdBy', 'updatedAt'] },
        order: [['createdAt', 'DESC']]
    });
}

// Un atributo que el producto declara pero la línea no eligió. Vale lo mismo
// NULL que una cadena en blanco: la vista v_Quodoms_Lines sólo mira NULL, y al
// proveedor le llega igual de vacío.
function atributosSinElegir(linea) {
    const faltan = [];
    for (const slot of [1, 2]) {
        const nombre = linea['nombreAtributo' + slot];
        const valor = linea['atributo' + slot];
        if (nombre && String(nombre).trim() !== '' && (!valor || String(valor).trim() === '')) {
            faltan.push(String(nombre).trim());
        }
    }
    return faltan;
}

async function whatsappLink(id, userId, proveedor, tel) {
    const quodom = await getQuodom(id);
    if (quodom.createdBy !== userId) {
        throw 'El Id Quodom no pertenece a el usuario.';
    }

    // El proveedor y su teléfono van juntos o no va ninguno. El camino sin
    // destinatario —la salida cuando no hay proveedores cerca, cuando Google
    // falla, o para un proveedor propio— no manda ninguno de los dos, así que
    // medio par es siempre un bug del cliente y tiene que ser ruidoso. Y es
    // alcanzable de verdad: un proveedor de la lista puede venir con
    // `telefono: null` (un 0800, o un local sin teléfono). Tomarlo como "sin
    // proveedor" devolvía 200 con un link sin destinatario y el Quodom ya en
    // ENVIADO: el comprador caía en el selector de contactos vacío de WhatsApp,
    // el popup seguía mostrando al proveedor como no contactado, y el pedido ya
    // no se podía volver a mandar.
    if (!!proveedor !== !!tel) {
        throw 'Para mandarle a un proveedor hacen falta su identificador y su teléfono.';
    }

    // El número se revisa antes de tocar nada, para que un teléfono que no
    // sirve deje el Quodom en CREADO y no a medio enviar. Se rechaza también el
    // que es válido pero no recibe WhatsApp (un 0800): armarle el link igual
    // manda al comprador a un chat que nunca abre, y eso se lee como que el
    // comercio no tiene WhatsApp. La app ya esconde el botón; esto es la red.
    let destino = null;
    if (proveedor) {
        const n = analizarTelefono(tel);
        if (!n || !n.sirveWhatsapp) {
            throw 'El teléfono del proveedor no es válido.';
        }
        destino = n.e164.replace('+', '');
    }

    const lines = await db.v_Quodoms_lines.findAll({
        where: { idquodom: id }
    });
    if (lines.length === 0) {
        throw 'El Quodom no tiene productos.';
    }

    // Las dos guardas van acá y no sólo en el botón porque este endpoint es el
    // que pasa el Quodom a ENVIADO: validar únicamente en la app dejaría el
    // estado mal a quien la saltee.
    const incompletas = lines
        .map(l => ({ nombre: l.nombreProducto, faltan: atributosSinElegir(l) }))
        .filter(l => l.faltan.length > 0);
    if (incompletas.length > 0) {
        throw httpError(409, 'falta_atributo',
            'Elegí ' + incompletas.map(l => l.faltan.join(' y ') + ' en ' + l.nombre).join('; ') + '.',
            { faltan: incompletas });
    }

    await resolverDireccion(quodom, userId);

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
    // Datos de facturación: sólo si hay algo cargado. Alcanza con uno de los
    // dos — esconder el bloque entero porque falta el CUIT le saca al proveedor
    // el dato que sí está.
    const empresa = (info.Empresa || '').trim();
    const cuit = (info.Cuit || '').trim();
    if (empresa !== '' || cuit !== '') {
        msg += '\n*Datos de empresa:*\n';
        if (empresa !== '') msg += 'Empresa: ' + empresa + '\n';
        if (cuit !== '') msg += 'CUIT: ' + cuit + '\n';
        if (info.FacturaA) msg += 'Factura A\n';
    }

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

    if (destino) {
        // Se marca el toque del botón, que es lo único observable: lo que pasa
        // dentro de WhatsApp no se ve. Fingir más conocimiento sería peor.
        // `findOrCreate` y no `create` porque la tabla no tiene unique sobre
        // (idquodom, placeid): mandarle dos veces al mismo duplicaría la fila y
        // el popup lo mostraría repetido.
        const [fila] = await db.quodom_proveedores.findOrCreate({
            where: { idquodom: id, placeid: proveedor },
            defaults: { idquodom: id, placeid: proveedor }
        });
        fila.contactado_en = new Date();
        await fila.save();

        return 'https://wa.me/' + destino + '?text=' + encodeURIComponent(msg);
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
    }, userId, source.nro);

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
