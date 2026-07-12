const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        valor: { type: DataTypes.STRING, allowNull: true },
        usuario: { type: DataTypes.STRING, allowNull: false }
    };

    const options = {
        defaultScope: {
        },
        scopes: {
        }
    };

    return sequelize.define('hist_busquedas', attributes, options);
}
