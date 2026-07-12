# Quodom Web — Plan 1: Harness de Claude Code + API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `quodom-web/api/` (Express + Sequelize + SQLite), espejo de la API original sin vendedores ni pagos, con seeding desde Excel y exportación por WhatsApp — más el harness de Claude Code del repo.

**Architecture:** Port 1:1 de `F:\backup\Command Soluciones\Quodom\API\src` (JavaScript, misma estructura controllers/models/routes/helpers/middleware) cambiando MySQL→SQLite. Las vistas SQL (`v_*`) se recrean como vistas SQLite. Config sensible vía variables de entorno (`.env`). Tests de integración con Jest + Supertest contra SQLite en memoria.

**Tech Stack:** Node.js (JS, CommonJS), Express 4, Sequelize 6 + sqlite3, express-jwt 6, jsonwebtoken 8, bcryptjs, Joi, nodemailer, ejs, xlsx, Jest, Supertest.

**Referencia (solo lectura):** la API original vive en `F:\backup\Command Soluciones\Quodom\API\src\`. En este plan se abrevia como `<API>`.

**Spec:** `docs/superpowers/specs/2026-07-12-quodom-web-design.md`

**Convenciones del port (aplican a TODOS los tasks):**
- Se eliminan: `appSign`/`claveprivada`/`js-sha256` (firma de la app móvil), `tokenNotification`/push de Expo, `users_logs` y vinculación de dispositivos, todo lo de vendedores/pagos/zonas, `@googlemaps`, `mobbex`.
- Secretos y config van en `.env` (nunca en archivos commiteados). `db.config.json`/`auth.config.js` originales NO se copian.
- Formato de respuesta de error se conserva: `{ res: false, message: '...' }`.
- Los tests corren con `DB_STORAGE=':memory:'` (cada archivo de test = proceso Jest separado = DB propia).

---

### Task 1: Harness de Claude Code

**Files:**
- Rewrite: `claude.md` (raíz del repo)
- Create: `.claude/settings.json`

- [ ] **Step 1: Reescribir `claude.md`** con este contenido exacto (reemplaza todo el contenido actual, que describe la deprecada `quodom-new/`):

```markdown
# Quodom Web - Reglas de Desarrollo (claude.md)

Transformación de Quodom 1.0 (React Native + API MySQL) en una webapp, **sin usuarios vendedores y sin pasarela de pago**.

## 1. Proyecto activo y referencias
- **Proyecto activo:** todo el código nuevo vive en `quodom-web/` (`api/` y `app/`).
- **Referencia de solo lectura:** el proyecto original está en `F:\backup\Command Soluciones\Quodom\API` y `...\APP`. NUNCA modificarlos.
- **Deprecado:** `quodom-new/` es una reescritura anterior abandonada. No tocarla ni tomarla como referencia de arquitectura.
- **Spec vigente:** `docs/superpowers/specs/2026-07-12-quodom-web-design.md`.

## 2. Arquitectura
- `quodom-web/api/`: Express + Sequelize + **SQLite**, en JavaScript, espejo 1:1 de la estructura original (`controllers/`, `models/`, `routes/`, `helpers/`, `middleware/`). Config por variables de entorno (`.env`, nunca commitear secretos).
- `quodom-web/app/`: React + Vite + **TypeScript**, CSS plano, espejo de las screens/navegación de la APP original.
- La base se puebla con `npm run seed` leyendo `Documentacion 2.0/Categorias/Migracion.xlsx` (62 subcategorías, 644 productos, IDs reales).

## 3. Reglas de producto
- No existe lógica de vendedores (cotizaciones, ofertas, zonas, rubros, calificaciones, bancos) ni de pagos.
- Navegación guest: catálogo, búsqueda y armado del Quodom sin login (Quodom de invitado en `localStorage`). El login se exige para enviar por WhatsApp, Mis Quodoms, perfil, direcciones, notificaciones y Modo IA.
- Al loguearse, el Quodom de invitado migra automáticamente al backend.
- El flujo termina generando un link `https://wa.me/?text=...` con el detalle y datos de contacto.

## 4. Reglas visuales (frontend)
- Mobile-first estricto. Breakpoints: tablet `@media (min-width: 601px) and (max-width: 1024px)`, desktop `@media (min-width: 1025px)`.
- Paleta: fondo `#F6EE5D`, acento `#706F9A`, éxito `#2DAB66`, texto `#45444C`, tarjetas `#FFFFFF`.
- Forma de hoja: `border-top-left-radius: 8px; border-bottom-right-radius: 8px;`
- Fuentes Google Fonts: Prompt, Jaldi, Work Sans, Montserrat.
- HTML semántico estricto (`header`, `nav`, `main`, `section`, `article`, `button`, `label`/`input`).

## 5. Idioma y convenciones
- **UI:** Español (textos del Quodom original).
- **Código técnico y commits:** Inglés.
- Tests de API: integración con SQLite real (en memoria), sin mocks de base de datos.
```

- [ ] **Step 2: Crear `.claude/settings.json`** (project settings commiteados — usar la skill `update-config` si está disponible; el contenido final debe ser):

```json
{
  "permissions": {
    "allow": [
      "Read(//f/backup/Command Soluciones/Quodom/**)",
      "Bash(npm install:*)",
      "Bash(npm test:*)",
      "Bash(npm run dev:*)",
      "Bash(npm run seed:*)",
      "Bash(npm run build:*)",
      "Bash(npm run test:*)",
      "Bash(node:*)",
      "Bash(npx tsc:*)",
      "Bash(npx vite:*)"
    ]
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add claude.md .claude/settings.json
git commit -m "chore: replace CLAUDE.md with quodom-web rules and add project permission allowlist"
```

---

### Task 2: Scaffold de la API + server + primer test

**Files:**
- Create: `quodom-web/api/package.json`
- Create: `quodom-web/api/.env.example`
- Create: `quodom-web/api/.gitignore`
- Create: `quodom-web/api/src/server.js`
- Create: `quodom-web/api/src/middleware/error-handler.js`
- Create: `quodom-web/api/tests/setup-env.js`
- Test: `quodom-web/api/tests/server.test.js`

- [ ] **Step 1: Crear `quodom-web/api/package.json`**

```json
{
  "name": "quodom-web-api",
  "version": "1.0.0",
  "description": "Quodom Web API - Express + Sequelize + SQLite (no vendors, no payments)",
  "license": "MIT",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "seed": "node src/seed/seed.js",
    "test": "jest --runInBand"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "ejs": "^3.1.10",
    "express": "^4.19.2",
    "express-jwt": "^6.1.2",
    "helmet": "^4.6.0",
    "joi": "^17.13.3",
    "jsonwebtoken": "^8.5.1",
    "nodemailer": "^6.9.14",
    "rootpath": "^0.1.2",
    "sequelize": "^6.37.3",
    "sqlite3": "^5.1.7",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "morgan": "^1.10.0",
    "nodemon": "^3.1.4",
    "supertest": "^7.0.0"
  },
  "jest": {
    "testEnvironment": "node",
    "setupFiles": ["<rootDir>/tests/setup-env.js"]
  }
}
```

Nota: `express-jwt@6` a propósito (misma API `jwt({ secret, algorithms })` que el original; v7+ cambió la firma).

- [ ] **Step 2: Crear `quodom-web/api/.gitignore`**

```
node_modules/
.env
quodom.sqlite
```

- [ ] **Step 3: Crear `quodom-web/api/.env.example`**

```
PORT=3999
JWT_SECRET=change-me-in-production
DB_STORAGE=./quodom.sqlite
APP_URL=http://localhost:5173
EMAIL_ENABLED=false
SMTP_HOST=
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
SMTP_FROM=QUODOM <no-reply@quodom.com.ar>
```

- [ ] **Step 4: Crear `quodom-web/api/src/middleware/error-handler.js`** — copia exacta de `<API>\src\middleware\error-handler.js` (sin cambios; ya devuelve `{ res: false, message }` con status 400/401/404/500).

- [ ] **Step 5: Crear `quodom-web/api/tests/setup-env.js`**

```js
process.env.NODE_ENV = 'test';
process.env.DB_STORAGE = ':memory:';
process.env.JWT_SECRET = 'test-secret';
process.env.EMAIL_ENABLED = 'false';
```

- [ ] **Step 6: Escribir el test que falla** — `quodom-web/api/tests/server.test.js`

```js
const request = require('supertest');
const app = require('../src/server');

describe('GET /', () => {
  it('returns API info', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Quodom API');
    expect(res.body.name).toBe('quodom-web-api');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ res: false, message: 'Route-not-found' });
  });
});
```

- [ ] **Step 7: Instalar dependencias y verificar que el test falla**

```bash
cd quodom-web/api && npm install && npm test
```
Expected: FAIL — `Cannot find module '../src/server'`.

- [ ] **Step 8: Crear `quodom-web/api/src/server.js`**

```js
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

app.get('/', (req, res) => {
  res.json({
    message: 'Quodom API',
    name: pkg.name,
    version: pkg.version,
    fecha: new Date()
  });
});

