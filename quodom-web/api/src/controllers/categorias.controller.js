const db = require('../helpers/db');

module.exports = {
    getAll,
    getById,
    getSub
};

async function getAll() {
    return await db.Category.findAll({
        where: {
            activa: true,
            idcategoriapadre: 0
        },
        order: [['orden', 'ASC']],
        attributes: { exclude: ['createdAt', 'updatedAt', 'activa', 'idcategoriapadre'] }
    });
}

async function getById(id) {
    return await getCategory(id);
}

async function getSub(id) {
    return await db.Category.findAll({
        where: {
            activa: true,
            idcategoriapadre: id
        },
        order: [['orden', 'ASC']],
        attributes: { exclude: ['createdAt', 'updatedAt', 'activa', 'idcategoriapadre'] }
    });
}

// helpers
async function getCategory(id) {
    const category = await db.Category.findByPk(id);
    if (!category) throw 'Category not found';
    return category;
}
