const { DataTypes } = require('sequelize');

module.exports = model;

/**
 * Comercios que un usuario reportó como "no tiene WhatsApp".
 *
 * Es el ÚNICO dato propio que acumula el feature, y es lo que lo hace mejorar
 * con el uso: a los seis meses, la lista de pinturerías de una zona está
 * depurada por la gente que pasó antes.
 *
 * Se puede guardar sin límite de tiempo porque no es un dato de Google: es una
 * observación nuestra, indexada por un `place_id`, que sí es archivable.
 */
function model(sequelize) {
    const attributes = {
        placeid: { type: DataTypes.STRING, primaryKey: true },
        reportes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }
    };

    return sequelize.define('lugares_sinwhatsapp', attributes, { freezeTableName: true });
}