app.get('*', (req, res) => {
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
```

- [ ] **Step 9: Correr el test y verificar que pasa**

```bash
cd quodom-web/api && npm test
```
Expected: PASS (2 tests).

- [ ] **Step 10: Commit**

```bash
git add quodom-web/api
git commit -m "feat: scaffold quodom-web API with express server, error handler and test setup"
```

---

### Task 3: Base de datos — modelos y vistas SQLite

**Files:**
- Create: `quodom-web/api/src/helpers/db.js`
- Create: `quodom-web/api/src/helpers/views.js`
- Create: `quodom-web/api/src/models/users.model.js`
- Create: `quodom-web/api/src/models/categorias.model.js`
- Create: `quodom-web/api/src/models/productos.model.js`
- Create: `quodom-web/api/src/models/productos_atributos.model.js`
- Create: `quodom-web/api/src/models/quodom.model.js`
- Create: `quodom-web/api/src/models/quodom_lines.model.js`
- Create: `quodom-web/api/src/models/users_direcciones.model.js`
- Create: `quodom-web/api/src/models/provincias.model.js`
- Create: `quodom-web/api/src/models/localidades.model.js`
- Create: `quodom-web/api/src/models/hist_busquedas.model.js`
- Create: `quodom-web/api/src/models/oper_notificaciones.model.js`
- Create: `quodom-web/api/src/models/series.model.js`
- Create: `quodom-web/api/src/models/v_Busqueda.model.js`
- Create: `quodom-web/api/src/models/v_Quodoms.model.js`
- Create: `quodom-web/api/src/models/v_Quodoms_Lines.model.js`
- Create: `quodom-web/api/src/models/v_InfoCompradors.js`
- Test: `quodom-web/api/tests/db.test.js`

Cambios respecto del original (todo lo demás se copia igual):
- `users.model.js`: se eliminan los campos de vendedor/pagos/push: `cuit`, `RazonSocial`, `CondicionVendedor`, `esVendedor`, `Fact_*` (4 campos), `BANK_*` (4 campos), `tokenNotification`. `TINYINT` → `BOOLEAN`.
- `categorias.model.js`: `id` pasa de UUID a `INTEGER` primaryKey (los IDs reales del Excel son numéricos y `productos.categoria` es INTEGER). Se agrega `refreshImage` igual que el original.
- `productos.model.js`: `id` `INTEGER` primaryKey explícito; se eliminan `createdBy`, `hash`, `atributoVendedor1`, `atributoVendedor2` (creación de productos por vendedores no existe; el catálogo viene del seed); el resto de campos pasa a `allowNull: true` excepto `nombreproducto`, `categoria`, `categoriaPadre`.
- `productos_atributos.model.js`: se agrega `orden: { type: DataTypes.INTEGER, allowNull: true }` (el controller original ordena por `orden` pero el modelo no lo declaraba; en MySQL la columna existía).
- `users_direcciones.model.js`: se elimina `idzona` (concepto de zonas de vendedores).
- `quodom.model.js`, `quodom_lines.model.js`, `provincias.model.js`, `localidades.model.js`, `hist_busquedas.model.js`, `oper_notificaciones.model.js`, `series.model.js`: copia exacta del original.
- Modelos de vista (`v_*`): mismos atributos que el original pero con `options = { tableName: '<nombre exacto de la vista>', freezeTableName: true, timestamps: false }`, y se agrega el atributo `createdAt: { type: DataTypes.DATE }` a `v_Quodoms` (el controller ordena por él). En `v_Quodoms_Lines` se eliminan `cantProveedores` y `cantEnZona` (conteos de vendedores).

- [ ] **Step 1: Escribir el test que falla** — `quodom-web/api/tests/db.test.js`

```js
const db = require('../src/helpers/db');

describe('database initialization', () => {
  beforeAll(async () => { await db.ready; });

  it('creates all tables', async () => {
    const [tables] = await db.sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    const names = tables.map(t => t.name);
    for (const t of ['users', 'categorias', 'productos', 'productos_atributos',
      'quodom_headers', 'quodom_lines', 'users_direcciones', 'provincias',
      'localidades', 'hist_busquedas', 'oper_notificaciones', 'series']) {
      expect(names).toContain(t);
    }
  });

  it('creates all views', async () => {
    const [views] = await db.sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='view'"
    );
    const names = views.map(v => v.name);
    for (const v of ['v_Busquedas', 'v_Quodoms', 'v_Quodoms_Lines', 'v_InfoCompradors']) {
      expect(names).toContain(v);
    }
  });

  it('computes cantproductos and porccompletado in v_Quodoms', async () => {
    const q = await db.Quodom.create({ descripcion: 'Test', createdBy: 'u1', estado: 'CREADO', nro: 'QD-1' });
    await db.Quodom_Lines.create({ idquodom: q.id, idproducto: 1, cantidad: 2, nombreAtributo1: 'Color', atributo1: null, createdBy: 'u1' });
    await db.Quodom_Lines.create({ idquodom: q.id, idproducto: 2, cantidad: 1, nombreAtributo1: 'Color', atributo1: 'Blanco', createdBy: 'u1' });
    const vq = await db.v_Quodoms.findOne({ where: { id: q.id } });
    expect(vq.cantproductos).toBe(2);
    expect(Number(vq.porccompletado)).toBe(50);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd quodom-web/api && npm test tests/db.test.js
```
Expected: FAIL — `Cannot find module '../src/helpers/db'`.

- [ ] **Step 3: Crear los modelos.** Copiar cada modelo desde `<API>\src\models\` aplicando los cambios listados arriba. Los dos con cambios estructurales quedan así:

`src/models/users.model.js`:
```js
const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            allowNull: false,
            primaryKey: true
        },
        username: { type: DataTypes.STRING, allowNull: false },
        email: { type: DataTypes.STRING, allowNull: false },
        nombre: { type: DataTypes.STRING, allowNull: true },
        apellido: { type: DataTypes.STRING, allowNull: true },
        password: { type: DataTypes.STRING, allowNull: false },
        role: { type: DataTypes.STRING, allowNull: true },
        activo: { type: DataTypes.BOOLEAN, allowNull: false },
        emailValidado: { type: DataTypes.BOOLEAN, allowNull: false },
        dni: { type: DataTypes.STRING, allowNull: true },
        telefono: { type: DataTypes.STRING, allowNull: false },
        foto: { type: DataTypes.STRING, allowNull: true },
        refreshFoto: { type: DataTypes.STRING, allowNull: true },
        codArea: { type: DataTypes.STRING, allowNull: true }
    };

    // NOTE: the original excluded 'hash' (a field that doesn't exist) so the
    // default scope silently leaked password hashes. We exclude 'password'.
    const options = {
        defaultScope: {
            attributes: { exclude: ['password'] }
        },
        scopes: {
            withHash: { attributes: {}, }
        }
    };

    return sequelize.define('users', attributes, options);
}
```

`src/models/productos.model.js`:
```js
const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
        nombreproducto: { type: DataTypes.STRING, allowNull: false },
        descripcion: { type: DataTypes.STRING, allowNull: true },
        categoria: { type: DataTypes.INTEGER, allowNull: false },
        categoriaPadre: { type: DataTypes.INTEGER, allowNull: false },
        idatributo: { type: DataTypes.INTEGER, allowNull: true },
        nombreatributo: { type: DataTypes.STRING, allowNull: true },
        unidadmedida: { type: DataTypes.INTEGER, allowNull: true },
        nombreunidadmedida: { type: DataTypes.STRING, allowNull: true },
        imagen: { type: DataTypes.STRING, allowNull: true },
        refreshImagen: { type: DataTypes.STRING, allowNull: true },
        atributo1: { type: DataTypes.STRING, allowNull: true },
        atributo2: { type: DataTypes.STRING, allowNull: true }
    };

    return sequelize.define('productos', attributes, {});
}
```

`src/models/categorias.model.js`:
```js
const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
        nombrecategoria: { type: DataTypes.STRING, allowNull: false },
        idcategoriapadre: { type: DataTypes.INTEGER, allowNull: false },
        activa: { type: DataTypes.BOOLEAN, allowNull: false },
        imagen: { type: DataTypes.STRING, allowNull: true },
        refreshImage: { type: DataTypes.STRING, allowNull: true },
        orden: { type: DataTypes.INTEGER, allowNull: false }
    };

    return sequelize.define('categorias', attributes, {});
}
```

Ejemplo de modelo de vista — `src/models/v_Busqueda.model.js` (los otros tres siguen el mismo patrón de options):
```js
const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        nombre: { type: DataTypes.STRING, allowNull: true },
        descripcion: { type: DataTypes.STRING, allowNull: true },
        imagen: { type: DataTypes.STRING, allowNull: true },
        refreshImagen: { type: DataTypes.STRING, allowNull: true }
    };

    const options = { tableName: 'v_Busquedas', freezeTableName: true, timestamps: false };

    return sequelize.define('v_Busqueda', attributes, options);
}
```

- [ ] **Step 4: Crear `quodom-web/api/src/helpers/views.js`**

```js
module.exports = { createViews };

async function createViews(sequelize) {
    await sequelize.query('DROP VIEW IF EXISTS v_Busquedas');
    await sequelize.query(`
        CREATE VIEW v_Busquedas AS
        SELECT p.id, p.nombreproducto AS nombre, p.descripcion, p.imagen, p.refreshImagen
        FROM productos p`);

    await sequelize.query('DROP VIEW IF EXISTS v_Quodoms');
    await sequelize.query(`
        CREATE VIEW v_Quodoms AS
        SELECT q.id, q.descripcion, q.createdBy, q.estado, q.nro, q.iddireccion,
               q.fechaenvio, q.fechavencimientoenvio, q.fechavencimientoaceptacion,
               q.createdAt, q.updatedAt,
               (SELECT COUNT(*) FROM quodom_lines ql WHERE ql.idquodom = q.id) AS cantproductos,
               COALESCE((SELECT ROUND(100.0 * SUM(
                   CASE WHEN (ql.nombreAtributo1 IS NULL OR ql.atributo1 IS NOT NULL)
                         AND (ql.nombreAtributo2 IS NULL OR ql.atributo2 IS NOT NULL)
                        THEN 1 ELSE 0 END) / COUNT(*))
                 FROM quodom_lines ql WHERE ql.idquodom = q.id), 0) AS porccompletado,
               CAST(julianday(q.fechavencimientoenvio) - julianday('now') AS INTEGER) AS diasparavencimientoenvio,
               CAST(julianday(q.fechavencimientoaceptacion) - julianday('now') AS INTEGER) AS diasparavencimientoaceptacion
        FROM quodom_headers q
        WHERE COALESCE(q.ocultar, 0) = 0`);

    await sequelize.query('DROP VIEW IF EXISTS v_Quodoms_Lines');
    await sequelize.query(`
        CREATE VIEW v_Quodoms_Lines AS
        SELECT ql.id, ql.idquodom, ql.idproducto, ql.cantidad, ql.categoria,
               ql.nombreCategoria, ql.nombreProducto, ql.detalleProducto, ql.marca, ql.unidad,
               ql.atributo1, ql.atributo2, ql.nombreAtributo1, ql.nombreAtributo2,
               p.imagen, p.refreshImagen,
               (CASE WHEN ql.nombreAtributo1 IS NOT NULL AND ql.atributo1 IS NULL THEN 1 ELSE 0 END +
                CASE WHEN ql.nombreAtributo2 IS NOT NULL AND ql.atributo2 IS NULL THEN 1 ELSE 0 END) AS atributosFaltantes
        FROM quodom_lines ql
        LEFT JOIN productos p ON p.id = ql.idproducto`);

    await sequelize.query('DROP VIEW IF EXISTS v_InfoCompradors');
    await sequelize.query(`
        CREATE VIEW v_InfoCompradors AS
        SELECT q.id AS idquodom,
               COALESCE(u.nombre, '') || ' ' || COALESCE(u.apellido, '') AS NombreComprador,
               COALESCE(u.codArea, '') || u.telefono AS telefono,
               u.email,
               COALESCE(d.calle, '') || ' ' || COALESCE(d.numero, '') AS Direccion,
               d.provincia AS Provincia,
               d.localidad AS Localidad,
               d.cp,
               d.observaciones
        FROM quodom_headers q
        INNER JOIN users u ON u.id = q.createdBy
        LEFT JOIN users_direcciones d ON d.id = q.iddireccion`);
}
```

- [ ] **Step 5: Crear `quodom-web/api/src/helpers/db.js`**

```js
const path = require('path');
const { Sequelize } = require('sequelize');
const { createViews } = require('./views');

module.exports = db = {};

const storage = process.env.DB_STORAGE === ':memory:'
    ? ':memory:'
    : (process.env.DB_STORAGE
        ? path.resolve(process.env.DB_STORAGE)
        : path.join(__dirname, '../../quodom.sqlite'));

const sequelize = new Sequelize({ dialect: 'sqlite', storage, logging: false });

db.sequelize = sequelize;
db.Sequelize = Sequelize;
db.ready = initialize();

