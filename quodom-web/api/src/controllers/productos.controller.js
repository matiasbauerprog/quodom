const db = require('../helpers/db');

module.exports = {
    getById,
    getByCat,
    getProductsByCatQuodom
};

async function getById(id) {
    return await getProduct(id);
}

async function getByCat(categoria) {
    return await db.Products.findAll({
        where: { categoria: categoria },
        attributes: { exclude: ['createdAt', 'updatedAt'] }
    });
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
async function getProduct(id) {
    const product = await db.Products.findByPk(id);
    if (!product) throw 'Err. Producto no encontrado.';
    return product;
}
