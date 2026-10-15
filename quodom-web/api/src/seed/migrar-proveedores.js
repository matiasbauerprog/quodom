/**
 * Crea las dos tablas de la mitad B en una base que ya existe.
 *
 * A diferencia de las otras migraciones, acá `model.sync()` SÍ alcanza: crea una
 * tabla que falta. El script existe igual para dejar el paso explícito, hacer el
 * checkpoint del WAL y poder verificar el blob commiteado (§6).
 */
require('dotenv').config();
const db = require('../helpers/db');

async function main() {
  await db.ready;

  const [t] = await db.sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('quodom_proveedores','lugares_sinwhatsapp')");
  console.log('  tablas presentes:', t.map(x => x.name).join(', ') || '(ninguna)');

  const [[wal]] = await db.sequelize.query('PRAGMA wal_checkpoint(TRUNCATE)');
  console.log('WAL checkpointed into quodom.sqlite:', JSON.stringify(wal));

  await db.sequelize.close();
}

main().then(() => process.exit(0)).catch(err => { console.error('Migrar-proveedores failed:', err); process.exit(1); });