async function initialize() {
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
```

Importante: NO usar `sequelize.sync()` global — intentaría crear tablas para los modelos de vista y chocaría con las vistas SQL. Solo `model.sync()` por tabla, como está arriba.

- [ ] **Step 6: Correr el test y verificar que pasa**

```bash
cd quodom-web/api && npm test tests/db.test.js
```
Expected: PASS (3 tests).

- [ ] **Step 7: Correr toda la suite** (`npm test`) — Expected: PASS. **Commit**

```bash
git add quodom-web/api/src quodom-web/api/tests
git commit -m "feat: add sequelize models and SQLite views mirroring original API schema"
```

---

### Task 4: Seed desde Migracion.xlsx

**Files:**
- Create: `quodom-web/api/src/seed/seed.js`

Estructura del Excel `Documentacion 2.0/Categorias/Migracion.xlsx` (verificada):
- Hoja `TodasCategorias`: `id`, `NombreCategoria`, `idcategoriapadre`, `activa`, `imagen`, `refreshImagen`, `orden`
- Hoja `Productos`: `id`, `nombreproducto`, `descripcion`, `categoria`, `categoriaPadre`, `idatributo`, `nombreatributo`, `unidadmedida`, `nombreunidadmedida`, `imagen`, `refreshImagen`, `atributo1`, `atributo2`
- Hoja `Atributos`: `id`, `idproducto`, `idatributo`, `nombreatributo`, `valoratributo`, `orden`, `esvendedor`

- [ ] **Step 1: Crear `quodom-web/api/src/seed/seed.js`**

```js
require('dotenv').config();
const path = require('path');
const XLSX = require('xlsx');
const db = require('../helpers/db');

const EXCEL_PATH = path.resolve(__dirname, '../../../../Documentacion 2.0/Categorias/Migracion.xlsx');

const PROVINCIAS = ['Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco',
    'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa',
    'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
    'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'];

async function main() {
    await db.ready;
    console.log('Reading', EXCEL_PATH);
    const wb = XLSX.readFile(EXCEL_PATH);

    // 1. Categories
    const catRows = XLSX.utils.sheet_to_json(wb.Sheets['TodasCategorias']);
    let cats = 0;
    for (const row of catRows) {
        if (row.id === undefined || row.id === null || !row.NombreCategoria) continue;
        await db.Category.upsert({
            id: Math.round(Number(row.id)),
            nombrecategoria: String(row.NombreCategoria).trim(),
            idcategoriapadre: row.idcategoriapadre != null ? Math.round(Number(row.idcategoriapadre)) : 0,
            activa: row.activa != null ? Boolean(Number(row.activa)) : true,
            imagen: row.imagen ? String(row.imagen).trim() : null,
            refreshImage: row.refreshImagen ? String(row.refreshImagen).trim() : null,
            orden: row.orden != null ? Math.round(Number(row.orden)) : 0
        });
        cats++;
    }

    // 2. Products
    const prodRows = XLSX.utils.sheet_to_json(wb.Sheets['Productos']);
    let prods = 0;
    for (const row of prodRows) {
        if (row.id === undefined || row.id === null || !row.nombreproducto) continue;
        let categoria = row.categoria != null ? Math.round(Number(row.categoria)) : null;
        const categoriaPadre = row.categoriaPadre != null ? Math.round(Number(row.categoriaPadre)) : null;
        if (categoria === null) categoria = categoriaPadre;
        if (categoria === null) {
            console.warn('Skipping product without category:', row.id, row.nombreproducto);
            continue;
        }
        await db.Products.upsert({
            id: Math.round(Number(row.id)),
            nombreproducto: String(row.nombreproducto).trim(),
            descripcion: row.descripcion ? String(row.descripcion).trim() : null,
            categoria: categoria,
            categoriaPadre: categoriaPadre !== null ? categoriaPadre : categoria,
            idatributo: row.idatributo != null ? Math.round(Number(row.idatributo)) : null,
            nombreatributo: row.nombreatributo ? String(row.nombreatributo).trim() : null,
            unidadmedida: row.unidadmedida != null ? Math.round(Number(row.unidadmedida)) : null,
            nombreunidadmedida: row.nombreunidadmedida ? String(row.nombreunidadmedida).trim() : null,
            imagen: row.imagen ? String(row.imagen).trim() : null,
            refreshImagen: row.refreshImagen ? String(row.refreshImagen).trim() : null,
            atributo1: row.atributo1 ? String(row.atributo1).trim() : null,
            atributo2: row.atributo2 ? String(row.atributo2).trim() : null
        });
        prods++;
    }

    // 3. Product attributes
    const attrRows = XLSX.utils.sheet_to_json(wb.Sheets['Atributos']);
    await db.productos_atributos.destroy({ where: {}, truncate: true });
    let attrs = 0;
    for (const row of attrRows) {
        if (row.idproducto === undefined || row.idproducto === null) continue;
        await db.productos_atributos.create({
            idproducto: Math.round(Number(row.idproducto)),
            idatributo: row.idatributo != null ? Math.round(Number(row.idatributo)) : null,
            nombreatributo: row.nombreatributo ? String(row.nombreatributo).trim() : null,
            valoratributo: row.valoratributo != null ? String(row.valoratributo).trim() : null,
            orden: row.orden != null ? Math.round(Number(row.orden)) : 0,
            esvendedor: row.esvendedor != null ? String(row.esvendedor) : '0'
        });
        attrs++;
    }

    // 4. Provincias
    for (let i = 0; i < PROVINCIAS.length; i++) {
        await db.provincia.upsert({ id: i + 1, provincia: PROVINCIAS[i] });
    }

    // 5. Serie QUODOM
    const serie = await db.series.findOne({ where: { codigo: 'QUODOM' } });
    if (!serie) {
        await db.series.create({ codigo: 'QUODOM', utilizado: 0, sigla: 'QD-' });
    }

    // 6. Verification
    const subcats = await db.Category.count({ where: { idcategoriapadre: { [db.Sequelize.Op.ne]: 0 } } });
    const totalProds = await db.Products.count();
    console.log(`Seeded: ${cats} categories (${subcats} subcategories), ${totalProds} products, ${attrs} attribute rows, ${PROVINCIAS.length} provinces.`);
    if (subcats !== 62) throw new Error(`Expected 62 subcategories, got ${subcats}`);
    if (totalProds !== 644) throw new Error(`Expected 644 products, got ${totalProds}`);
    console.log('Seed verification OK (62 subcategories, 644 products).');
}

main()
    .then(() => process.exit(0))
    .catch(err => { console.error('Seed failed:', err); process.exit(1); });
```

- [ ] **Step 2: Correr el seed**

```bash
cd quodom-web/api && npm run seed
```
Expected: `Seed verification OK (62 subcategories, 644 products).` y exit code 0. Si los conteos difieren, investigar el Excel (filas inactivas o vacías) ANTES de ajustar los números esperados — los valores 62/644 vienen del spec.

- [ ] **Step 3: Verificar que la base es consultable**

```bash
cd quodom-web/api && node -e "const db=require('./src/helpers/db'); db.ready.then(async()=>{ const c=await db.Category.count(); const p=await db.Products.count(); console.log('categorias:',c,'productos:',p); process.exit(0); })"
```
Expected: imprime los conteos reales (>0).

- [ ] **Step 4: Commit** (la base `quodom.sqlite` NO se commitea — ya está en `.gitignore`)

```bash
git add quodom-web/api/src/seed
git commit -m "feat: add Excel-based seed script with 62-subcategory/644-product verification"
```

---

### Task 5: Auth + Usuarios (signup, signin, reset, direcciones del user)

**Files:**
- Create: `quodom-web/api/src/middleware/auth.js`
- Create: `quodom-web/api/src/middleware/validate-request.js`
- Create: `quodom-web/api/src/helpers/email.js`
- Create: `quodom-web/api/src/lib/email/templates/validar-email.ejs` (copia de `<API>\src\lib\email\templates\validar-email.ejs`)
- Create: `quodom-web/api/src/lib/email/templates/reset-password.ejs` (copia de `<API>\src\lib\email\templates\reset-password.ejs`)
- Create: `quodom-web/api/src/controllers/users.controller.js`
- Create: `quodom-web/api/src/routes/users.routes.js`
- Modify: `quodom-web/api/src/server.js` (montar `/users`)
- Test: `quodom-web/api/tests/users.test.js`

Cambios respecto del original:
- Sin `appSign`/SHA256, sin `tokenNotification`/`GuardarTokenNotif`, sin `getVinculado`/`users_logs`, sin `getInfoVendedor`/`getCatByUserId`/`getZonaByUserId`, sin campos `cuit`/`RazonSocial`/`esVendedor`/`Fact_*`/`BANK_*`.
- `emailValidado` en signup = `process.env.EMAIL_ENABLED !== 'true'` (si no hay SMTP configurado, el usuario entra directo).
- `sendEmail` recibe el **link completo** (no el token pelado): el controller arma `${process.env.APP_URL}/validar-email/${token}` o `${process.env.APP_URL}/reset-password/${token}`.
- Secret JWT desde `process.env.JWT_SECRET` (no hay `auth.config.js`).

- [ ] **Step 1: Escribir el test que falla** — `quodom-web/api/tests/users.test.js`

```js
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');

beforeAll(async () => { await db.ready; });

const USER = {
  username: 'juan',
  email: 'juan@test.com',
  nombre: 'Juan',
  apellido: 'Perez',
  password: 'secreto123',
  codArea: '11',
  telefono: '55554444'
};

describe('users', () => {
  let token;

  it('POST /users/signup creates a user', async () => {
    const res = await request(app).post('/users/signup').send(USER);
    expect(res.status).toBe(200);
    expect(res.body.res).toBe(true);
    expect(res.body.id).toBeDefined();
  });

  it('POST /users/signup rejects duplicate email', async () => {
    const res = await request(app).post('/users/signup').send({ ...USER, username: 'otro' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ res: false, message: 'El correo electrónico ya está en uso.' });
  });

  it('POST /users/signin returns a token (by username or email)', async () => {
    const res = await request(app).post('/users/signin')
      .send({ username: 'juan@test.com', password: 'secreto123' });
    expect(res.status).toBe(200);
    expect(res.body.res).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.password).toBeUndefined();
    token = res.body.token;
  });

  it('POST /users/signin rejects wrong password', async () => {
    const res = await request(app).post('/users/signin')
      .send({ username: 'juan', password: 'incorrecta' });
    expect(res.status).toBe(400);
    expect(res.body.res).toBe(false);
  });

  it('GET /users/current returns the logged user', async () => {
    const res = await request(app).get('/users/current')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('juan@test.com');
    expect(res.body.password).toBeUndefined();
  });

  it('GET /users/current without token returns 401', async () => {
    const res = await request(app).get('/users/current');
    expect(res.status).toBe(401);
  });

  it('PUT /users updates the profile', async () => {
    const res = await request(app).put('/users')
      .set('Authorization', 'Bearer ' + token)
      .send({ nombre: 'Juan Carlos' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ res: true, message: 'Actualizado.' });
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd quodom-web/api && npm test tests/users.test.js
```
Expected: FAIL — 404 en `/users/signup` (la ruta no existe todavía).

- [ ] **Step 3: Crear `quodom-web/api/src/middleware/validate-request.js`** — copia exacta de `<API>\src\middleware\validate-request.js`:

```js
module.exports = validateRequest;

function validateRequest(req, next, schema) {
    const options = {
        abortEarly: false,
        allowUnknown: true,
        stripUnknown: true
    };
    const { error, value } = schema.validate(req.body, options);
    if (error) {
        next(`Validation error: ${error.details.map(x => x.message).join(', ')}`);
    } else {
        req.body = value;
        next();
    }
}
```

- [ ] **Step 4: Crear `quodom-web/api/src/middleware/auth.js`** (port: secret desde env, se elimina `verifyTokenHeader` muerto y los `console.log`):

```js
const jwt = require('express-jwt');
const db = require('../helpers/db');

module.exports = {
  verifyToken,
  isAdmin
};

function verifyToken() {
  return [
    jwt({ secret: process.env.JWT_SECRET, algorithms: ['HS256'] }),

    async (req, res, next) => {
      const user = await db.User.findByPk(req.user.sub);

      if (!user)
        return res.status(401).json({ res: false, message: 'No autorizado.' });

      if (!user.activo)
        return res.status(401).json({ res: false, message: 'No autorizado.' });

      if (!user.emailValidado)
        return res.status(401).json({ res: false, message: 'Validar correo electronico.' });

      req.user = user.get();
      next();
    }
  ];
}

function isAdmin() {
  return [
    jwt({ secret: process.env.JWT_SECRET, algorithms: ['HS256'] }),

    async (req, res, next) => {
      const user = await db.User.findByPk(req.user.sub);

      if (!user)
        return res.status(401).json({ res: false, message: 'No autorizado.' });

      if (!user.activo)
        return res.status(401).json({ res: false, message: 'No autorizado.' });

      if (user.role !== 'admin')
        return res.status(401).json({ res: false, message: 'No autorizado solo admins.' });

      req.user = user.get();
      next();
    }
  ];
}
```

- [ ] **Step 5: Crear `quodom-web/api/src/helpers/email.js`** (port: config por env, `await sendMail`, guard `EMAIL_ENABLED`; se elimina `sendDetalleCompra`):

```js
const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');

module.exports = {
    sendEmail
};

async function sendEmail(user, link, subject, template) {
    if (process.env.EMAIL_ENABLED !== 'true') {
        console.log(`[email disabled] ${subject} -> ${user.email}: ${link}`);
        return true;
    }

    const templatePath = path.join(__dirname, '../lib/email/templates/', template + '.ejs');

    const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: true,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        tls: { rejectUnauthorized: false }
    });

    const html = await ejs.renderFile(templatePath, {
        nombre: user.nombre,
        emailAddress: user.email,
        resetLink: link
    });

    try {
        const info = await transport.sendMail({
            from: process.env.SMTP_FROM,
            to: user.email,
            subject: subject,
            html: html
        });
        console.log('Message sent: ' + info.response);
        return true;
    } catch (err) {
        console.log(err);
        return false;
    }
}
```

Nota: el original hacía `transport.sendMail` con callback y devolvía `ret` antes de que terminara el envío (siempre "true"). El port espera el resultado real.

- [ ] **Step 6: Copiar templates.** Copiar `<API>\src\lib\email\templates\validar-email.ejs` y `reset-password.ejs` a `quodom-web/api/src/lib/email/templates/`. En cada uno, revisar el `href` del botón/link: debe ser exactamente `<%= resetLink %>` (sin URL hardcodeada delante, porque ahora el controller pasa el link completo). Si el template original concatena un dominio, reemplazar ese `href` completo por `<%= resetLink %>`.

- [ ] **Step 7: Crear `quodom-web/api/src/controllers/users.controller.js`**

```js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../helpers/db');
const correo = require('../helpers/email');
const { Op } = require('sequelize');

module.exports = {
  authenticate,
  getAll,
  getById,
  getUserDirecciones,
  getUserDireccionDefault,
  getInfoComprador,
  create,
  update,
  updateFoto,
  reset,
  reenviar,
  validateEmail,
  changePass,
  delete: _delete
};

const emailEnabled = () => process.env.EMAIL_ENABLED === 'true';

async function authenticate({ username, password }) {
  const user = await db.User.scope('withHash').findOne({
    where: {
      [Op.or]: [{ email: username }, { username: username }]
    }
  });

  if (!user || !(await bcrypt.compare(password, user.password)))
    throw 'Usuario, e-mail o contraseña incorrectos.';

  if (!user.activo)
    throw 'El Usuario se encuentra actualmente bloqueado.';

  if (!user.emailValidado)
    throw 'Valida tu correo electronico primero.';

  const token = generarToken(user.id, '4800h');

  return { ...omitPassword(user.get()), token };
}

async function getAll() {
  return await db.User.findAll({
    attributes: { exclude: ['password', 'role'] }
  });
}

async function getById(id) {
  return await getUser(id);
}

async function create(params) {
  if (await db.User.findOne({ where: { email: params.email } })) {
    throw 'El correo electrónico ya está en uso.';
  }

  if (await db.User.findOne({ where: { username: params.username } })) {
    throw 'El usuario ya está en uso.';
  }

  if (params.password) {
    params.password = await bcrypt.hash(params.password, 10);
  }

  params.activo = true;
  params.emailValidado = !emailEnabled();
  params.role = 'user';

  const user = await db.User.create(params);

  const token = generarToken(user.id, '72h');
  const link = process.env.APP_URL + '/validar-email/' + token;
  const ret = await correo.sendEmail(user, link, 'Verifica tu correo electrónico', 'validar-email');

  if (!ret) {
    return { res: false, message: 'El usuario fue creado pero el correo no pudo ser enviado.' };
  }

  return { res: true, id: user.id, message: 'Usuario creado correctamente, revise su casilla de correo para activar su cuenta.' };
}

async function update(id, params) {
  const user = await getUser(id);

  const usernameChanged = params.username && user.username !== params.username;
  if (usernameChanged && await db.User.findOne({ where: { username: params.username } })) {
    throw 'Usuario ya está en uso.';
  }

  const emailChanged = params.email && user.email !== params.email;
  if (emailChanged && await db.User.findOne({ where: { email: params.email } })) {
    throw 'Correo electrónico ya está en uso.';
  }

  if (params.password) {
    params.password = await bcrypt.hash(params.password, 10);
  }

  Object.assign(user, params);
  await user.save();

  return omitPassword(user.get());
}

async function updateFoto(id, params) {
  const user = await getUser(id);
  const refreshFoto = Math.random();

  if (params.refreshFoto == 'borrar') {
    params.refreshFoto = null;
  } else {
    params.refreshFoto = refreshFoto.toString();
  }

  Object.assign(user, params);
  await user.save();

  return refreshFoto.toString();
}

async function reset(params) {
  const user = await db.User.findOne({
    where: {
      [Op.or]: [{ email: params.email }, { username: params.email }]
    }
  });

  if (!user) throw 'Revisá tu e-mail o usuario.';
  if (!user.activo) throw 'Usuario bloqueado.';
  if (!user.emailValidado) throw 'Valida tu e-mail primero.';

  const token = generarToken(user.id, '1h', 'resetpass');
  const link = process.env.APP_URL + '/reset-password/' + token;
  const ret = await correo.sendEmail(user, link, 'Restablecer contraseña QUODOM', 'reset-password');

  if (!ret) {
    return { res: false, message: 'El correo no pudo ser enviado.' };
  }

  return { res: true, message: 'Correo enviado correctamente, recuerda que el link tiene una duracion de 1 hora.' };
}

async function validateEmail(id) {
  const user = await getUser(id);

  if (user.emailValidado) throw 'El correo ya se encuentra validado.';

  return await user.update({ emailValidado: true });
}

async function reenviar(params) {
  const user = await db.User.findOne({ where: { email: params.email } });
  if (!user) throw 'Correo electronico no encontrado.';

  const token = generarToken(user.id, '72h');
  const link = process.env.APP_URL + '/validar-email/' + token;
  const ret = await correo.sendEmail(user, link, 'Verifica tu correo electrónico', 'validar-email');

  if (!ret) {
    return { res: false, message: 'El correo no pudo ser enviado.' };
  }
  return { res: true, message: 'Correo enviado correctamente.' };
}

async function _delete(id) {
  const user = await getUser(id);
  await user.destroy();
}

async function changePass(id, params) {
  const user = await getUser(id);

  if (!user.activo) throw 'El Usuario se encuentra actualmente bloqueado.';

  if (params.password) {
    params.password = await bcrypt.hash(params.password, 10);
  }
  return await user.update({ password: params.password });
}

async function getUserDirecciones(userId) {
  return await db.user_direcciones.findAll({
    where: { userid: userId },
    order: [['id', 'ASC']],
    attributes: { exclude: ['createdAt', 'updatedAt'] }
  });
}

async function getUserDireccionDefault(userId) {
  let dire = await db.user_direcciones.findOne({
    where: { userid: userId, default: true },
    attributes: { exclude: ['createdAt', 'updatedAt'] }
  });

  if (!dire) {
    dire = await db.user_direcciones.findOne({
      where: { userid: userId },
      order: [['id', 'ASC']],
      attributes: { exclude: ['createdAt', 'updatedAt'] }
    });
  }

  return dire;
}

async function getInfoComprador(idquodom) {
  return await db.v_InfoCompradors.findOne({
    where: { idquodom: idquodom }
  });
}

// helpers
async function getUser(id) {
  const user = await db.User.findByPk(id);
  if (!user) throw 'Err. Usuario no encontrado.';
  return user;
}

function omitPassword(user) {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

function generarToken(id, expire, action) {
  return jwt.sign({ sub: id, action }, process.env.JWT_SECRET, { expiresIn: expire });
}
```

- [ ] **Step 8: Crear `quodom-web/api/src/routes/users.routes.js`**

```js
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const auth = require('../middleware/auth');
const Controler = require('../controllers/users.controller');
const validateRequest = require('../middleware/validate-request');
const jwt = require('jsonwebtoken');

router.get('/validateEmail/:token', validateEmail);
router.get('/validateReset/:token', validateReset);
router.get('/infoComprador/:idquodom', auth.verifyToken(), getInfoComprador);
router.get('/dire/', auth.verifyToken(), getUserDirecciones);
router.get('/direcciondefault/', auth.verifyToken(), getUserDireccionDefault);
router.get('/', auth.isAdmin(), getAll);
router.get('/current', auth.verifyToken(), getCurrent);
router.get('/currentFoto', auth.verifyToken(), getCurrentFoto);
router.get('/:id', auth.verifyToken(), getById);
router.post('/signin', signinSchema, authenticate);
router.post('/signup', signupSchema, register);
router.post('/reset', resetSchema, resetPass);
router.post('/reenviar', resetSchema, reenviar);
router.post('/changePass', changePassSchema, cambiarPass);
router.put('/', auth.verifyToken(), update);
router.put('/cambiarFoto/:id', auth.verifyToken(), updateFoto);
router.delete('/:id', auth.isAdmin(), _delete);

module.exports = router;

function signinSchema(req, res, next) {
  const schema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
  });
  validateRequest(req, next, schema);
}

function signupSchema(req, res, next) {
  const schema = Joi.object({
    username: Joi.string().required(),
    email: Joi.string().email().required(),
    nombre: Joi.string().required(),
    apellido: Joi.string(),
    password: Joi.string().min(6).required(),
    dni: Joi.string(),
    codArea: Joi.string().required(),
    telefono: Joi.string().required()
  });
  validateRequest(req, next, schema);
}

function resetSchema(req, res, next) {
  const schema = Joi.object({
    email: Joi.string().required()
  });
  validateRequest(req, next, schema);
}

function changePassSchema(req, res, next) {
  const schema = Joi.object({
    password: Joi.string().min(6).required(),
    token: Joi.string().required()
  });
  validateRequest(req, next, schema);
}

function authenticate(req, res, next) {
  Controler.authenticate(req.body)
    .then(user => res.json({
      res: true,
      username: user.username,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      id: user.id,
      role: user.role,
      refreshFoto: user.refreshFoto,
      token: user.token
    }))
    .catch(next);
}

function register(req, res, next) {
  Controler.create(req.body)
    .then(response => res.json(response))
    .catch(next);
}

function getAll(req, res, next) {
  Controler.getAll()
    .then(users => res.json(users))
    .catch(next);
}

function getCurrent(req, res, next) {
  res.json({
    id: req.user.id,
    username: req.user.username,
    email: req.user.email,
    nombre: req.user.nombre,
    apellido: req.user.apellido,
    dni: req.user.dni,
    refreshFoto: req.user.refreshFoto,
    telefono: req.user.telefono,
    codArea: req.user.codArea
  });
}

function getCurrentFoto(req, res, next) {
  res.json({
    id: req.user.id,
    foto: req.user.foto,
    refreshFoto: req.user.refreshFoto
  });
}

function getById(req, res, next) {
  Controler.getById(req.params.id)
    .then(user => res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      nombre: user.nombre,
      apellido: user.apellido
    }))
    .catch(next);
}

