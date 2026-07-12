require('rootpath')();
require('dotenv').config();
const express = require('express');
const app = express();

const cors = require('cors');
const helmet = require('helmet');
const errorHandler = require('./middleware/error-handler');
const pkg = require('../package.json');

app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(helmet());
if (process.env.NODE_ENV !== 'test') {
  const morgan = require('morgan');
  app.use(morgan('dev'));
}

// api routes (added task by task)
app.use('/users', require('./routes/users.routes'));
app.use('/categorias', require('./routes/categorias.route'));
app.use('/productos', require('./routes/productos.route'));
app.use('/busqueda', require('./routes/busqueda.route'));
app.use('/hist_busquedas', require('./routes/hist_busquedas.route'));
app.use('/quodom', require('./routes/quodom.route'));
app.use('/quodom_lines', require('./routes/quodom_lines.route'));

app.get('/', (req, res) => {
  res.json({
    message: 'Quodom API',
    name: pkg.name,
    version: pkg.version,
    fecha: new Date()
  });
});

app.all('*', (req, res) => {
  res.status(404).json({ res: false, message: 'Route-not-found' });
});

app.use(errorHandler);

module.exports = app;

if (require.main === module) {
  const db = require('./helpers/db');
  db.ready.then(() => {
    const port = process.env.PORT || 3999;
    app.listen(port, () => console.log('Server listening on port ' + port));
  });
}
