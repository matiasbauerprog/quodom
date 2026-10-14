/**
 * Agrega a `users` las columnas de facturación y deja el código de área parejo.
 *
 * Hace falta un script porque `model.sync()` crea una tabla que falta pero
 * NUNCA hace ALTER sobre una que ya existe: sin esto la base sigue sin las
 * columnas y el perfil falla al guardar, con el modelo diciendo que están.
 *
 * `ALTER TABLE ... ADD COLUMN` no toca las filas existentes, así que ninguna
 * cuenta se pierde. Es idempotente: si la columna ya está, la saltea.
 */
require('dotenv').config();
const db = require('../helpers/db');

const COLUMNAS = [
  ['empresa', 'VARCHAR(255)'],
  ['cuit', 'VARCHAR(255)'],
  ['facturaA', 'TINYINT(1)']
];

const COD_AREA = '011';

async function main() {
  await db.ready;

  const [cols] = await db.sequelize.query('PRAGMA table_info(users)');
  const existentes = new Set(cols.map(c => c.name));

  for (const [nombre, tipo] of COLUMNAS) {
    if (existentes.has(nombre)) {
      console.log('  ' + nombre + ': ya estaba');
      continue;
    }
    await db.sequelize.query('ALTER TABLE users ADD COLUMN "' + nombre + '" ' + tipo);
    console.log('  ' + nombre + ': agregada');
  }

  // El campo quedó fijo en la app, así que un '11' guardado mostraría '011' y
  // guardaría otra cosa. El mensaje de WhatsApp arma codArea + telefono.
  const [, meta] = await db.sequelize.query(
    'UPDATE users SET codArea = :cod WHERE codArea IS NULL OR codArea <> :cod',
    { replacements: { cod: COD_AREA } }
  );
  console.log('  codArea normalizado a ' + COD_AREA + ' en ' + (meta && meta.changes != null ? meta.changes : '?') + ' usuarios');

  // La base corre en WAL y sólo quodom.sqlite se commitea: sin el checkpoint,
  // el archivo que se sube puede no tener estos cambios adentro.
  const [[wal]] = await db.sequelize.query('PRAGMA wal_checkpoint(TRUNCATE)');
  console.log('WAL checkpointed into quodom.sqlite:', JSON.stringify(wal));

  await db.sequelize.close();
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('Migrar-empresa failed:', err); process.exit(1); });