function getUserDirecciones(req, res, next) {
  Controler.getUserDirecciones(req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function getUserDireccionDefault(req, res, next) {
  Controler.getUserDireccionDefault(req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function getInfoComprador(req, res, next) {
  Controler.getInfoComprador(req.params.idquodom)
    .then(data => res.json(data))
    .catch(next);
}

function update(req, res, next) {
  Controler.update(req.user.id, req.body)
    .then(() => res.status(200).json({ res: true, message: 'Actualizado.' }))
    .catch(next);
}

function updateFoto(req, res, next) {
  if (req.user.id == req.params.id) {
    Controler.updateFoto(req.params.id, req.body)
      .then(data => res.json({ res: true, refresh: data }))
      .catch(next);
  } else {
    res.status(401).json({ res: false, message: 'Error de Id.' });
  }
}

function _delete(req, res, next) {
  Controler.delete(req.params.id)
    .then(() => res.status(200).json({ res: true, message: 'Eliminado.' }))
    .catch(next);
}

function resetPass(req, res, next) {
  Controler.reset(req.body)
    .then(response => res.json(response))
    .catch(next);
}

function reenviar(req, res, next) {
  Controler.reenviar(req.body)
    .then(response => res.json(response))
    .catch(next);
}

function validateEmail(req, res, next) {
  jwt.verify(req.params.token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.json({ res: false, message: 'El token no es valido o ha expirado.' });
    }
    Controler.validateEmail(decoded.sub)
      .then(() => res.status(200).json({ res: true, message: 'Correo validado' }))
      .catch(next);
  });
}

function validateReset(req, res, next) {
  jwt.verify(req.params.token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.message === 'jwt expired') {
        return res.json({ res: false, message: 'El token ha expirado, genere uno nuevo ingresando a ¿Olvidaste tu clave?' });
      }
      return res.json({ res: false, message: 'El token no es valido.' });
    }
    if (decoded.action !== 'resetpass') {
      return res.json({ res: false, message: 'El token no es valido para esta operacion, genere uno nuevo ingresando a ¿Olvidaste tu clave?' });
    }
    res.status(200).json({ res: true });
  });
}

function cambiarPass(req, res, next) {
  jwt.verify(req.body.token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.message === 'jwt expired') {
        return res.json({ res: false, message: 'El token ha expirado, genere uno nuevo ingresando a ¿Olvidaste tu clave?' });
      }
      return res.json({ res: false, message: 'El token no es valido.' });
    }
    if (decoded.action !== 'resetpass') {
      return res.json({ res: false, message: 'El token no es valido para esta operacion, genere uno nuevo ingresando a ¿Olvidaste tu clave?' });
    }
    Controler.changePass(decoded.sub, req.body)
      .then(() => res.json({ res: true, message: 'La contraseña ha sido modificado con exito, ya puedes volver a ingresar a QUODOM.' }))
      .catch(next);
  });
}
```

- [ ] **Step 9: Montar la ruta en `server.js`.** Debajo del comentario `// api routes (added task by task)` agregar:

```js
app.use('/users', require('./routes/users.routes'));
```

- [ ] **Step 10: Correr el test y verificar que pasa**

```bash
cd quodom-web/api && npm test tests/users.test.js
```
Expected: PASS (7 tests). Nota: como `EMAIL_ENABLED=false` en tests, el signup deja `emailValidado=true` y el signin funciona directo.

- [ ] **Step 11: Correr toda la suite** (`npm test`) — Expected: PASS. **Commit**

```bash
git add quodom-web/api/src quodom-web/api/tests
git commit -m "feat: add auth middleware, users controller and routes (no vendor fields, env-based JWT/SMTP)"
```

---

### Task 6: Catálogo — categorías, productos, búsqueda e historial

**Files:**
- Create: `quodom-web/api/src/controllers/categorias.controller.js`
- Create: `quodom-web/api/src/routes/categorias.route.js`
- Create: `quodom-web/api/src/controllers/productos.controller.js`
- Create: `quodom-web/api/src/routes/productos.route.js`
- Create: `quodom-web/api/src/controllers/busqueda.controller.js`
- Create: `quodom-web/api/src/routes/busqueda.route.js`
- Create: `quodom-web/api/src/controllers/hist_busquedas.controller.js`
- Create: `quodom-web/api/src/routes/hist_busquedas.route.js`
- Modify: `quodom-web/api/src/server.js` (montar las 4 rutas)
- Test: `quodom-web/api/tests/catalogo.test.js`

