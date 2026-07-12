const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
        nombrecategoria: { type: DataTypes.STRING, allowNull: false },
        idcategoriapadre: { type: DataTypes.INTEGER, allowNull: false },
        activa: { type: DataTypes.BOOLEAN, allowNull: false },
        imagen: { type: DataTypes.STRING, allowNull: true },
        refreshImage: { type: DataTypes.STRING, allowNull: true },
        orden: { type: DataTypes.INTEGER, allowNull: false }
    };

    return sequelize.define('categorias', attributes, {});
}
