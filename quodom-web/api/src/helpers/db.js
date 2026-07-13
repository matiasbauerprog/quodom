const path = require('path');
const { Sequelize } = require('sequelize');
const { createViews } = require('./views');

const db = {};
module.exports = db;

const storage = process.env.DB_STORAGE === ':memory:'
    ? ':memory:'
    : (process.env.DB_STORAGE
        ? path.resolve(process.env.DB_STORAGE)
        : path.join(__dirname, '../../quodom.sqlite'));

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage,
    logging: false,
    retry: { max: 5 },
    pool: { min: 0, max: 1 }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;
db.ready = initialize();

async function initialize() {
    if (storage !== ':memory:') {
        await sequelize.query('PRAGMA journal_mode = WAL;');
        await sequelize.query('PRAGMA busy_timeout = 30000;');
    }

    db.User = require('../models/users.model')(sequelize);
    db.Category = require('../models/categorias.model')(sequelize);
    db.Products = require('../models/productos.model')(sequelize);
    db.productos_atributos = require('../models/productos_atributos.model')(sequelize);
    db.Quodom = require('../models/quodom.model')(sequelize);
    db.Quodom_Lines = require('../models/quodom_lines.model')(sequelize);
    db.user_direcciones = require('../models/users_direcciones.model')(sequelize);
    db.provincia = require('../models/provincias.model')(sequelize);
    db.localidad = require('../models/localidades.model')(sequelize);
    db.hist_busquedas = require('../models/hist_busquedas.model')(sequelize);
    db.oper_notificaciones = require('../models/oper_notificaciones.model')(sequelize);
    db.series = require('../models/series.model')(sequelize);

    // View-backed models: NOT synced (created as SQL views below)
    db.v_Busqueda = require('../models/v_Busqueda.model')(sequelize);
    db.v_Quodoms = require('../models/v_Quodoms.model')(sequelize);
    db.v_Quodoms_lines = require('../models/v_Quodoms_Lines.model')(sequelize);
    db.v_InfoCompradors = require('../models/v_InfoCompradors')(sequelize);

    const tableModels = [db.User, db.Category, db.Products, db.productos_atributos,
        db.Quodom, db.Quodom_Lines, db.user_direcciones, db.provincia, db.localidad,
        db.hist_busquedas, db.oper_notificaciones, db.series];

    for (const model of tableModels) {
        await model.sync();
    }

    await createViews(sequelize);
}
