const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        codigo: { type: DataTypes.STRING, allowNull: false },
        utilizado: { type: DataTypes.INTEGER, allowNull: false },
        sigla: { type: DataTypes.STRING, allowNull: false },
    };

    const options = {
        defaultScope: {
        },
        scopes: {
        }
    };

    return sequelize.define('series', attributes, options);
}
