const db = require('../helpers/db');
const { Op } = require('sequelize');
const { RUBROS_ACTIVOS, esRubroActivo } = require('../config/rubros');

module.exports = {
    getAll,
    getById,
    getSub
};

async function getAll() {
    return await db.Category.findAll({
        where: {
            activa: true,
            idcategoriapadre: 0,
            id: { [Op.in]: RUBROS_ACTIVOS }
        },
        order: [['orden', 'ASC']],
        attributes: { exclude: ['createdAt', 'updatedAt', 'activa', 'idcategoriapadre'] }
    });
}

async function getById(id) {
    const category = await getCategory(id);
    // Un rubro apagado, y cualquier subcategoría suya, no existen para la app.
    const idrubro = category.idcategoriapadre === 0 ? category.id : category.idcategoriapadre;
    if (!esRubroActivo(idrubro)) throw 'Category not found';
    return category;
}

async function getSub(id) {
    if (!esRubroActivo(id)) return [];
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
