/**
 * Agrega a `quodom_headers` la columna `detalle`: la descripción opcional del
 * Quodom, aparte de su nombre (que vive en `descripcion`).
 *
 * Hace falta un script porque `model.sync()` crea una tabla que falta pero
 * NUNCA hace ALTER sobre una que ya existe: sin esto el modelo pide una columna
 * que la base no tiene y falla toda lectura de Quodoms.
 *
 * `ADD COLUMN` no toca las filas: los Quodoms existentes quedan con `detalle`
 * en null, que es "sin descripción". Es idempotente.
 */
require('dotenv').config();
const db = require('../helpers/db');

const COLUMNAS = [
  ['detalle', 'TEXT']
];

async function main() {
  await db.ready;

  const [cols] = await db.sequelize.query('PRAGMA table_info(quodom_headers)');
  const existentes = new Set(cols.map(c => c.name));

  for (const [nombre, tipo] of COLUMNAS) {
    if (existentes.has(nombre)) {
      console.log('  ' + nombre + ': ya estaba');
      continue;
    }
    await db.sequelize.query('ALTER TABLE quodom_headers ADD COLUMN "' + nombre + '" ' + tipo);
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
  .catch(err => { console.error('Migrar-detalle-quodom failed:', err); process.exit(1); });
