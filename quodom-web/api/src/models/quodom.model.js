const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        id: {

            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            allowNull: false,
            primaryKey: true
        },
        descripcion: { type: DataTypes.STRING, allowNull: false },
        idrubro: { type: DataTypes.INTEGER, allowNull: false },
        createdBy: { type: DataTypes.STRING, allowNull: false },
        fechavencimientoenvio: { type: DataTypes.DATE, allowNull: true },
        estado: { type: DataTypes.STRING, allowNull: false },
        fechaenvio: { type: DataTypes.DATE, allowNull: true },
        fechavencimientoaceptacion: { type: DataTypes.DATE, allowNull: true },
        iddireccion: { type: DataTypes.STRING, allowNull: true },
        nro: { type: DataTypes.STRING, allowNull: true },
        ocultar: { type: DataTypes.BOOLEAN, allowNull: true }
    };

    const options = {
        defaultScope: {
        },
        scopes: {
        }
    };

    return sequelize.define('quodom_header', attributes, options);
}
