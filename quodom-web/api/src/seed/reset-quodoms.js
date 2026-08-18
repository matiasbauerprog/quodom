// Drops and recreates the Quodom tables. Needed once when idrubro is introduced:
// model.sync() creates a missing table but never ALTERs an existing one, so the
// old quodom_headers would keep its old columns forever if we only deleted rows.
// Users, catalog, addresses and notifications are left untouched.
require('dotenv').config();
const db = require('../helpers/db');

(async () => {
    await db.ready;
    const qi = db.sequelize.getQueryInterface();

    // Lines first: they reference the header.
    await qi.dropTable('quodom_lines');
    await qi.dropTable('quodom_headers');

    await db.Quodom.sync();
    await db.Quodom_Lines.sync();

    const [cols] = await db.sequelize.query('PRAGMA table_info(quodom_headers)');
    console.log('quodom tables recreated. quodom_headers columns:', cols.map(c => c.name).join(', '));

    await db.sequelize.close();
})();
