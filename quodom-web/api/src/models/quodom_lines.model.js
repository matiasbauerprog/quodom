const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        idquodom: { type: DataTypes.STRING, allowNull: false },
        idproducto: { type: DataTypes.INTEGER, allowNull: false },
        cantidad: { type: DataTypes.DECIMAL, allowNull: false },
        categoria: { type: DataTypes.INTEGER, allowNull: true },
        categoriaPadre: { type: DataTypes.INTEGER, allowNull: true },
        nombreCategoria: { type: DataTypes.STRING, allowNull: true },
        nombreProducto: { type: DataTypes.STRING, allowNull: true },
        detalleProducto: { type: DataTypes.STRING, allowNull: true },
        marca: { type: DataTypes.STRING, allowNull: true },
        unidad: { type: DataTypes.STRING, allowNull: true },
        atributo1: { type: DataTypes.STRING, allowNull: true },
        atributo2: { type: DataTypes.STRING, allowNull: true },
        nombreAtributo1: { type: DataTypes.STRING, allowNull: true },
        nombreAtributo2: { type: DataTypes.STRING, allowNull: true },
        createdBy: { type: DataTypes.STRING, allowNull: true },

    };

    const options = {
        defaultScope: {
        },
        scopes: {
        }
    };

    return sequelize.define('quodom_lines', attributes, options);
}
