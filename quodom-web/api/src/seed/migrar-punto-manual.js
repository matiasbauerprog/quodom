/**
 * Agrega a `users_direcciones` la columna `punto_manual`.
 *
 * Hace falta un script porque `model.sync()` crea una tabla que falta pero
 * NUNCA hace ALTER sobre una que ya existe: sin esto la base sigue sin la
 * columna y guardar una dirección falla, con el modelo diciendo que está.
 *
 * `ALTER TABLE ... ADD COLUMN` no toca las filas existentes, así que ninguna
 * dirección se pierde: las viejas quedan con `punto_manual` en null, que se
 * lee como "no lo marcó a mano" y es exactamente lo que corresponde. Es
 * idempotente: si la columna ya está, la saltea.
 */
require('dotenv').config();
const db = require('../helpers/db');

const COLUMNAS = [
  ['punto_manual', 'BOOLEAN']
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
  .catch(err => { console.error('Migrar-punto-manual failed:', err); process.exit(1); });
