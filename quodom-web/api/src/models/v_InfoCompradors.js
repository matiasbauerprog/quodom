const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        idquodom: { primaryKey: true, type: DataTypes.STRING, allowNull: true },
        NombreComprador: { type: DataTypes.STRING, allowNull: true },
        telefono: { type: DataTypes.STRING, allowNull: true },
        email: { type: DataTypes.STRING, allowNull: true },
        Direccion: { type: DataTypes.STRING, allowNull: true },
        Provincia: { type: DataTypes.STRING, allowNull: true },
        Localidad: { type: DataTypes.STRING, allowNull: true },
        cp: { type: DataTypes.STRING, allowNull: true },
        observaciones: { type: DataTypes.STRING, allowNull: true }
    };

    const options = { tableName: 'v_InfoCompradors', freezeTableName: true, timestamps: false };

    return sequelize.define('v_InfoCompradors', attributes, options);
}