Cambios respecto del original:
- Categorías y productos por categoría son **públicos** (modo invitado navega el catálogo). En el original `GET /categorias/` y `GET /productos/:id` exigían token.
- Se eliminan create/update/delete/relacion de categorías y create/update/delete/getMyProducts de productos (el catálogo solo se puebla por seed).
- `getProductsByCatQuodom` se adapta a SQLite (el subquery con `CASE WHEN ... AS existe` de MySQL se reemplaza por `COALESCE((SELECT 1 ...), 0)`).
- Búsqueda pública (guests buscan); el historial se guarda con endpoints separados autenticados (`/hist_busquedas`), porque la ruta pública no tiene `req.user`.

- [ ] **Step 1: Escribir el test que falla** — `quodom-web/api/tests/catalogo.test.js`

```js
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');

beforeAll(async () => {
  await db.ready;
  await db.Category.bulkCreate([
    { id: 5, nombrecategoria: 'Pintura', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 35, nombrecategoria: 'Latex', idcategoriapadre: 5, activa: true, orden: 1 },
    { id: 36, nombrecategoria: 'Esmaltes', idcategoriapadre: 5, activa: false, orden: 2 }
  ]);
  await db.Products.bulkCreate([
    { id: 100, nombreproducto: 'Latex interior 20L', descripcion: 'Pintura latex lavable', categoria: 35, categoriaPadre: 5 },
    { id: 101, nombreproducto: 'Rodillo semilana', descripcion: 'Rodillo 22cm', categoria: 35, categoriaPadre: 5 }
  ]);
});

describe('catalogo', () => {
  it('GET /categorias returns active root categories without auth', async () => {
    const res = await request(app).get('/categorias');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].nombrecategoria).toBe('Pintura');
  });

  it('GET /categorias/Sub/:id returns active subcategories', async () => {
    const res = await request(app).get('/categorias/Sub/5');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].nombrecategoria).toBe('Latex');
  });

  it('GET /productos/categoria/:idcategoria returns products without auth', async () => {
    const res = await request(app).get('/productos/categoria/35');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('GET /productos/:id returns one product', async () => {
    const res = await request(app).get('/productos/100');
    expect(res.status).toBe(200);
    expect(res.body.nombreproducto).toBe('Latex interior 20L');
  });

  it('GET /busqueda?b=latex finds by nombre or descripcion', async () => {
    const res = await request(app).get('/busqueda').query({ b: 'latex' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].nombre).toBe('Latex interior 20L');
  });

  it('GET /hist_busquedas requires auth', async () => {
    const res = await request(app).get('/hist_busquedas');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd quodom-web/api && npm test tests/catalogo.test.js
```
Expected: FAIL — 404 en `/categorias`.

- [ ] **Step 3: Crear `quodom-web/api/src/controllers/categorias.controller.js`**

```js
const db = require('../helpers/db');

module.exports = {
    getAll,
    getById,
    getSub
};

async function getAll() {
    return await db.Category.findAll({
        where: {
            activa: true,
            idcategoriapadre: 0
        },
        order: [['orden', 'ASC']],
        attributes: { exclude: ['createdAt', 'updatedAt', 'activa', 'idcategoriapadre'] }
    });
}

async function getById(id) {
    return await getCategory(id);
}

async function getSub(id) {
    return await db.Category.findAll({
        where: {
            activa: true,
            idcategoriapadre: id
        },
        order: [['orden', 'ASC']],
        attributes: { exclude: ['createdAt', 'updatedAt', 'activa', 'idcategoriapadre'] }
    });
}

// helpers
async function getCategory(id) {
    const category = await db.Category.findByPk(id);
    if (!category) throw 'Category not found';
    return category;
}
```

- [ ] **Step 4: Crear `quodom-web/api/src/routes/categorias.route.js`** (todo público)

```js
const express = require('express');
const router = express.Router();
const Controler = require('../controllers/categorias.controller');

router.get('/Sub/:idcategoriapadre', getSub);
router.get('/', getAll);
router.get('/:id', getById);

module.exports = router;

function getAll(req, res, next) {
  Controler.getAll()
    .then(datas => res.json(datas))
    .catch(next);
}

function getSub(req, res, next) {
  Controler.getSub(req.params.idcategoriapadre)
    .then(datas => res.json(datas))
    .catch(next);
}

function getById(req, res, next) {
  Controler.getById(req.params.id)
    .then(data => res.json(data))
    .catch(next);
}
```

- [ ] **Step 5: Crear `quodom-web/api/src/controllers/productos.controller.js`**

```js
const db = require('../helpers/db');

module.exports = {
    getById,
    getByCat,
    getProductsByCatQuodom
};

async function getById(id) {
    return await getProduct(id);
}

async function getByCat(categoria) {
    return await db.Products.findAll({
        where: { categoria: categoria },
        attributes: { exclude: ['createdAt', 'updatedAt'] }
    });
}

// For the open-quodom view: each product of the subcategory plus an
// "existe" flag telling whether it is already in the quodom's lines.
async function getProductsByCatQuodom(idquodom, id) {
    return await db.sequelize.query(
        `SELECT p.id, p.imagen, p.refreshImagen, p.nombreproducto,
                COALESCE((SELECT 1 FROM quodom_lines ql
                          WHERE ql.idquodom = :q AND ql.idproducto = p.id LIMIT 1), 0) AS existe
         FROM productos p
         WHERE p.categoria = :subcategoria`,
        {
            replacements: { q: idquodom, subcategoria: id },
            type: db.Sequelize.QueryTypes.SELECT
        }
    );
}

// helpers
async function getProduct(id) {
    const product = await db.Products.findByPk(id);
    if (!product) throw 'Err. Producto no encontrado.';
    return product;
}
```

- [ ] **Step 6: Crear `quodom-web/api/src/routes/productos.route.js`**

```js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Controler = require('../controllers/productos.controller');

router.get('/categoriaQ/:idquodom/:idcategoria', auth.verifyToken(), getProductsByCatQuodom);
router.get('/categoria/:idcategoria', getByCategoria);
router.get('/:id', getById);

module.exports = router;

function getByCategoria(req, res, next) {
  Controler.getByCat(req.params.idcategoria)
    .then(datas => res.json(datas))
    .catch(next);
}

function getProductsByCatQuodom(req, res, next) {
  Controler.getProductsByCatQuodom(req.params.idquodom, req.params.idcategoria)
    .then(datas => res.json(datas))
    .catch(next);
}

function getById(req, res, next) {
  Controler.getById(req.params.id)
    .then(data => res.json(data))
    .catch(next);
}
```

- [ ] **Step 7: Crear `quodom-web/api/src/controllers/busqueda.controller.js`** (el `tipo` del original tenía dos ramas idénticas; queda una sola)

```js
const db = require('../helpers/db');
const { Op } = require('sequelize');

module.exports = {
    getAll
};

async function getAll(buscar) {
    return await db.v_Busqueda.findAll({
        where: {
            [Op.or]: [
                { nombre: { [Op.like]: '%' + buscar + '%' } },
                { descripcion: { [Op.like]: '%' + buscar + '%' } }
            ]
        }
    });
}
```

- [ ] **Step 8: Crear `quodom-web/api/src/routes/busqueda.route.js`** (pública — el guest busca)

```js
const express = require('express');
const router = express.Router();
const Controler = require('../controllers/busqueda.controller');

router.get('/', getAll);

module.exports = router;

function getAll(req, res, next) {
    Controler.getAll(req.query.b)
        .then(datas => res.json(datas))
        .catch(next);
}
```

- [ ] **Step 9: Crear `quodom-web/api/src/controllers/hist_busquedas.controller.js`**

```js
const db = require('../helpers/db');

module.exports = {
    create,
    getRecent
};

async function create(valor, userId) {
    await db.hist_busquedas.create({ valor: valor, usuario: userId });
    return true;
}

async function getRecent(userId) {
    return await db.hist_busquedas.findAll({
        where: { usuario: userId },
        order: [['createdAt', 'DESC']],
        limit: 10,
        attributes: ['id', 'valor', 'createdAt']
    });
}
```

- [ ] **Step 10: Crear `quodom-web/api/src/routes/hist_busquedas.route.js`**

```js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Controler = require('../controllers/hist_busquedas.controller');

router.get('/', auth.verifyToken(), getRecent);
router.post('/create', auth.verifyToken(), create);

module.exports = router;

function getRecent(req, res, next) {
    Controler.getRecent(req.user.id)
        .then(datas => res.json(datas))
        .catch(next);
}

function create(req, res, next) {
    Controler.create(req.body.valor, req.user.id)
        .then(() => res.json({ res: true }))
        .catch(next);
}
```

- [ ] **Step 11: Montar las rutas en `server.js`** (debajo de `/users`):

```js
app.use('/categorias', require('./routes/categorias.route'));
app.use('/productos', require('./routes/productos.route'));
app.use('/busqueda', require('./routes/busqueda.route'));
app.use('/hist_busquedas', require('./routes/hist_busquedas.route'));
```

- [ ] **Step 12: Correr el test y verificar que pasa**

```bash
cd quodom-web/api && npm test tests/catalogo.test.js
```
Expected: PASS (6 tests).

- [ ] **Step 13: Correr toda la suite** (`npm test`) — Expected: PASS. **Commit**

```bash
git add quodom-web/api/src quodom-web/api/tests
git commit -m "feat: add public catalog, search and search-history endpoints"
```

---

### Task 7: Quodoms y líneas

**Files:**
- Create: `quodom-web/api/src/helpers/series.js`
- Create: `quodom-web/api/src/controllers/quodom.controller.js`
- Create: `quodom-web/api/src/routes/quodom.route.js`
- Create: `quodom-web/api/src/controllers/quodom_lines.controller.js`
- Create: `quodom-web/api/src/routes/quodom_lines.route.js`
- Modify: `quodom-web/api/src/server.js` (montar `/quodom` y `/quodom_lines`)
- Test: `quodom-web/api/tests/quodom.test.js`

Cambios respecto del original:
- `quodom.controller`: se eliminan `getMyQuodomsByProveedor`, `updateCotizado`, `cerrarQuodom` y `enviarQuodom` (todo del circuito de cotización con vendedores; el envío ahora es el link de WhatsApp — Task 10). Se elimina `getMyQuodomsByCat` (sin uso en la app compradora).
- `update` valida ownership (`quodom.createdBy === userId`) — el original tenía esa validación comentada.
- `delete` valida ownership antes de borrar/ocultar (el original no lo hacía).
- `getLastQuodomOrCreate`: fix del crash original cuando el usuario no tiene dirección default (`dire.id` sobre null) → `dire ? dire.id : null`. Además `create` ya resuelve la default por su cuenta, así que se simplifica.
- `quodom_lines.add`: sin `appSign`; se agrega `params.categoria = producto.categoria` (el original dependía de que el cliente lo mandara).
- Los schemas Joi pierden `appSign`.

- [ ] **Step 1: Escribir el test que falla** — `quodom-web/api/tests/quodom.test.js`

