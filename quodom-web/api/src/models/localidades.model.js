const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        id: {

            type: DataTypes.INTEGER,
            defaultValue: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        idprovincia: { type: DataTypes.INTEGER, allowNull: true },
        nombre: { type: DataTypes.STRING, allowNull: true },
        comprador: { type: DataTypes.BOOLEAN, allowNull: true },
        vendedor: { type: DataTypes.BOOLEAN, allowNull: true }
    };

    const options = {
        defaultScope: {
        },
        scopes: {
        }
    };

    return sequelize.define('localidades', attributes, options);
}
