const db = require('../helpers/db');

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
    await ValidarQuodom(params.idquodom, userId, 'ADD');

    const producto = await getPr(params.idproducto);

    params.categoria = producto.categoria;
    params.categoriaPadre = producto.categoriaPadre;
    params.nombreAtributo1 = producto.atributo1;
    params.nombreAtributo2 = producto.atributo2;
    params.createdBy = userId;

    const categoria = await getCat(producto.categoria);
    if (categoria) {
        params.nombreCategoria = categoria.nombrecategoria;
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

async function ValidarQuodom(idquodom, userId, action) {
    const Quodom = await getQuodom(idquodom);

    if (Quodom.createdBy !== userId)
        throw 'El Id Quodom no pertenece a el usuario.';

    if (action != 'GET') {
        if (Quodom.estado !== 'CREADO')
            throw 'El estado del Quodom no permite modificaciones.';
    }

    return true;
}
