require('rootpath')();
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const app = express();
// Render puts proxies in front of the app, and the frontend's /api rewrite
// adds one more hop. Without the right count every request carries a proxy's
// address, and the per-address limits on sign-in and password recovery would
// lock out every user at once. GET / echoes the address it sees so this can
// be checked against the caller's real one after a deploy.
app.set('trust proxy', parseInt(process.env.TRUST_PROXY_HOPS, 10) || 1);

const cors = require('cors');
const helmet = require('helmet');
const errorHandler = require('./middleware/error-handler');
const pkg = require('../package.json');

app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
if (process.env.NODE_ENV !== 'test') {
  const morgan = require('morgan');
  app.use(morgan('dev'));
}

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const IMG_EXTS = ['.png', '.jpg', '.jpeg', '.webp'];

app.get('/img/producto/:id', (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return next();
  for (const ext of IMG_EXTS) {
    const p = path.join(UPLOADS_DIR, 'producto', id + ext);
    if (fs.existsSync(p)) {
      res.set('Cache-Control', 'public, max-age=3600');
      return res.sendFile(p);
    }
  }
  res.status(404).json({ res: false, message: 'Image not found' });
});

app.use('/img', express.static(UPLOADS_DIR, { fallthrough: true, maxAge: '1h' }));

// api routes (added task by task)
app.use('/users', require('./routes/users.routes'));
app.use('/categorias', require('./routes/categorias.route'));
app.use('/productos', require('./routes/productos.route'));
app.use('/busqueda', require('./routes/busqueda.route'));
app.use('/hist_busquedas', require('./routes/hist_busquedas.route'));
app.use('/quodom', require('./routes/quodom.route'));
app.use('/quodom_lines', require('./routes/quodom_lines.route'));
app.use('/user_direcciones', require('./routes/user_direcciones.route'));
app.use('/provincias', require('./routes/provincias.route'));
app.use('/localidades', require('./routes/localidades.route'));
app.use('/oper_notificaciones', require('./routes/oper_notificaciones.route'));
app.use('/api/ia', require('./routes/ia.route'));

app.get('/', (req, res) => {
  res.json({
    message: 'Quodom API',
    name: pkg.name,
    version: pkg.version,
    fecha: new Date(),
    ip: req.ip
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
