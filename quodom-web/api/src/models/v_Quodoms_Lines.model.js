const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
        idquodom: { type: DataTypes.STRING, allowNull: false },
        idproducto: { type: DataTypes.INTEGER, allowNull: false },
        cantidad: { type: DataTypes.DECIMAL, allowNull: false },
        categoria: { type: DataTypes.INTEGER, allowNull: true },
        nombreCategoria: { type: DataTypes.STRING, allowNull: true },
        nombreProducto: { type: DataTypes.STRING, allowNull: true },
        detalleProducto: { type: DataTypes.STRING, allowNull: true },
        marca: { type: DataTypes.STRING, allowNull: true },
        unidad: { type: DataTypes.STRING, allowNull: true },
        atributosFaltantes: { type: DataTypes.INTEGER, allowNull: true },
        imagen: { type: DataTypes.STRING, allowNull: true },
        refreshImagen: { type: DataTypes.STRING, allowNull: true },
        atributo1: { type: DataTypes.STRING, allowNull: true },
        atributo2: { type: DataTypes.STRING, allowNull: true },
        nombreAtributo1: { type: DataTypes.STRING, allowNull: true },
        nombreAtributo2: { type: DataTypes.STRING, allowNull: true }
    };

    const options = { tableName: 'v_Quodoms_Lines', freezeTableName: true, timestamps: false };

    return sequelize.define('v_Quodoms_Lines', attributes, options);
}
