const db = require('../helpers/db');

module.exports = {
    getLocalidadProv
};

async function getLocalidadProv(idprovincia) {
    return await db.localidad.findAll({
        where: { idprovincia: idprovincia },
        order: [['nombre', 'ASC']],
        attributes: { exclude: ['createdAt', 'updatedAt'] }
    });
}
