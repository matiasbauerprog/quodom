const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        //id: { type: DataTypes.INTEGER, defaultValue: DataTypes.INTEGER, allowNull: false, primaryKey: true },
        userId: { type: DataTypes.STRING, allowNull: false },
        tiponotificacion: { type: DataTypes.STRING, allowNull: false },
        idquodom: { type: DataTypes.STRING, allowNull: false },
        //fecha: { type: DataTypes.DATE, allowNull: false },
        //hora: { type: DataTypes.TIME, allowNull: true },
        titulo: { type: DataTypes.STRING, allowNull: false },
        texto: { type: DataTypes.STRING, allowNull: false },
        enviada: { type: DataTypes.BOOLEAN, allowNull: true },
        leida: { type: DataTypes.BOOLEAN, allowNull: true }
    };

    const options = {

    };

    return sequelize.define('oper_notificaciones', attributes, options);
}
