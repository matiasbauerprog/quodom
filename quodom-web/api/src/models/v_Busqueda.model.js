const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        nombre: { type: DataTypes.STRING, allowNull: true },
        descripcion: { type: DataTypes.STRING, allowNull: true },
        imagen: { type: DataTypes.STRING, allowNull: true },
        refreshImagen: { type: DataTypes.STRING, allowNull: true },
        categoriaPadre: { type: DataTypes.INTEGER, allowNull: true }
    };

    const options = { tableName: 'v_Busquedas', freezeTableName: true, timestamps: false };

    return sequelize.define('v_Busqueda', attributes, options);
}
