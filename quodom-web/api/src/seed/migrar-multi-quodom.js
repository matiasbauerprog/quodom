/**
 * Borra el índice único parcial que impedía dos Quodoms abiertos del mismo
 * rubro. Sacarlo del modelo no alcanza: `model.sync()` crea una tabla que falta
 * pero NUNCA hace ALTER sobre una que ya existe, así que en cualquier base ya
 * creada el índice sigue vivo y SQLite rechaza el segundo Quodom con un error
 * de constraint que nadie espera. Es idempotente.
 */
require('dotenv').config();
const db = require('../helpers/db');

async function main() {
  await db.ready;
  await db.sequelize.query('DROP INDEX IF EXISTS quodom_abierto_por_rubro');
  console.log('  índice quodom_abierto_por_rubro: borrado si existía');

  const [indices] = await db.sequelize.query("PRAGMA index_list('quodom_headers')");
  console.log('  índices que quedan:', indices.map(i => i.name).join(', ') || '(ninguno)');

  // La base corre en WAL y sólo quodom.sqlite se commitea: sin el checkpoint,
  // el archivo que se sube puede no tener este cambio adentro.
  const [[wal]] = await db.sequelize.query('PRAGMA wal_checkpoint(TRUNCATE)');
  console.log('WAL checkpointed into quodom.sqlite:', JSON.stringify(wal));

  await db.sequelize.close();
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('Migrar-multi-quodom failed:', err); process.exit(1); });
