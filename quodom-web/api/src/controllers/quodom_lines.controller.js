const db = require('../helpers/db');
const { httpError } = require('../helpers/http-error');

module.exports = {
    getAll,
    getById,
    getAtributos,
    add,
    update,
    delete: _delete
};

async function getAll(idquodom, userId) {
    await ValidarQuodom(idquodom, userId, 'GET');

    return await db.v_Quodoms_lines.findAll({
        where: { idquodom: idquodom }
    });
}

async function getAtributos(idproducto, nombreatributo) {
    return await db.productos_atributos.findAll({
        where: {
            idproducto: idproducto,
            nombreatributo: nombreatributo,
            esvendedor: '0'
        },
        order: [['orden', 'ASC']],
        attributes: { exclude: ['idproducto', 'idatributo', 'nombreatributo', 'createdAt', 'updatedAt'] }
    });
}

async function getById(id, userId) {
    const ql = await getQuodom_lines(id);
    if (ql.createdBy !== userId) {
        throw 'El Id Quodom no pertenece a el usuario.';
    }
    return ql;
}

async function add(params, userId) {
    const quodom = await ValidarQuodom(params.idquodom, userId, 'ADD');

    const producto = await getPr(params.idproducto);

    if (producto.categoriaPadre !== quodom.idrubro) {
        const [rubroProducto, rubroQuodom] = await Promise.all([
            db.Category.findByPk(producto.categoriaPadre),
            db.Category.findByPk(quodom.idrubro)
        ]);
        throw httpError(409, 'rubro_mismatch',
            'No se pueden mezclar rubros: este producto es de '
            + (rubroProducto ? rubroProducto.nombrecategoria : 'otro rubro')
            + ' y el Quodom es de '
            + (rubroQuodom ? rubroQuodom.nombrecategoria : 'otro rubro') + '.');
    }

    params.categoria = producto.categoria;
    params.categoriaPadre = producto.categoriaPadre;
    params.nombreAtributo1 = producto.atributo1;
    params.nombreAtributo2 = producto.atributo2;
    params.createdBy = userId;

    const categoria = await getCat(producto.categoria);
    if (categoria) {
        params.nombreCategoria = categoria.nombrecategoria;
    }

    const existente = await findLineaExistente(params);
    if (existente) {
        existente.cantidad = Number(existente.cantidad) + Number(params.cantidad);
        await existente.save();
        return existente.id;
    }

    const { id } = await db.Quodom_Lines.create(params);

    return (id);
}

async function update(id, params, userId) {
    const ql = await getQuodom_lines(id);
    if (ql.createdBy !== userId) {
        throw 'El Id Quodom no pertenece a el usuario.';
    }

    Object.assign(ql, params);
    return await ql.save();
}

async function _delete(id, userId) {
    const ql = await getQuodom_lines(id);

    await ValidarQuodom(ql.idquodom, userId, 'DELETE');

    await ql.destroy();
}

// helpers
async function getQuodom_lines(id) {
    const ql = await db.Quodom_Lines.findByPk(id);
    if (!ql) throw 'Err. Quodom_lines no encontrado.';
    return ql;
}

async function getQuodom(id) {
    const quodom = await db.Quodom.findByPk(id);
    if (!quodom) throw 'Err. Id Quodom no encontrado.';
    return quodom;
}

async function getPr(id) {
    const product = await db.Products.findByPk(id);
    if (!product) throw 'Err. Id de producto no encontrado.';
    return product;
}

async function getCat(id) {
    const categoria = await db.Category.findByPk(id);
    if (!categoria) throw 'Err. Id de categoria no encontrado.';
    return categoria;
}

// Same rule as sameLine() in the frontend's guestQuodom.ts: same product and
// same attributes (null/undefined/'' all treated as "no attribute") means the
// same line, so quantities get summed instead of duplicated.
async function findLineaExistente(params) {
    const candidatas = await db.Quodom_Lines.findAll({
        where: { idquodom: params.idquodom, idproducto: params.idproducto }
    });
    const norm = (v) => v ?? '';
    return candidatas.find((linea) =>
        norm(linea.atributo1) === norm(params.atributo1)
        && norm(linea.atributo2) === norm(params.atributo2)
    ) || null;
}

async function ValidarQuodom(idquodom, userId, action) {
    const Quodom = await getQuodom(idquodom);

    if (Quodom.createdBy !== userId)
        throw 'El Id Quodom no pertenece a el usuario.';

    if (action != 'GET') {
        if (Quodom.estado !== 'CREADO')
            throw 'El estado del Quodom no permite modificaciones.';
    }

    return Quodom;
}