```js
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');

let token;
let otherToken;
let idquodom;
let idline;

beforeAll(async () => {
  await db.ready;
  await db.series.create({ codigo: 'QUODOM', utilizado: 0, sigla: 'QD-' });
  await db.Category.bulkCreate([
    { id: 5, nombrecategoria: 'Pintura', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 35, nombrecategoria: 'Latex', idcategoriapadre: 5, activa: true, orden: 1 }
  ]);
  await db.Products.create({
    id: 100, nombreproducto: 'Latex interior 20L', categoria: 35, categoriaPadre: 5,
    atributo1: 'Color', atributo2: null
  });

  const user = {
    username: 'ana', email: 'ana@test.com', nombre: 'Ana', password: 'secreto123',
    codArea: '11', telefono: '55554444'
  };
  await request(app).post('/users/signup').send(user);
  const login = await request(app).post('/users/signin').send({ username: 'ana', password: 'secreto123' });
  token = login.body.token;

  await request(app).post('/users/signup').send({ ...user, username: 'beto', email: 'beto@test.com' });
  const login2 = await request(app).post('/users/signin').send({ username: 'beto', password: 'secreto123' });
  otherToken = login2.body.token;
});

describe('quodom', () => {
  it('POST /quodom/create creates a quodom with serie number', async () => {
    const res = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Pintura Dpto' });
    expect(res.status).toBe(200);
    expect(res.body.res).toBe(true);
    idquodom = res.body.idquodom;
    const q = await db.Quodom.findByPk(idquodom);
    expect(q.estado).toBe('CREADO');
    expect(q.nro).toBe('QD-1');
  });

  it('POST /quodom_lines/add adds a line enriched from the product', async () => {
    const res = await request(app).post('/quodom_lines/add')
      .set('Authorization', 'Bearer ' + token)
      .send({ idquodom: idquodom, idproducto: 100, cantidad: 2, nombreProducto: 'Latex interior 20L' });
    expect(res.status).toBe(200);
    expect(res.body.res).toBe(true);
    idline = res.body.id;
    const ql = await db.Quodom_Lines.findByPk(idline);
    expect(ql.categoria).toBe(35);
    expect(ql.categoriaPadre).toBe(5);
    expect(ql.nombreCategoria).toBe('Latex');
    expect(ql.nombreAtributo1).toBe('Color');
  });

  it('POST /quodom_lines/add on another user quodom fails', async () => {
    const res = await request(app).post('/quodom_lines/add')
      .set('Authorization', 'Bearer ' + otherToken)
      .send({ idquodom: idquodom, idproducto: 100, cantidad: 1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El Id Quodom no pertenece a el usuario.');
  });

  it('GET /quodom_lines/:idquodom returns lines from the view', async () => {
    const res = await request(app).get('/quodom_lines/' + idquodom)
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].atributosFaltantes).toBe(1);
  });

  it('PUT /quodom_lines/:id updates atributo1', async () => {
    const res = await request(app).put('/quodom_lines/' + idline)
      .set('Authorization', 'Bearer ' + token)
      .send({ atributo1: 'Blanco' });
    expect(res.status).toBe(200);
    expect(res.body.res).toBe(true);
  });

  it('GET /quodom/misQuodom returns v_Quodoms data', async () => {
    const res = await request(app).get('/quodom/misQuodom/')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].cantproductos).toBe(1);
    expect(Number(res.body[0].porccompletado)).toBe(100);
  });

  it('GET /quodom/porccompletado/:id returns progress', async () => {
    const res = await request(app).get('/quodom/porccompletado/' + idquodom)
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.cantproductos).toBe(1);
  });

  it('POST /quodom/getLastQuodom returns the open quodom (no crash without default address)', async () => {
    const res = await request(app).post('/quodom/getLastQuodom/')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Mi Quodom' });
    expect(res.status).toBe(200);
    expect(res.body.res).toBe(true);
    expect(res.body.data.id).toBe(idquodom);
  });

  it('DELETE /quodom/:id destroys a CREADO quodom and its lines', async () => {
    const res = await request(app).delete('/quodom/' + idquodom)
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(await db.Quodom.findByPk(idquodom)).toBeNull();
    expect(await db.Quodom_Lines.count({ where: { idquodom: idquodom } })).toBe(0);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd quodom-web/api && npm test tests/quodom.test.js
```
Expected: FAIL — 404 en `/quodom/create`.

- [ ] **Step 3: Crear `quodom-web/api/src/helpers/series.js`** — copia exacta del original:

```js
const db = require('../helpers/db');

module.exports = {
    incrementar
};

async function incrementar(codigo) {
    const serie = await db.series.findOne({
        where: { codigo: codigo }
    });

    if (serie) {
        let utilizado = (serie.utilizado + 1);
        Object.assign(serie, { utilizado: utilizado });
        await serie.save();
        return (serie.sigla + utilizado);
    } else {
        throw 'error';
    }
}
```

- [ ] **Step 4: Crear `quodom-web/api/src/controllers/quodom.controller.js`**

```js
const db = require('../helpers/db');
const serie = require('../helpers/series');

module.exports = {
    getById,
    getMyQuodoms,
    getPorcById,
    create,
    update,
    delete: _delete,
    getLastQuodomOrCreate,
    getQuodomCreados
};

async function getById(id) {
    return await getQuodom(id);
}

async function getMyQuodoms(userId) {
    return await db.v_Quodoms.findAll({
        where: { createdBy: userId },
        attributes: { exclude: ['createdBy', 'updatedAt'] },
        order: [['createdAt', 'DESC']]
    });
}

async function getPorcById(userId, id) {
    return await db.v_Quodoms.findOne({
        where: { id: id, createdBy: userId },
        attributes: ['cantproductos', 'porccompletado']
    });
}

async function create(params, userId) {
    if (!params.iddireccion) {
        const direccionDefault = await getDireccionDefault(userId);
        params.iddireccion = direccionDefault ? direccionDefault.id : null;
    }

    params.nro = await serie.incrementar('QUODOM');
    params.createdBy = userId;
    params.estado = 'CREADO';

    const { id } = await db.Quodom.create(params);

    return (id);
}

async function update(id, params, userId) {
    const quodom = await getQuodom(id);
    if (quodom.createdBy !== userId) {
        throw 'El Id Quodom no pertenece a el usuario.';
    }
    Object.assign(quodom, params);
    await quodom.save();
    return true;
}

async function _delete(id, userId) {
    const quodom = await getQuodom(id);
    if (quodom.createdBy !== userId) {
        throw 'El Id Quodom no pertenece a el usuario.';
    }

    if (quodom.estado === 'CREADO') {
        await quodom.destroy();
        await db.Quodom_Lines.destroy({
            where: { idquodom: id }
        });
    } else {
        Object.assign(quodom, { ocultar: true });
        await quodom.save();
    }
    return true;
}

async function getLastQuodomOrCreate(params, userId) {
    const quodomHeader = await db.v_Quodoms.findOne({
        where: { createdBy: userId, estado: 'CREADO' },
        attributes: { exclude: ['createdBy', 'updatedAt'] },
        order: [['createdAt', 'DESC']]
    });

    if (quodomHeader === null) {
        // Original crashed here when there was no default address (dire.id on
        // null); create() already resolves the default address itself.
        const id = await create(params, userId);
        return await db.v_Quodoms.findOne({
            where: { id: id },
            attributes: { exclude: ['createdBy', 'updatedAt'] }
        });
    }
    return quodomHeader;
}

async function getQuodomCreados(userId) {
    return await db.v_Quodoms.findAll({
        where: { createdBy: userId, estado: 'CREADO' },
        attributes: { exclude: ['createdBy', 'updatedAt'] },
        order: [['createdAt', 'DESC']]
    });
}

// helpers
async function getQuodom(id) {
    const quodom = await db.Quodom.findByPk(id);
    if (!quodom) throw 'Err. Quodom no encontrado.';
    return quodom;
}

async function getDireccionDefault(userId) {
    return await db.user_direcciones.findOne({
        where: { userid: userId, default: true },
        attributes: { exclude: ['createdAt', 'updatedAt'] }
    });
}
```

- [ ] **Step 5: Crear `quodom-web/api/src/routes/quodom.route.js`**

```js
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const auth = require('../middleware/auth');
const Controler = require('../controllers/quodom.controller');
const validateRequest = require('../middleware/validate-request');

router.get('/getQuodomCreados', auth.verifyToken(), getQuodomCreados);
router.get('/misQuodom/', auth.verifyToken(), getMyQuodoms);
router.get('/porccompletado/:id', auth.verifyToken(), getPorcById);
router.get('/:id', auth.verifyToken(), getById);
router.post('/create', auth.verifyToken(), createSchema, create);
router.post('/getLastQuodom/', auth.verifyToken(), getLastQuodomOrCreate);
router.put('/:id', auth.verifyToken(), update);
router.delete('/:id', auth.verifyToken(), _delete);

module.exports = router;

function createSchema(req, res, next) {
  const schema = Joi.object({
    descripcion: Joi.string().required(),
    iddireccion: Joi.number().integer().empty(null)
  });
  validateRequest(req, next, schema);
}

function create(req, res, next) {
  Controler.create(req.body, req.user.id)
    .then((id) => res.json({ res: true, idquodom: id }))
    .catch(next);
}

function getMyQuodoms(req, res, next) {
  Controler.getMyQuodoms(req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function getPorcById(req, res, next) {
  Controler.getPorcById(req.user.id, req.params.id)
    .then(data => res.json(data))
    .catch(next);
}

function getById(req, res, next) {
  Controler.getById(req.params.id)
    .then(data => res.json(data))
    .catch(next);
}

function update(req, res, next) {
  Controler.update(req.params.id, req.body, req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function _delete(req, res, next) {
  Controler.delete(req.params.id, req.user.id)
    .then(() => res.json({ res: true, message: 'Eliminado.' }))
    .catch(next);
}

function getLastQuodomOrCreate(req, res, next) {
  Controler.getLastQuodomOrCreate(req.body, req.user.id)
    .then((data) => res.json({ res: true, data }))
    .catch(next);
}

function getQuodomCreados(req, res, next) {
  Controler.getQuodomCreados(req.user.id)
    .then((data) => res.json({ res: (data.length !== 0 ? true : false), data }))
    .catch(next);
}
```

- [ ] **Step 6: Crear `quodom-web/api/src/controllers/quodom_lines.controller.js`**

```js
const db = require('../helpers/db');

module.exports = {
    getAll,
    getById,
    getAtributos,
    add,
    update,
    delete: _delete
};

async function getAll(idquodom, userId) {
    await ValidarQuodom(idquodom, userId, 'GET');

    return await db.v_Quodoms_lines.findAll({
        where: { idquodom: idquodom }
    });
}

async function getAtributos(idproducto, nombreatributo) {
    return await db.productos_atributos.findAll({
        where: {
            idproducto: idproducto,
            nombreatributo: nombreatributo,
            esvendedor: '0'
        },
        order: [['orden', 'ASC']],
        attributes: { exclude: ['idproducto', 'idatributo', 'nombreatributo', 'createdAt', 'updatedAt'] }
    });
}

async function getById(id) {
    return await getQuodom_lines(id);
}

async function add(params, userId) {
    await ValidarQuodom(params.idquodom, userId, 'ADD');

    const producto = await getPr(params.idproducto);

    params.categoria = producto.categoria;
    params.categoriaPadre = producto.categoriaPadre;
    params.nombreAtributo1 = producto.atributo1;
    params.nombreAtributo2 = producto.atributo2;
    params.createdBy = userId;

    const categoria = await getCat(producto.categoria);
    if (categoria) {
        params.nombreCategoria = categoria.nombrecategoria;
    }

    const { id } = await db.Quodom_Lines.create(params);

    return (id);
}

async function update(id, params, userId) {
    const ql = await getQuodom_lines(id);
    if (ql.createdBy !== userId) {
        throw 'El Id Quodom no pertenece a el usuario.';
    }

    Object.assign(ql, params);
    return await ql.save();
}

async function _delete(id, userId) {
    const ql = await getQuodom_lines(id);

    await ValidarQuodom(ql.idquodom, userId, 'DELETE');

    await ql.destroy();
}

// helpers
async function getQuodom_lines(id) {
    const ql = await db.Quodom_Lines.findByPk(id);
    if (!ql) throw 'Err. Quodom_lines no encontrado.';
    return ql;
}

async function getQuodom(id) {
    const quodom = await db.Quodom.findByPk(id);
    if (!quodom) throw 'Err. Id Quodom no encontrado.';
    return quodom;
}

async function getPr(id) {
    const product = await db.Products.findByPk(id);
    if (!product) throw 'Err. Id de producto no encontrado.';
    return product;
}

async function getCat(id) {
    const categoria = await db.Category.findByPk(id);
    if (!categoria) throw 'Err. Id de categoria no encontrado.';
    return categoria;
}

async function ValidarQuodom(idquodom, userId, action) {
    const Quodom = await getQuodom(idquodom);

    if (Quodom.createdBy !== userId)
        throw 'El Id Quodom no pertenece a el usuario.';

    if (action != 'GET') {
        if (Quodom.estado !== 'CREADO')
            throw 'El estado del Quodom no permite modificaciones.';
    }

    return true;
}
```

- [ ] **Step 7: Crear `quodom-web/api/src/routes/quodom_lines.route.js`**

```js
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const auth = require('../middleware/auth');
const Controler = require('../controllers/quodom_lines.controller');
const validateRequest = require('../middleware/validate-request');

router.get('/lines/:id', auth.verifyToken(), getById);
router.get('/atributos', auth.verifyToken(), getAtributos);
router.get('/:idquodom', auth.verifyToken(), getAllbyIdQuodom);
router.post('/add', auth.verifyToken(), addSchema, add);
router.put('/:id', auth.verifyToken(), update);
router.delete('/:id', auth.verifyToken(), _delete);

module.exports = router;

function addSchema(req, res, next) {
  const schema = Joi.object({
    idquodom: Joi.string().required(),
    idproducto: Joi.number().integer().required(),
    cantidad: Joi.number().integer().required(),
    nombreProducto: Joi.string(),
    atributo1: Joi.string().empty(''),
    atributo2: Joi.string().empty('')
  });
  validateRequest(req, next, schema);
}

function add(req, res, next) {
  Controler.add(req.body, req.user.id)
    .then((id) => res.json({ res: true, id: id }))
    .catch(next);
}

function getAllbyIdQuodom(req, res, next) {
  Controler.getAll(req.params.idquodom, req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function getAtributos(req, res, next) {
  Controler.getAtributos(req.query.idproducto, req.query.nombreatributo)
    .then(data => res.json(data))
    .catch(next);
}

function getById(req, res, next) {
  Controler.getById(req.params.id)
    .then(data => res.json({
      idproducto: data.idproducto,
      detalleProducto: data.detalleProducto,
      cantidad: data.cantidad
    }))
    .catch(next);
}

function update(req, res, next) {
  Controler.update(req.params.id, req.body, req.user.id)
    .then(data => res.json({ res: true, message: 'Producto actualizado.' }))
    .catch(next);
}

function _delete(req, res, next) {
  Controler.delete(req.params.id, req.user.id)
    .then(() => res.json({ res: true, message: 'Eliminado.' }))
    .catch(next);
}
```

