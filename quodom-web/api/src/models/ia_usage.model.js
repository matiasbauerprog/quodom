const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('ia_usage', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  iduser: { type: DataTypes.INTEGER, allowNull: false },
  fecha: { type: DataTypes.DATEONLY, allowNull: false },
  contador: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  tableName: 'ia_usage',
  indexes: [
    { unique: true, fields: ['iduser', 'fecha'] }
  ]
});
