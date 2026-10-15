const { DataTypes } = require('sequelize');

module.exports = model;

/**
 * A qué proveedores se le ofrecieron a un Quodom, y a cuáles ya les mandó.
 *
 * Guarda SÓLO el identificador de Google: el nombre, la puntuación y el teléfono
 * no se pueden archivar y se vuelven a pedir cada vez que se muestran. El
 * `place_id` sí es permanente.
 */
function model(sequelize) {
    const attributes = {
        idquodom: { type: DataTypes.STRING, allowNull: false },
        placeid: { type: DataTypes.STRING, allowNull: false },
        orden: { type: DataTypes.INTEGER, allowNull: true },
        // Null = se le ofreció y todavía no se le mandó. Se marca al tocar el
        // botón, que es lo único observable: lo que pasa dentro de WhatsApp no
        // se ve.
        contactado_en: { type: DataTypes.DATE, allowNull: true }
    };

    // `freezeTableName` como en `lugares_sinwhatsapp`: sin él el nombre de la
    // tabla sale del pluralizador de Sequelize, que hoy devuelve el mismo
    // nombre por casualidad (`proveedores` ya es plural). Esta tabla es la
    // memoria del feature y vive en una base **trackeada en git**: si una
    // versión del pluralizador la renombrara, el server arrancaría creando una
    // tabla vacía al lado y todo el historial de contactos quedaría invisible.
    return sequelize.define('quodom_proveedores', attributes, {
        freezeTableName: true,
        indexes: [{ fields: ['idquodom'] }]
    });
}
