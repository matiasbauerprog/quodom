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
        // Opcional y aparte del nombre (`descripcion`, que es el nombre del
        // Quodom aunque se llame así): un renglón para que el usuario se acuerde
        // de qué era. No viaja en el mensaje de WhatsApp.
        detalle: { type: DataTypes.TEXT, allowNull: true },
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
