const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        id: {

            type: DataTypes.INTEGER,
            defaultValue: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        provincia: { type: DataTypes.STRING, allowNull: false }
    };

    const options = {
        tableName: 'provincias',
        freezeTableName: true,
        defaultScope: {
        },
        scopes: {
        }
    };

    return sequelize.define('provincia', attributes, options);
}
