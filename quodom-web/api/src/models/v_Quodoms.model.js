const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        id: { type: DataTypes.UUID, primaryKey: true },
        descripcion: { type: DataTypes.STRING, allowNull: false },
        createdBy: { type: DataTypes.STRING, allowNull: false },
        fechavencimientoenvio: { type: DataTypes.DATE, allowNull: true },
        estado: { type: DataTypes.STRING, allowNull: false },
        idrubro: { type: DataTypes.INTEGER, allowNull: true },
        nombrerubro: { type: DataTypes.STRING, allowNull: true },
        porccompletado: { type: DataTypes.DECIMAL, allowNull: true },
        cantproductos: { type: DataTypes.INTEGER, allowNull: true },
        diasparavencimientoenvio: { type: DataTypes.INTEGER, allowNull: true },
        diasparavencimientoaceptacion: { type: DataTypes.INTEGER, allowNull: true },
        iddireccion: { type: DataTypes.STRING, allowNull: true },
        nro: { type: DataTypes.STRING, allowNull: false },
        createdAt: { type: DataTypes.DATE }
    };

    const options = { tableName: 'v_Quodoms', freezeTableName: true, timestamps: false };

    return sequelize.define('v_Quodoms', attributes, options);
}
