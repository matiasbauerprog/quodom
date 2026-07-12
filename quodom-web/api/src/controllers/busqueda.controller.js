const db = require('../helpers/db');
const { Op } = require('sequelize');

module.exports = {
    getAll
};

async function getAll(buscar) {
    return await db.v_Busqueda.findAll({
        where: {
            [Op.or]: [
                { nombre: { [Op.like]: '%' + buscar + '%' } },
                { descripcion: { [Op.like]: '%' + buscar + '%' } }
            ]
        }
    });
}
