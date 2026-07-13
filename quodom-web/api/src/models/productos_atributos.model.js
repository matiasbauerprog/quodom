const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        idproducto: { type: DataTypes.INTEGER, allowNull: true },
        idatributo: { type: DataTypes.INTEGER, allowNull: true },
        nombreatributo: { type: DataTypes.STRING, allowNull: true },
        valoratributo: { type: DataTypes.STRING, allowNull: true },
        esvendedor: { type: DataTypes.STRING, allowNull: true },
        orden: { type: DataTypes.INTEGER, allowNull: true }
    };

    const options = {
        defaultScope: {
        },
        scopes: {
        }
    };

    return sequelize.define('productos_atributos', attributes, options);
}
