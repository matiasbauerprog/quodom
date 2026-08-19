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
        },
        indexes: [
            {
                // The controller checks this rule before inserting, which is what
                // produces the friendly 409. This partial index is the net under
                // that check: two requests interleaving between the lookup and the
                // insert would otherwise both open a Quodom of the same rubro.
                // Partial, so an ENVIADO Quodom never blocks opening a new one.
                name: 'quodom_abierto_por_rubro',
                unique: true,
                fields: ['createdBy', 'idrubro'],
                where: { estado: 'CREADO' }
            }
        ]
    };

    return sequelize.define('quodom_header', attributes, options);
}
