const db = require('../helpers/db');

module.exports = {
    create,
    getRecent
};

async function create(valor, userId) {
    await db.hist_busquedas.create({ valor: valor, usuario: userId });
    return true;
}

async function getRecent(userId) {
    return await db.hist_busquedas.findAll({
        where: { usuario: userId },
        order: [['createdAt', 'DESC']],
        limit: 10,
        attributes: ['id', 'valor', 'createdAt']
    });
}
