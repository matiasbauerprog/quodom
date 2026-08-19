const db = require('../helpers/db');
const { Op } = require('sequelize');
const { RUBROS_ACTIVOS } = require('../config/rubros');

module.exports = {
    getAll
};

async function getAll(buscar) {
    return await db.v_Busqueda.findAll({
        where: {
            categoriaPadre: { [Op.in]: RUBROS_ACTIVOS },
            [Op.or]: [
                { nombre: { [Op.like]: '%' + buscar + '%' } },
                { descripcion: { [Op.like]: '%' + buscar + '%' } }
            ]
        }
    });
}
