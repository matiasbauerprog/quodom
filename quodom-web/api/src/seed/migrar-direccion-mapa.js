/**
 * Agrega a `users_direcciones` las columnas del mapa.
 *
 * Hace falta un script porque `model.sync()` crea una tabla que falta pero
 * NUNCA hace ALTER sobre una que ya existe: sin esto la base sigue sin las
 * columnas y guardar una dirección falla, con el modelo diciendo que están.
 *
 * `ALTER TABLE ... ADD COLUMN` no toca las filas existentes, así que ninguna
 * dirección se pierde: las viejas quedan con placeid y coordenadas en null,
 * que es un estado válido. Es idempotente: si la columna ya está, la saltea.
 */
require('dotenv').config();
const db = require('../helpers/db');

const COLUMNAS = [
  ['placeid', 'VARCHAR(255)'],
  ['lat', 'FLOAT'],
  ['lng', 'FLOAT'],
  ['coords_actualizado', 'DATETIME']
];

async function main() {
  await db.ready;

  const [cols] = await db.sequelize.query('PRAGMA table_info(users_direcciones)');
  const existentes = new Set(cols.map(c => c.name));

  for (const [nombre, tipo] of COLUMNAS) {
    if (existentes.has(nombre)) {
      console.log('  ' + nombre + ': ya estaba');
      continue;
    }
    await db.sequelize.query('ALTER TABLE users_direcciones ADD COLUMN "' + nombre + '" ' + tipo);
    console.log('  ' + nombre + ': agregada');
  }

  // La base corre en WAL y sólo quodom.sqlite se commitea: sin el checkpoint,
  // el archivo que se sube puede no tener estos cambios adentro.
  const [[wal]] = await db.sequelize.query('PRAGMA wal_checkpoint(TRUNCATE)');
  console.log('WAL checkpointed into quodom.sqlite:', JSON.stringify(wal));

  await db.sequelize.close();
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('Migrar-direccion-mapa failed:', err); process.exit(1); });
