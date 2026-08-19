// Drops and recreates the Quodom tables. Needed once when idrubro is introduced:
// model.sync() creates a missing table but never ALTERs an existing one, so the
// old quodom_headers would keep its old columns forever if we only deleted rows.
// Users, catalog, addresses and notifications are left untouched.
require('dotenv').config();
const db = require('../helpers/db');

async function main() {
    await db.ready;
    const qi = db.sequelize.getQueryInterface();

    // Lines first: they reference the header.
    await qi.dropTable('quodom_lines');
    await qi.dropTable('quodom_headers');

    await db.Quodom.sync();
    await db.Quodom_Lines.sync();

    const [cols] = await db.sequelize.query('PRAGMA table_info(quodom_headers)');
    console.log('quodom tables recreated. quodom_headers columns:', cols.map(c => c.name).join(', '));

    // The database runs in WAL mode, so writes live in quodom.sqlite-wal until a
    // checkpoint folds them into quodom.sqlite. Only quodom.sqlite is tracked in
    // git (the -wal and -shm files are ignored), so without this the file someone
    // commits after running this script can silently lag the database they just
    // built. TRUNCATE also empties the WAL, leaving nothing behind to confuse the
    // next reader.
    const [[wal]] = await db.sequelize.query('PRAGMA wal_checkpoint(TRUNCATE)');
    console.log('WAL checkpointed into quodom.sqlite:', JSON.stringify(wal));

    await db.sequelize.close();
}

main()
    .then(() => process.exit(0))
    .catch(err => { console.error('Reset-quodoms failed:', err); process.exit(1); });
