const db = require('../helpers/db');
const { Op } = require('sequelize');
const { RUBROS_ACTIVOS, esRubroActivo } = require('../config/rubros');

module.exports = {
    getById,
    getByCat,
    getProductsByCatQuodom
};

async function getById(id) {
    return await getProduct(id);
}

async function getByCat(categoria) {
    const productos = await db.Products.findAll({
        where: { categoria: categoria, categoriaPadre: { [Op.in]: RUBROS_ACTIVOS } },
        attributes: { exclude: ['createdAt', 'updatedAt'] }
    });
    return await conValoresDeAtributo(productos);
}

// For the open-quodom view: each product of the subcategory plus an
// "existe" flag telling whether it is already in the quodom's lines.
async function getProductsByCatQuodom(idquodom, id, userId) {
    const quodom = await db.Quodom.findByPk(idquodom);
    if (!quodom) throw 'Err. Id Quodom no encontrado.';
    if (quodom.createdBy !== userId) {
        throw 'El Id Quodom no pertenece a el usuario.';
    }
    return await db.sequelize.query(
        `SELECT p.id, p.imagen, p.refreshImagen, p.nombreproducto,
                COALESCE((SELECT 1 FROM quodom_lines ql
                          WHERE ql.idquodom = :q AND ql.idproducto = p.id LIMIT 1), 0) AS existe
         FROM productos p
         WHERE p.categoria = :subcategoria`,
        {
            replacements: { q: idquodom, subcategoria: id },
            type: db.Sequelize.QueryTypes.SELECT
        }
    );
}

// helpers

// productos.atributo1/atributo2 traen el NOMBRE del grupo ("MEDIDAS"); los
// valores elegibles están en productos_atributos. La lista los necesita juntos
// para poder ofrecer el atributo al agregar, así que se resuelven en una sola
// consulta para toda la página en vez de una por producto.
async function conValoresDeAtributo(productos) {
    const ids = productos.filter(p => p.atributo1 || p.atributo2).map(p => p.id);
    const filas = ids.length === 0 ? [] : await db.productos_atributos.findAll({
        where: { idproducto: { [Op.in]: ids }, esvendedor: '0' },
        order: [['orden', 'ASC']]
    });

    // Se agrupa por nombre y no por idatributo: el id se repite entre grupos
    // distintos (3 es MEDIDAS y también PESO), y el nombre es lo que relaciona
    // la fila con producto.atributoN.
    const porProducto = new Map();
    for (const fila of filas) {
        if (!porProducto.has(fila.idproducto)) porProducto.set(fila.idproducto, new Map());
        const grupos = porProducto.get(fila.idproducto);
        if (!grupos.has(fila.nombreatributo)) grupos.set(fila.nombreatributo, []);
        grupos.get(fila.nombreatributo).push(fila.valoratributo);
    }
    const valores = (producto, nombre) =>
        (nombre && porProducto.get(producto.id)?.get(nombre)) || [];

    return productos.map(producto => ({
        ...producto.get({ plain: true }),
        valoresAtributo1: valores(producto, producto.atributo1),
        valoresAtributo2: valores(producto, producto.atributo2)
    }));
}
async function getProduct(id) {
    const product = await db.Products.findByPk(id);
    // Un producto de un rubro apagado no existe para la app, igual que su rubro.
    if (!product || !esRubroActivo(product.categoriaPadre)) throw 'Err. Producto no encontrado.';
    return product;
}
