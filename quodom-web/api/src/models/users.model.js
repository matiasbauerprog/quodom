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
        username: { type: DataTypes.STRING, allowNull: false },
        email: { type: DataTypes.STRING, allowNull: false },
        nombre: { type: DataTypes.STRING, allowNull: true },
        apellido: { type: DataTypes.STRING, allowNull: true },
        password: { type: DataTypes.STRING, allowNull: false },
        role: { type: DataTypes.STRING, allowNull: true },
        activo: { type: DataTypes.BOOLEAN, allowNull: false },
        emailValidado: { type: DataTypes.BOOLEAN, allowNull: false },
        dni: { type: DataTypes.STRING, allowNull: true },
        telefono: { type: DataTypes.STRING, allowNull: false },
        foto: { type: DataTypes.STRING, allowNull: true },
        refreshFoto: { type: DataTypes.STRING, allowNull: true },
        codArea: { type: DataTypes.STRING, allowNull: true },
        // Datos de facturación: van al WhatsApp para que el proveedor pueda
        // emitir la factura. Opcionales — quien compra a nombre propio no los
        // carga. `npm run migrar-empresa` los agrega a una base que ya existe,
        // porque model.sync() nunca hace ALTER sobre una tabla creada.
        empresa: { type: DataTypes.STRING, allowNull: true },
        cuit: { type: DataTypes.STRING, allowNull: true },
        facturaA: { type: DataTypes.BOOLEAN, allowNull: true }
    };

    // NOTE: the original excluded 'hash' (a field that doesn't exist) so the
    // default scope silently leaked password hashes. We exclude 'password'.
    const options = {
        defaultScope: {
            attributes: { exclude: ['password'] }
        },
        scopes: {
            withHash: { attributes: {}, }
        }
    };

    return sequelize.define('users', attributes, options);
}
