const db = require('../helpers/db');

module.exports = {
    getAll
};

async function getAll() {
    return await db.provincia.findAll({
        order: [['provincia', 'ASC']],
        attributes: { exclude: ['createdAt', 'updatedAt'] }
    });
}