- [ ] **Step 8: Montar las rutas en `server.js`:**

```js
app.use('/quodom', require('./routes/quodom.route'));
app.use('/quodom_lines', require('./routes/quodom_lines.route'));
```

- [ ] **Step 9: Correr el test y verificar que pasa**

```bash
cd quodom-web/api && npm test tests/quodom.test.js
```
Expected: PASS (9 tests).

- [ ] **Step 10: Correr toda la suite** (`npm test`) — Expected: PASS. **Commit**

```bash
git add quodom-web/api/src quodom-web/api/tests
git commit -m "feat: add quodom and quodom_lines endpoints with ownership validation"
```

---

### Task 8: Direcciones, provincias y localidades

**Files:**
- Create: `quodom-web/api/src/controllers/user_direcciones.controller.js`
- Create: `quodom-web/api/src/routes/user_direcciones.route.js`
- Create: `quodom-web/api/src/controllers/provincias.controller.js`
- Create: `quodom-web/api/src/routes/provincias.route.js`
- Create: `quodom-web/api/src/controllers/localidades.controller.js`
- Create: `quodom-web/api/src/routes/localidades.route.js`
- Modify: `quodom-web/api/src/server.js` (montar las 3 rutas)
- Test: `quodom-web/api/tests/direcciones.test.js`

Cambios respecto del original:
- Sin `Zona`/`idzona` ni `Partido` (conceptos de vendedores/Google Maps): `localidad` viaja como texto libre en el body.
- Se elimina `POST /createPublic` (sin autenticación cualquiera creaba direcciones). `create` toma `userid` del token, no del body.
- `updatePrincipal`: fix del crash original cuando ningún registro tiene `default: true` (hacía `dir.default = false` sobre null).
- Localidades: se elimina la rama `VENDEDOR` y el filtro `comprador: 1`. (La tabla queda sin seed — la UI usa texto libre — pero el endpoint queda operativo por paridad.)

- [ ] **Step 1: Escribir el test que falla** — `quodom-web/api/tests/direcciones.test.js`

```js
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');

let token;
let iddireccion;

beforeAll(async () => {
  await db.ready;
  await db.provincia.create({ id: 1, provincia: 'Buenos Aires' });
  await request(app).post('/users/signup').send({
    username: 'ana', email: 'ana@test.com', nombre: 'Ana', password: 'secreto123',
    codArea: '11', telefono: '55554444'
  });
  const login = await request(app).post('/users/signin').send({ username: 'ana', password: 'secreto123' });
  token = login.body.token;
});

describe('direcciones', () => {
  it('GET /provincias returns the list without auth', async () => {
    const res = await request(app).get('/provincias');
    expect(res.status).toBe(200);
    expect(res.body[0].provincia).toBe('Buenos Aires');
  });

  it('POST /user_direcciones/create resolves provincia name and owner from token', async () => {
    const res = await request(app).post('/user_direcciones/create')
      .set('Authorization', 'Bearer ' + token)
      .send({
        alias: 'Casa', calle: 'Corrientes', numero: '1234', cp: '1043',
        localidad: 'CABA', idprovincia: 1, default: true
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ res: true, message: 'Creado.' });

    const dirs = await request(app).get('/users/dire/').set('Authorization', 'Bearer ' + token);
    expect(dirs.body).toHaveLength(1);
    expect(dirs.body[0].provincia).toBe('Buenos Aires');
    iddireccion = dirs.body[0].id;
  });

  it('PUT /user_direcciones/prin/:id works even without previous default', async () => {
    const res = await request(app).put('/user_direcciones/prin/' + iddireccion)
      .set('Authorization', 'Bearer ' + token)
      .send({});
    expect(res.status).toBe(200);
  });

  it('GET /users/direcciondefault returns the default address', async () => {
    const res = await request(app).get('/users/direcciondefault/')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.alias).toBe('Casa');
  });

  it('DELETE /user_direcciones/:id removes the address', async () => {
    const res = await request(app).delete('/user_direcciones/' + iddireccion)
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.res).toBe(true);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd quodom-web/api && npm test tests/direcciones.test.js
```
Expected: FAIL — 404 en `/provincias`.

- [ ] **Step 3: Crear `quodom-web/api/src/controllers/user_direcciones.controller.js`**

```js
const db = require('../helpers/db');

module.exports = {
    getById,
    getDireccionDefault,
    create,
    update,
    updatePrincipal,
    delete: _delete
};

async function getDireccionDefault(userId) {
    return await db.user_direcciones.findOne({
        where: { userid: userId, default: true },
        attributes: { exclude: ['createdAt', 'updatedAt'] }
    });
}

async function getById(id) {
    return await getDirecciones(id);
}

async function create(params, userId) {
    params.userid = userId;

    const Provincia = await db.provincia.findByPk(params.idprovincia);
    if (Provincia) {
        params.provincia = Provincia.provincia;
    }

    await db.user_direcciones.create(params);
}

async function update(id, params, userId) {
    const direcciones = await getDirecciones(id);
    if (direcciones.userid !== userId) {
        throw 'La dirección no pertenece a el usuario.';
    }

    const Provincia = await db.provincia.findByPk(params.idprovincia);
    if (Provincia) {
        params.provincia = Provincia.provincia;
    }

    Object.assign(direcciones, params);
    await direcciones.save();
}

async function updatePrincipal(id, userId) {
    // Original crashed when no row had default=true (dir.default on null)
    const dir = await db.user_direcciones.findOne({ where: { default: true, userid: userId } });
    if (dir) {
        dir.default = false;
        await dir.save();
    }

    const direcciones = await getDirecciones(id);
    if (direcciones.userid !== userId) {
        throw 'La dirección no pertenece a el usuario.';
    }
    direcciones.default = true;
    await direcciones.save();
}

async function _delete(id, userId) {
    const direcciones = await getDirecciones(id);
    if (direcciones.userid !== userId) {
        throw 'La dirección no pertenece a el usuario.';
    }
    await direcciones.destroy();
}

// helpers
async function getDirecciones(id) {
    const direcciones = await db.user_direcciones.findByPk(id);
    if (!direcciones) throw 'Direccion not found';
    return direcciones;
}
```

- [ ] **Step 4: Crear `quodom-web/api/src/routes/user_direcciones.route.js`**

```js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Controler = require('../controllers/user_direcciones.controller');

router.get('/direcciondefault', auth.verifyToken(), getDireccionDefault);
router.get('/:id', auth.verifyToken(), getById);
router.post('/create', auth.verifyToken(), create);
router.put('/prin/:id', auth.verifyToken(), updatePrincipal);
router.put('/:id', auth.verifyToken(), update);
router.delete('/:id', auth.verifyToken(), _delete);

module.exports = router;

function getById(req, res, next) {
  Controler.getById(req.params.id)
    .then(data => res.json(data))
    .catch(next);
}

function getDireccionDefault(req, res, next) {
  Controler.getDireccionDefault(req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function create(req, res, next) {
  Controler.create(req.body, req.user.id)
    .then(() => res.json({ res: true, message: 'Creado.' }))
    .catch(next);
}

function update(req, res, next) {
  Controler.update(req.params.id, req.body, req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function updatePrincipal(req, res, next) {
  Controler.updatePrincipal(req.params.id, req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function _delete(req, res, next) {
  Controler.delete(req.params.id, req.user.id)
    .then(() => res.json({ res: true, message: 'Eliminado.' }))
    .catch(next);
}
```

- [ ] **Step 5: Crear `quodom-web/api/src/controllers/provincias.controller.js`**

```js
const db = require('../helpers/db');

module.exports = {
    getAll
};

async function getAll() {
    return await db.provincia.findAll({
        order: [['provincia', 'ASC']],
        attributes: { exclude: ['createdAt', 'updatedAt'] }
    });
}
```

- [ ] **Step 6: Crear `quodom-web/api/src/routes/provincias.route.js`** (pública — se usa en el registro/direcciones antes de tener perfil completo)

```js
const express = require('express');
const router = express.Router();
const Controler = require('../controllers/provincias.controller');

router.get('/', getAll);

module.exports = router;

function getAll(req, res, next) {
    Controler.getAll()
        .then(datas => res.json(datas))
        .catch(next);
}
```

- [ ] **Step 7: Crear `quodom-web/api/src/controllers/localidades.controller.js`**

```js
const db = require('../helpers/db');

module.exports = {
    getLocalidadProv
};

async function getLocalidadProv(idprovincia) {
    return await db.localidad.findAll({
        where: { idprovincia: idprovincia },
        order: [['nombre', 'ASC']],
        attributes: { exclude: ['createdAt', 'updatedAt'] }
    });
}
```

- [ ] **Step 8: Crear `quodom-web/api/src/routes/localidades.route.js`**

```js
const express = require('express');
const router = express.Router();
const Controler = require('../controllers/localidades.controller');

router.get('/prov', getLocalidadProv);

module.exports = router;

function getLocalidadProv(req, res, next) {
    Controler.getLocalidadProv(req.query.idprovincia)
        .then(datas => res.json(datas))
        .catch(next);
}
```

- [ ] **Step 9: Montar las rutas en `server.js`:**

```js
app.use('/user_direcciones', require('./routes/user_direcciones.route'));
app.use('/provincias', require('./routes/provincias.route'));
app.use('/localidades', require('./routes/localidades.route'));
```

- [ ] **Step 10: Correr el test y verificar que pasa**

```bash
cd quodom-web/api && npm test tests/direcciones.test.js
```
Expected: PASS (5 tests).

- [ ] **Step 11: Correr toda la suite** (`npm test`) — Expected: PASS. **Commit**

```bash
git add quodom-web/api/src quodom-web/api/tests
git commit -m "feat: add user addresses, provinces and localities endpoints without vendor zones"
```

---

### Task 9: Notificaciones internas

**Files:**
- Create: `quodom-web/api/src/controllers/oper_notificaciones.controller.js`
- Create: `quodom-web/api/src/routes/oper_notificaciones.route.js`
- Modify: `quodom-web/api/src/server.js` (montar `/oper_notificaciones`)
- Test: `quodom-web/api/tests/notificaciones.test.js`

Cambios respecto del original: se eliminan `add` y `sendQuodom` (creaban notificaciones para vendedores/cotizaciones). Las notificaciones las crea el backend internamente (Task 10 crea la de "Quodom enviado"). Se corrige el bug del route original `update` que hacía `.then(res.json(...))` ejecutando el `res.json` de inmediato.

- [ ] **Step 1: Escribir el test que falla** — `quodom-web/api/tests/notificaciones.test.js`

```js
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');

let token;
let userId;
let idnotif;

beforeAll(async () => {
  await db.ready;
  const signup = await request(app).post('/users/signup').send({
    username: 'ana', email: 'ana@test.com', nombre: 'Ana', password: 'secreto123',
    codArea: '11', telefono: '55554444'
  });
  userId = signup.body.id;
  const login = await request(app).post('/users/signin').send({ username: 'ana', password: 'secreto123' });
  token = login.body.token;

  const n = await db.oper_notificaciones.create({
    userId: userId,
    titulo: 'Quodom enviado',
    texto: 'Tu Quodom QD-1 fue enviado por WhatsApp.',
    tiponotificacion: 'QUODOMENVIADO',
    idquodom: 'q1',
    enviada: 0,
    leida: 0
  });
  idnotif = n.id;
});

describe('notificaciones', () => {
  it('GET /oper_notificaciones returns user notifications', async () => {
    const res = await request(app).get('/oper_notificaciones')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].tiponotificacion).toBe('QUODOMENVIADO');
  });

  it('GET /oper_notificaciones/count returns unread count', async () => {
    const res = await request(app).get('/oper_notificaciones/count')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body).toBe(1);
  });

  it('PUT /oper_notificaciones/:id marks it as read', async () => {
    const res = await request(app).put('/oper_notificaciones/' + idnotif)
      .set('Authorization', 'Bearer ' + token)
      .send({ leida: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ res: true });

    const count = await request(app).get('/oper_notificaciones/count')
      .set('Authorization', 'Bearer ' + token);
    expect(count.body).toBe(0);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd quodom-web/api && npm test tests/notificaciones.test.js
```
Expected: FAIL — 404 en `/oper_notificaciones`.

