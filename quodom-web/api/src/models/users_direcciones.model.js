const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        userid: { type: DataTypes.STRING, allowNull: false },
        provincia: { type: DataTypes.INTEGER, allowNull: true },
        partido: { type: DataTypes.STRING, allowNull: true },
        localidad: { type: DataTypes.STRING, allowNull: true },
        direccion: { type: DataTypes.STRING, allowNull: true },
        calle: { type: DataTypes.STRING, allowNull: true },
        numero: { type: DataTypes.STRING, allowNull: true },
        piso: { type: DataTypes.STRING, allowNull: true },
        cp: { type: DataTypes.STRING, allowNull: true },
        alias: { type: DataTypes.STRING, allowNull: true },
        default: { type: DataTypes.TINYINT, allowNull: true },
        idprovincia: { type: DataTypes.STRING, allowNull: true },
        idpartido: { type: DataTypes.STRING, allowNull: true },
        observaciones: { type: DataTypes.STRING, allowNull: true },
    };

    const options = {
        defaultScope: {
        },
        scopes: {
        }
    };

    return sequelize.define('users_direcciones', attributes, options);
}
