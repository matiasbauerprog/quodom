const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
        nombreproducto: { type: DataTypes.STRING, allowNull: false },
        descripcion: { type: DataTypes.STRING, allowNull: true },
        categoria: { type: DataTypes.INTEGER, allowNull: false },
        categoriaPadre: { type: DataTypes.INTEGER, allowNull: false },
        idatributo: { type: DataTypes.INTEGER, allowNull: true },
        nombreatributo: { type: DataTypes.STRING, allowNull: true },
        unidadmedida: { type: DataTypes.INTEGER, allowNull: true },
        nombreunidadmedida: { type: DataTypes.STRING, allowNull: true },
        imagen: { type: DataTypes.STRING, allowNull: true },
        refreshImagen: { type: DataTypes.STRING, allowNull: true },
        atributo1: { type: DataTypes.STRING, allowNull: true },
        atributo2: { type: DataTypes.STRING, allowNull: true }
    };

    return sequelize.define('productos', attributes, {});
}