- [ ] **Step 3: Crear `quodom-web/api/src/controllers/oper_notificaciones.controller.js`**

```js
const db = require('../helpers/db');

module.exports = {
  getAll,
  getCount,
  update
};

async function getAll(userId) {
  return await db.oper_notificaciones.findAll({
    where: { userId: userId },
    order: [['createdAt', 'DESC']],
    attributes: ['id', 'titulo', 'texto', 'tiponotificacion', 'idquodom', 'createdAt', 'leida']
  });
}

async function getCount(userId) {
  return await db.oper_notificaciones.count({
    where: { userId: userId, leida: 0 }
  });
}

async function update(id, params, userId) {
  const notif = await db.oper_notificaciones.findByPk(id);
  if (!notif) throw 'Err. Notificacion no encontrada.';
  if (notif.userId !== userId) throw 'La notificación no pertenece a el usuario.';
  Object.assign(notif, params);
  await notif.save();
  return true;
}
```

- [ ] **Step 4: Crear `quodom-web/api/src/routes/oper_notificaciones.route.js`**

```js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Controler = require('../controllers/oper_notificaciones.controller');

router.get('/', auth.verifyToken(), getAll);
router.get('/count', auth.verifyToken(), getCount);
router.put('/:id', auth.verifyToken(), update);

module.exports = router;

function getAll(req, res, next) {
  Controler.getAll(req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function getCount(req, res, next) {
  Controler.getCount(req.user.id)
    .then(data => res.json(data))
    .catch(next);
}

function update(req, res, next) {
  Controler.update(req.params.id, req.body, req.user.id)
    .then(() => res.json({ res: true }))
    .catch(next);
}
```

- [ ] **Step 5: Montar la ruta en `server.js`:**

```js
app.use('/oper_notificaciones', require('./routes/oper_notificaciones.route'));
```

- [ ] **Step 6: Correr el test y verificar que pasa**

```bash
cd quodom-web/api && npm test tests/notificaciones.test.js
```
Expected: PASS (3 tests).

- [ ] **Step 7: Correr toda la suite** (`npm test`) — Expected: PASS. **Commit**

```bash
git add quodom-web/api/src quodom-web/api/tests
git commit -m "feat: add internal notifications endpoints (list, unread count, mark read)"
```

---

### Task 10: Exportación por WhatsApp

**Files:**
- Modify: `quodom-web/api/src/controllers/quodom.controller.js` (agregar `whatsappLink`)
- Modify: `quodom-web/api/src/routes/quodom.route.js` (agregar `GET /whatsapp/:id`)
- Test: `quodom-web/api/tests/whatsapp.test.js`

Este endpoint reemplaza el `enviarQuodom` original (que notificaba a vendedores). Genera el mensaje en español con el detalle del Quodom + datos de contacto del comprador (vista `v_InfoCompradors`), marca el Quodom como `ENVIADO` la primera vez, crea la notificación interna y devuelve el link `https://wa.me/?text=...`.

- [ ] **Step 1: Escribir el test que falla** — `quodom-web/api/tests/whatsapp.test.js`

```js
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');

let token;
let idquodom;

beforeAll(async () => {
  await db.ready;
  await db.series.create({ codigo: 'QUODOM', utilizado: 0, sigla: 'QD-' });
  await db.Category.bulkCreate([
    { id: 5, nombrecategoria: 'Pintura', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 35, nombrecategoria: 'Latex', idcategoriapadre: 5, activa: true, orden: 1 }
  ]);
  await db.Products.create({
    id: 100, nombreproducto: 'Latex interior 20L', categoria: 35, categoriaPadre: 5,
    atributo1: 'Color', atributo2: null
  });

  await request(app).post('/users/signup').send({
    username: 'ana', email: 'ana@test.com', nombre: 'Ana', apellido: 'Perez',
    password: 'secreto123', codArea: '11', telefono: '55554444'
  });
  const login = await request(app).post('/users/signin').send({ username: 'ana', password: 'secreto123' });
  token = login.body.token;

  const q = await request(app).post('/quodom/create')
    .set('Authorization', 'Bearer ' + token)
    .send({ descripcion: 'Pintura Dpto' });
  idquodom = q.body.idquodom;
});

describe('whatsapp export', () => {
  it('rejects a quodom without lines', async () => {
    const res = await request(app).get('/quodom/whatsapp/' + idquodom)
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El Quodom no tiene productos.');
  });

  it('returns a wa.me link with the detail and marks the quodom ENVIADO', async () => {
    await request(app).post('/quodom_lines/add')
      .set('Authorization', 'Bearer ' + token)
      .send({ idquodom: idquodom, idproducto: 100, cantidad: 2, nombreProducto: 'Latex interior 20L', atributo1: 'Blanco' });

    const res = await request(app).get('/quodom/whatsapp/' + idquodom)
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.res).toBe(true);
    expect(res.body.link).toMatch(/^https:\/\/wa\.me\/\?text=/);

    const msg = decodeURIComponent(res.body.link.replace('https://wa.me/?text=', ''));
    expect(msg).toContain('QD-1');
    expect(msg).toContain('Pintura Dpto');
    expect(msg).toContain('2 x Latex interior 20L');
    expect(msg).toContain('Color: Blanco');
    expect(msg).toContain('Ana Perez');
    expect(msg).toContain('1155554444');

    const q = await db.Quodom.findByPk(idquodom);
    expect(q.estado).toBe('ENVIADO');
    expect(q.fechaenvio).not.toBeNull();

    const notifs = await db.oper_notificaciones.count({ where: { idquodom: idquodom } });
    expect(notifs).toBe(1);
  });

  it('allows re-generating the link without duplicating the notification', async () => {
    const res = await request(app).get('/quodom/whatsapp/' + idquodom)
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    const notifs = await db.oper_notificaciones.count({ where: { idquodom: idquodom } });
    expect(notifs).toBe(1);
  });

  it('rejects a quodom from another user', async () => {
    await request(app).post('/users/signup').send({
      username: 'beto', email: 'beto@test.com', nombre: 'Beto', password: 'secreto123',
      codArea: '11', telefono: '44443333'
    });
    const login2 = await request(app).post('/users/signin').send({ username: 'beto', password: 'secreto123' });

    const res = await request(app).get('/quodom/whatsapp/' + idquodom)
      .set('Authorization', 'Bearer ' + login2.body.token);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El Id Quodom no pertenece a el usuario.');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd quodom-web/api && npm test tests/whatsapp.test.js
```
Expected: FAIL — 404 en `/quodom/whatsapp/:id` (cae en `GET /:id` y devuelve otra cosa, o 404).

- [ ] **Step 3: Agregar `whatsappLink` a `quodom-web/api/src/controllers/quodom.controller.js`.** Sumar `whatsappLink` al `module.exports` y agregar al final (antes de los helpers):

```js
async function whatsappLink(id, userId) {
    const quodom = await getQuodom(id);
    if (quodom.createdBy !== userId) {
        throw 'El Id Quodom no pertenece a el usuario.';
    }

    const lines = await db.v_Quodoms_lines.findAll({
        where: { idquodom: id }
    });
    if (lines.length === 0) {
        throw 'El Quodom no tiene productos.';
    }

    const info = await db.v_InfoCompradors.findOne({
        where: { idquodom: id }
    });

    let msg = '*QUODOM ' + quodom.nro + ': ' + quodom.descripcion + '*\n\n';
    msg += '*Productos:*\n';
    for (const l of lines) {
        msg += '- ' + l.cantidad + ' x ' + l.nombreProducto;
        const attrs = [];
        if (l.nombreAtributo1 && l.atributo1) attrs.push(l.nombreAtributo1 + ': ' + l.atributo1);
        if (l.nombreAtributo2 && l.atributo2) attrs.push(l.nombreAtributo2 + ': ' + l.atributo2);
        if (attrs.length > 0) msg += ' (' + attrs.join(', ') + ')';
        msg += '\n';
    }

    msg += '\n*Datos de contacto:*\n';
    msg += 'Nombre: ' + info.NombreComprador.trim() + '\n';
    msg += 'Teléfono: ' + info.telefono + '\n';
    msg += 'Email: ' + info.email + '\n';
    if (info.Direccion && info.Direccion.trim() !== '') {
        msg += 'Dirección: ' + info.Direccion.trim();
        if (info.Localidad) msg += ', ' + info.Localidad;
        if (info.Provincia) msg += ', ' + info.Provincia;
        if (info.cp) msg += ' (CP ' + info.cp + ')';
        msg += '\n';
    }

    if (quodom.estado === 'CREADO') {
        quodom.estado = 'ENVIADO';
        quodom.fechaenvio = new Date();
        await quodom.save();

        await db.oper_notificaciones.create({
            userId: userId,
            titulo: 'Quodom enviado',
            texto: 'Tu Quodom ' + quodom.nro + ' fue enviado por WhatsApp.',
            tiponotificacion: 'QUODOMENVIADO',
            idquodom: id,
            enviada: 0,
            leida: 0
        });
    }

    return 'https://wa.me/?text=' + encodeURIComponent(msg);
}
```

- [ ] **Step 4: Agregar la ruta en `quodom-web/api/src/routes/quodom.route.js`.** IMPORTANTE: registrarla ANTES de `router.get('/:id', ...)` (si no, `whatsapp` matchea como `:id`):

```js
router.get('/whatsapp/:id', auth.verifyToken(), whatsappLink);
```

y el handler:

```js
function whatsappLink(req, res, next) {
  Controler.whatsappLink(req.params.id, req.user.id)
    .then(link => res.json({ res: true, link }))
    .catch(next);
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

```bash
cd quodom-web/api && npm test tests/whatsapp.test.js
```
Expected: PASS (4 tests).

- [ ] **Step 6: Correr toda la suite** (`npm test`) — Expected: PASS. **Commit**

```bash
git add quodom-web/api/src quodom-web/api/tests
git commit -m "feat: add WhatsApp export endpoint generating wa.me link and marking quodom as sent"
```

---

### Task 11: CLAUDE.md de la API, verificación final

**Files:**
- Create: `quodom-web/api/CLAUDE.md`

- [ ] **Step 1: Crear `quodom-web/api/CLAUDE.md`**

```markdown
# Quodom Web API (quodom-web/api/CLAUDE.md)

Express + Sequelize 6 + SQLite, JavaScript (CommonJS). Port 1:1 de la API original sin vendedores ni pagos.

## Comandos
- `npm install` — instalar dependencias
- `npm run seed` — poblar `quodom.sqlite` desde `Documentacion 2.0/Categorias/Migracion.xlsx` (verifica 62 subcategorías / 644 productos)
- `npm run dev` — servidor en `http://localhost:3999` (nodemon)
- `npm test` — Jest + Supertest contra SQLite en memoria (`--runInBand`; cada archivo de test tiene su propia DB)

## Estructura
- `src/server.js` — app Express; exporta `app` (los tests la importan sin levantar el puerto)
- `src/routes/` → `src/controllers/` → `src/models/` + `src/helpers/db.js`
- `src/helpers/views.js` — vistas SQL (`v_Busquedas`, `v_Quodoms`, `v_Quodoms_Lines`, `v_InfoCompradors`). Los modelos `v_*` NO se sincronizan (son vistas); NUNCA usar `sequelize.sync()` global.
- `src/middleware/auth.js` — `verifyToken()` (JWT Bearer) / `isAdmin()`
- Config por `.env` (ver `.env.example`). Nunca commitear `.env` ni `quodom.sqlite`.

## Convenciones
- Errores tipo string lanzados desde controllers → el error-handler responde `{ res: false, message }` (400/404).
- Rutas públicas (guest): `/categorias`, `/productos/categoria/:id`, `/productos/:id`, `/busqueda`, `/provincias`, `/localidades/prov`. Todo lo demás requiere token.
- Estados de Quodom: `CREADO` → `ENVIADO` (vía `GET /quodom/whatsapp/:id`). No existen estados de cotización.
- Tests: integración con la DB real en memoria, sin mocks. Cada feature nueva agrega su archivo en `tests/`.
```

- [ ] **Step 2: Correr la suite completa y el seed real por última vez**

```bash
cd quodom-web/api && npm test && npm run seed
```
Expected: toda la suite PASS y `Seed verification OK (62 subcategories, 644 products).`

- [ ] **Step 3: Levantar el server y probar a mano**

```bash
cd quodom-web/api && npm start
```
En otra terminal: `curl http://localhost:3999/categorias` debe devolver las categorías raíz reales del Excel. Detener el server.

- [ ] **Step 4: Commit final**

```bash
git add quodom-web/api/CLAUDE.md
git commit -m "docs: add API-level CLAUDE.md with commands, structure and conventions"
```
