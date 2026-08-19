# Quodom por rubro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un Quodom pasa a ser un presupuesto de un solo rubro, con como máximo uno abierto por usuario y rubro, y el sidebar y la barra inferior muestran los Quodoms abiertos en tiempo real.

**Architecture:** El rubro se materializa en una columna nueva `quodom_headers.idrubro`, fijada al crear e inmutable. El backend es la autoridad: rechaza crear un segundo Quodom abierto del mismo rubro y rechaza líneas de otro rubro, ambos con 409. El frontend consulta el Quodom abierto del rubro antes de agregar; si no hay, pide confirmación al usuario antes de crearlo. La sincronización en pantalla usa el evento `quodom:changed` que ya existe.

**Tech Stack:** API — Express + Sequelize + SQLite, JavaScript, Jest + supertest (integración con SQLite real en memoria, sin mocks de base). App — React 18 + Vite + TypeScript, CSS plano, Vitest + Testing Library + happy-dom.

**Spec:** `docs/superpowers/specs/2026-08-18-quodom-por-rubro-design.md`

## Global Constraints

- **UI en español, código y commits en inglés** (CLAUDE.md §5).
- **Rubro** = categoría con `idcategoriapadre = 0`. Son 8: Limpieza (1), Librería (2), Papelera (3), Construcción (4), Pintura (5), Sanitarios (6), Bebidas (7), Seguridad Industrial (8).
- El rubro de un producto es `productos.categoriaPadre` — ya existe y ya está poblado. No hace falta join para validarlo.
- Tests de API: integración con SQLite real en memoria, **sin mocks de base de datos** (CLAUDE.md §5).
- Mobile-first estricto; paleta fondo `#F1F1F1`, acento `#E63946`, éxito `#2DAB66`, texto `#1A1A1A`, tarjetas `#FFFFFF`, panel oscuro `#1E1E2A`. Forma de hoja: `border-top-left-radius: 8px; border-bottom-right-radius: 8px;` (CLAUDE.md §4).
- HTML semántico estricto.
- Trabajar sólo en `quodom-web/`. `quodom-new/` está deprecado y el proyecto original (`F:\backup\Command Soluciones\Quodom\API` y `...\APP`) es de sólo lectura.

---

### Task 1: Errores HTTP con código de estado propio

El `errorHandler` actual sólo sabe mapear strings (400/404) y todo lo demás a 500. Las reglas de rubro necesitan 409 con un código de error legible. Sin esto, las tareas 3 y 4 no pueden responder lo que el spec pide.

**Files:**
- Create: `quodom-web/api/src/helpers/http-error.js`
- Modify: `quodom-web/api/src/middleware/error-handler.js`
- Test: `quodom-web/api/tests/http-error.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `httpError(status, error, message, extra = {})` → objeto plano `{ status, error, message, ...extra }` pensado para ser lanzado con `throw`. El `errorHandler` lo serializa como `{ res: false, error, message, ...extra }` con ese status.

- [ ] **Step 1: Write the failing test**

Crear `quodom-web/api/tests/http-error.test.js`:

```js
const errorHandler = require('../src/middleware/error-handler');
const { httpError } = require('../src/helpers/http-error');

function fakeRes() {
  return {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.payload = body; return this; }
  };
}

describe('http errors with an explicit status', () => {
  it('serializes a thrown httpError with its status, code and extras', () => {
    const res = fakeRes();
    errorHandler(httpError(409, 'rubro_duplicado', 'Ya tenés un Quodom abierto de Bebidas.', { idquodom: 'q-1' }), {}, res, () => {});

    expect(res.statusCode).toBe(409);
    expect(res.payload).toEqual({
      res: false,
      error: 'rubro_duplicado',
      message: 'Ya tenés un Quodom abierto de Bebidas.',
      idquodom: 'q-1'
    });
  });

  it('still maps plain strings to 400', () => {
    const res = fakeRes();
    errorHandler('Algo salió mal.', {}, res, () => {});
    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual({ res: false, message: 'Algo salió mal.' });
  });

  it('still hides unexpected errors behind a 500', () => {
    const res = fakeRes();
    errorHandler(new Error('boom'), {}, res, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.payload).toEqual({ res: false, message: 'Error en el servidor.' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/api && npx jest tests/http-error.test.js`
Expected: FAIL — `Cannot find module '../src/helpers/http-error'`.

- [ ] **Step 3: Create the helper**

Crear `quodom-web/api/src/helpers/http-error.js`:

```js
// Thrown values that carry their own HTTP status, so controllers can answer 409
// (and friends) without every route mapping error strings by hand.
function httpError(status, error, message, extra = {}) {
    return { status, error, message, ...extra };
}

module.exports = { httpError };
```

- [ ] **Step 4: Teach the error handler about it**

En `quodom-web/api/src/middleware/error-handler.js`, agregar el case en tercera posición, después del case de UnauthorizedError y antes del default. (express-jwt's `UnauthorizedError` carries `status = 401`, so placing it earlier would swallow it.)

```js
        case err !== null && typeof err === 'object' && Number.isInteger(err.status):
            const { status, ...body } = err;
            return res.status(status).json({ res: false, ...body });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd quodom-web/api && npx jest tests/http-error.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 6: Run the whole API suite for regressions**

Run: `cd quodom-web/api && npm test`
Expected: PASS. El error handler es compartido, así que esta corrida es la que confirma que no rompiste nada.

- [ ] **Step 7: Commit**

```bash
git add quodom-web/api/src/helpers/http-error.js quodom-web/api/src/middleware/error-handler.js quodom-web/api/tests/http-error.test.js
git commit -m "feat(api): support thrown errors carrying an explicit HTTP status"
```

---

### Task 2: Columna `idrubro`, vista y script de reset

**Files:**
- Modify: `quodom-web/api/src/models/quodom.model.js`
- Modify: `quodom-web/api/src/models/v_Quodoms.model.js`
- Modify: `quodom-web/api/src/helpers/views.js:10-25`
- Create: `quodom-web/api/src/seed/reset-quodoms.js`
- Modify: `quodom-web/api/package.json` (scripts)
- Test: `quodom-web/api/tests/quodom.rubro.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `quodom_headers.idrubro` (INTEGER, NOT NULL). `v_Quodoms` expone `idrubro` (INTEGER) y `nombrerubro` (STRING). `npm run reset-quodoms` vacía `quodom_headers` y `quodom_lines`.

- [ ] **Step 1: Write the failing test**

Crear `quodom-web/api/tests/quodom.rubro.test.js`:

```js
const db = require('../src/helpers/db');

beforeAll(async () => {
  await db.ready;
  await db.Category.bulkCreate([
    { id: 7, nombrecategoria: 'Bebidas', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 4, nombrecategoria: 'Construcción', idcategoriapadre: 0, activa: true, orden: 2 }
  ]);
});

describe('quodom rubro column', () => {
  it('stores idrubro on the quodom header', async () => {
    const q = await db.Quodom.create({
      descripcion: 'Bebidas oficina', createdBy: 'u-1', estado: 'CREADO', idrubro: 7
    });
    const reloaded = await db.Quodom.findByPk(q.id);
    expect(reloaded.idrubro).toBe(7);
  });

  it('exposes idrubro and nombrerubro through v_Quodoms', async () => {
    const q = await db.Quodom.create({
      descripcion: 'Obra', createdBy: 'u-2', estado: 'CREADO', idrubro: 4
    });
    const row = await db.v_Quodoms.findOne({ where: { id: q.id } });
    expect(row.idrubro).toBe(4);
    expect(row.nombrerubro).toBe('Construcción');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/api && npx jest tests/quodom.rubro.test.js`
Expected: FAIL — la columna `idrubro` no existe.

- [ ] **Step 3: Add the column to the model**

En `quodom-web/api/src/models/quodom.model.js`, dentro de `attributes`, después de `descripcion`:

```js
        idrubro: { type: DataTypes.INTEGER, allowNull: false },
```

- [ ] **Step 4: Add both columns to the view**

En `quodom-web/api/src/helpers/views.js`, en el `CREATE VIEW v_Quodoms`, agregar `q.idrubro` a la lista de columnas y el nombre por subconsulta:

```sql
        CREATE VIEW v_Quodoms AS
        SELECT q.id, q.descripcion, q.createdBy, q.estado, q.nro, q.iddireccion,
               q.idrubro,
               (SELECT c.nombrecategoria FROM categorias c WHERE c.id = q.idrubro) AS nombrerubro,
               q.fechaenvio, q.fechavencimientoenvio, q.fechavencimientoaceptacion,
               q.createdAt, q.updatedAt,
```

El resto del `CREATE VIEW` (cantproductos, porccompletado, los dos `julianday`, el `FROM` y el `WHERE`) queda exactamente igual.

- [ ] **Step 5: Add both columns to the view model**

En `quodom-web/api/src/models/v_Quodoms.model.js`, dentro de `attributes`:

```js
        idrubro: { type: DataTypes.INTEGER, allowNull: true },
        nombrerubro: { type: DataTypes.STRING, allowNull: true },
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd quodom-web/api && npx jest tests/quodom.rubro.test.js`
Expected: PASS, 2 tests.

- [ ] **Step 7: Write the reset script**

Crear `quodom-web/api/src/seed/reset-quodoms.js`:

```js
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
```

Las vistas (`v_Quodoms`, `v_Quodoms_Lines`) se recrean solas en el próximo arranque del server: `createViews` corre en cada `initialize()` con `DROP VIEW IF EXISTS` adelante.

- [ ] **Step 8: Register the script**

En `quodom-web/api/package.json`, dentro de `scripts`, después de `"seed"`:

```json
    "reset-quodoms": "node src/seed/reset-quodoms.js",
```

- [ ] **Step 9: Run it against the dev database**

Run: `cd quodom-web/api && npm run reset-quodoms`
Expected: imprime la lista de columnas de `quodom_headers` y **`idrubro` tiene que estar en esa lista**. Si no está, el drop no ocurrió y el script está mal: no sigas.

Esto borra los Quodoms de la base de desarrollo. Está autorizado y es intencional (spec §3.4), y `quodom-web/api/quodom.sqlite` está trackeado en git, así que es recuperable.

- [ ] **Step 10: Run the whole API suite**

Run: `cd quodom-web/api && npm test`
Expected: FALLAN los tests de `tests/quodom.test.js` que crean Quodoms sin `idrubro` (`allowNull: false`). **Es lo esperado en este punto** — la Task 3 los actualiza. Anotá cuáles fallan para verificarlos ahí.

- [ ] **Step 11: Commit**

```bash
git add quodom-web/api/src/models/quodom.model.js quodom-web/api/src/models/v_Quodoms.model.js quodom-web/api/src/helpers/views.js quodom-web/api/src/seed/reset-quodoms.js quodom-web/api/package.json quodom-web/api/tests/quodom.rubro.test.js
git commit -m "feat(api): add idrubro to quodom headers and expose it in v_Quodoms"
```

---

### Task 3: `POST /quodom/create` exige rubro y rechaza duplicados

**Files:**
- Modify: `quodom-web/api/src/routes/quodom.route.js` (`createSchema`, `updateSchema`)
- Modify: `quodom-web/api/src/controllers/quodom.controller.js` (`create`, `update`)
- Modify: `quodom-web/api/tests/quodom.test.js` (los `create` existentes)
- Test: `quodom-web/api/tests/quodom.rubro.test.js` (se le suman casos)

**Interfaces:**
- Consumes: `httpError` de Task 1; `idrubro` de Task 2.
- Produces: `POST /quodom/create` con body `{ descripcion, idrubro, iddireccion? }`. Responde 409 `rubro_duplicado` con `{ res: false, error, message, idquodom }` cuando ya hay uno abierto de ese rubro.

- [ ] **Step 1: Write the failing tests**

Agregar al final de `quodom-web/api/tests/quodom.rubro.test.js`, dentro de un `describe` nuevo. Necesita un usuario real, así que agregá también el `beforeAll` de signup:

```js
const request = require('supertest');
const app = require('../src/server');

describe('create enforces one open quodom per rubro', () => {
  let token;

  beforeAll(async () => {
    await db.series.findOrCreate({ where: { codigo: 'QUODOM' }, defaults: { codigo: 'QUODOM', utilizado: 0, sigla: 'QD-' } });
    await request(app).post('/users/signup').send({
      username: 'rubro', email: 'rubro@test.com', nombre: 'Rubro', password: 'secreto123',
      codArea: '11', telefono: '55554444'
    });
    const login = await request(app).post('/users/signin').send({ username: 'rubro', password: 'secreto123' });
    token = login.body.token;
  });

  it('rejects a create without idrubro', async () => {
    const res = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Sin rubro' });
    expect(res.status).toBe(400);
  });

  it('creates the first quodom of a rubro', async () => {
    const res = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Bebidas', idrubro: 7 });
    expect(res.status).toBe(200);
    const q = await db.Quodom.findByPk(res.body.idquodom);
    expect(q.idrubro).toBe(7);
  });

  it('rejects a second open quodom of the same rubro with 409', async () => {
    const res = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Bebidas otra vez', idrubro: 7 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('rubro_duplicado');
    expect(res.body.message).toContain('Bebidas');
    expect(res.body.idquodom).toBeDefined();
  });

  it('allows a second quodom of the same rubro once the first is ENVIADO', async () => {
    const abierto = await db.Quodom.findOne({ where: { createdBy: (await db.User.findOne({ where: { username: 'rubro' } })).id, idrubro: 7, estado: 'CREADO' } });
    abierto.estado = 'ENVIADO';
    await abierto.save();

    const res = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Bebidas nueva tanda', idrubro: 7 });
    expect(res.status).toBe(200);
  });

  it('allows a different rubro while one is open', async () => {
    const res = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Obra', idrubro: 4 });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd quodom-web/api && npx jest tests/quodom.rubro.test.js`
Expected: FAIL — el create sin `idrubro` devuelve 200, y el duplicado también.

- [ ] **Step 3: Require idrubro in the schema**

En `quodom-web/api/src/routes/quodom.route.js`, en `createSchema`:

```js
function createSchema(req, res, next) {
  const schema = Joi.object({
    descripcion: Joi.string().required(),
    idrubro: Joi.number().integer().required(),
    iddireccion: Joi.number().integer().empty(null)
  });
  validateRequest(req, next, schema);
}
```

`updateSchema` **no** lleva `idrubro`: el rubro es inmutable, y Joi por defecto rechaza claves desconocidas, así que un intento de cambiarlo ya muere en 400.

- [ ] **Step 4: Enforce the rule in the controller**

En `quodom-web/api/src/controllers/quodom.controller.js`, arriba, junto a los otros require:

```js
const { httpError } = require('../helpers/http-error');
```

Y al principio de `create`, antes de resolver la dirección:

```js
async function create(params, userId) {
    const abierto = await db.Quodom.findOne({
        where: { createdBy: userId, idrubro: params.idrubro, estado: 'CREADO' }
    });
    if (abierto) {
        const rubro = await db.Category.findByPk(params.idrubro);
        throw httpError(409, 'rubro_duplicado',
            'Ya tenés un Quodom abierto de ' + (rubro ? rubro.nombrecategoria : 'ese rubro') + '.',
            { idquodom: abierto.id });
    }

    if (!params.iddireccion) {
```

El resto de `create` queda igual.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd quodom-web/api && npx jest tests/quodom.rubro.test.js`
Expected: PASS.

- [ ] **Step 6: Update the existing suite**

Hacer `idrubro` NOT NULL rompió **tres** suites, no una. Medido después de la Task 2:

- `tests/quodom.test.js`
- `tests/whatsapp.test.js`
- `tests/db.test.js`

En las tres, todo `create` de Quodom pasa a llevar el rubro. Para los que van por HTTP, el rubro del producto de prueba es Pintura (5):

```js
      .send({ descripcion: 'Pintura Dpto', idrubro: 5 });
```

Para los que crean por Sequelize directo (`db.Quodom.create({...})`, típico en `db.test.js`), agregá `idrubro: 5` al objeto.

Aplicá lo mismo a todos los `create` de los tres archivos. Si algún test crea dos Quodoms para el mismo usuario, usá rubros distintos (5 y 4) o marcá el primero como `ENVIADO` antes del segundo — si no, ahora choca con la regla de un Quodom abierto por rubro.

Corré `npx jest` y verificá que las tres suites quedan verdes. Si aparece una cuarta suite rota, arreglala también con el mismo criterio.

- [ ] **Step 7: Run the whole API suite**

Run: `cd quodom-web/api && npm test`
Expected: PASS. Acá se cierran los fallos que anotaste en la Task 2 Step 10.

- [ ] **Step 8: Commit**

```bash
git add quodom-web/api/src/routes/quodom.route.js quodom-web/api/src/controllers/quodom.controller.js quodom-web/api/tests/quodom.test.js quodom-web/api/tests/quodom.rubro.test.js
git commit -m "feat(api): require idrubro on create and reject a second open quodom per rubro"
```

---

### Task 4: `POST /quodom_lines/add` valida el rubro

**Files:**
- Modify: `quodom-web/api/src/controllers/quodom_lines.controller.js:40-59`
- Test: `quodom-web/api/tests/quodom.rubro.test.js`

**Interfaces:**
- Consumes: `httpError` de Task 1; `idrubro` de Task 2.
- Produces: `POST /quodom_lines/add` responde 409 `rubro_mismatch` cuando `producto.categoriaPadre !== quodom.idrubro`, y no crea la línea.

- [ ] **Step 1: Write the failing tests**

Agregar a `quodom-web/api/tests/quodom.rubro.test.js` un `describe` nuevo. Necesita dos productos de rubros distintos; agregalos en el `beforeAll` del archivo:

```js
  // Las subcategorías tienen que existir: add() llama a getCat(producto.categoria)
  // y lanza 'Err. Id de categoria no encontrado.' (400) si falta, lo que haría
  // fallar el caso feliz antes de llegar a la validación de rubro.
  await db.Category.bulkCreate([
    { id: 70, nombrecategoria: 'Gaseosas', idcategoriapadre: 7, activa: true, orden: 1 },
    { id: 40, nombrecategoria: 'Cementos', idcategoriapadre: 4, activa: true, orden: 1 }
  ]);
  await db.Products.bulkCreate([
    { id: 700, nombreproducto: 'Gaseosa 2L', categoria: 70, categoriaPadre: 7, atributo1: null, atributo2: null },
    { id: 400, nombreproducto: 'Cemento 50kg', categoria: 40, categoriaPadre: 4, atributo1: null, atributo2: null }
  ]);
```

Estas dos líneas van en el `beforeAll` de arriba del archivo (el que creó la Task 2), no en un `beforeAll` nuevo: editá el existente.

Y el describe:

```js
describe('add line enforces the quodom rubro', () => {
  let token;
  let idquodomBebidas;

  beforeAll(async () => {
    const login = await request(app).post('/users/signin').send({ username: 'rubro', password: 'secreto123' });
    token = login.body.token;
    const userId = (await db.User.findOne({ where: { username: 'rubro' } })).id;
    await db.Quodom.destroy({ where: { createdBy: userId } });
    const res = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Bebidas', idrubro: 7 });
    idquodomBebidas = res.body.idquodom;
  });

  it('accepts a product of the same rubro', async () => {
    const res = await request(app).post('/quodom_lines/add')
      .set('Authorization', 'Bearer ' + token)
      .send({ idquodom: idquodomBebidas, idproducto: 700, cantidad: 1, nombreProducto: 'Gaseosa 2L' });
    expect(res.status).toBe(200);
  });

  it('rejects a product of another rubro with 409 and creates no line', async () => {
    const antes = await db.Quodom_Lines.count({ where: { idquodom: idquodomBebidas } });

    const res = await request(app).post('/quodom_lines/add')
      .set('Authorization', 'Bearer ' + token)
      .send({ idquodom: idquodomBebidas, idproducto: 400, cantidad: 1, nombreProducto: 'Cemento 50kg' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('rubro_mismatch');
    expect(res.body.message).toContain('Construcción');
    expect(res.body.message).toContain('Bebidas');
    expect(await db.Quodom_Lines.count({ where: { idquodom: idquodomBebidas } })).toBe(antes);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd quodom-web/api && npx jest tests/quodom.rubro.test.js`
Expected: FAIL — el alta de otro rubro devuelve 200 y crea la línea.

- [ ] **Step 3: Validate in the controller**

En `quodom-web/api/src/controllers/quodom_lines.controller.js`, agregar el require arriba:

```js
const { httpError } = require('../helpers/http-error');
```

Y en `add`, entre la resolución del producto y el armado de `params`:

```js
async function add(params, userId) {
    const quodom = await ValidarQuodom(params.idquodom, userId, 'ADD');

    const producto = await getPr(params.idproducto);

    if (producto.categoriaPadre !== quodom.idrubro) {
        const [rubroProducto, rubroQuodom] = await Promise.all([
            db.Category.findByPk(producto.categoriaPadre),
            db.Category.findByPk(quodom.idrubro)
        ]);
        throw httpError(409, 'rubro_mismatch',
            'No se pueden mezclar rubros: este producto es de '
            + (rubroProducto ? rubroProducto.nombrecategoria : 'otro rubro')
            + ' y el Quodom es de '
            + (rubroQuodom ? rubroQuodom.nombrecategoria : 'otro rubro') + '.');
    }

    params.categoria = producto.categoria;
```

- [ ] **Step 4: Make ValidarQuodom return the quodom**

`ValidarQuodom` hoy no devuelve nada. En `quodom-web/api/src/controllers/quodom_lines.controller.js`, al final de la función, después de las validaciones existentes:

```js
    return Quodom;
```

Verificá los otros llamadores de `ValidarQuodom` en el archivo: siguen funcionando porque ignorar un valor de retorno es inofensivo.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd quodom-web/api && npx jest tests/quodom.rubro.test.js`
Expected: PASS.

- [ ] **Step 6: Run the whole API suite**

Run: `cd quodom-web/api && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add quodom-web/api/src/controllers/quodom_lines.controller.js quodom-web/api/tests/quodom.rubro.test.js
git commit -m "feat(api): reject quodom lines from a different rubro"
```

---

### Task 5: `GET /quodom/activo/:idrubro` reemplaza a `getLastQuodom`

**Files:**
- Modify: `quodom-web/api/src/routes/quodom.route.js:15,73-77`
- Modify: `quodom-web/api/src/controllers/quodom.controller.js` (`getLastQuodomOrCreate` → `getActivoPorRubro`, `repetir`)
- Test: `quodom-web/api/tests/quodom.rubro.test.js`

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: `GET /quodom/activo/:idrubro` → `{ res: true, data: <quodom de v_Quodoms> | null }`. **No crea nada.** `POST /quodom/getLastQuodom/` deja de existir.

- [ ] **Step 1: Write the failing tests**

Agregar a `quodom-web/api/tests/quodom.rubro.test.js`:

```js
describe('GET /quodom/activo/:idrubro', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const login = await request(app).post('/users/signin').send({ username: 'rubro', password: 'secreto123' });
    token = login.body.token;
    userId = (await db.User.findOne({ where: { username: 'rubro' } })).id;
    await db.Quodom.destroy({ where: { createdBy: userId } });
  });

  it('returns null and creates nothing when there is no open quodom of that rubro', async () => {
    const antes = await db.Quodom.count();

    const res = await request(app).get('/quodom/activo/7')
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
    expect(await db.Quodom.count()).toBe(antes);
  });

  it('returns the open quodom of that rubro with its nombrerubro', async () => {
    const creado = await request(app).post('/quodom/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Bebidas', idrubro: 7 });

    const res = await request(app).get('/quodom/activo/7')
      .set('Authorization', 'Bearer ' + token);

    expect(res.body.data.id).toBe(creado.body.idquodom);
    expect(res.body.data.nombrerubro).toBe('Bebidas');
  });

  it('ignores quodoms of other rubros and other users', async () => {
    const res = await request(app).get('/quodom/activo/4')
      .set('Authorization', 'Bearer ' + token);
    expect(res.body.data).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd quodom-web/api && npx jest tests/quodom.rubro.test.js`
Expected: FAIL — 404, la ruta no existe.

- [ ] **Step 3: Replace the controller function**

En `quodom-web/api/src/controllers/quodom.controller.js`, reemplazar `getLastQuodomOrCreate` entera por:

```js
// The open ('CREADO') quodom of a rubro, or null. Deliberately does NOT create:
// creating a quodom now needs the user to confirm, so it cannot be a side effect
// of a lookup.
async function getActivoPorRubro(userId, idrubro) {
    const quodom = await db.v_Quodoms.findOne({
        where: { createdBy: userId, estado: 'CREADO', idrubro: idrubro },
        attributes: { exclude: ['createdBy', 'updatedAt'] },
        order: [['createdAt', 'DESC']]
    });
    return quodom || null;
}
```

Y en el objeto exportado de arriba del archivo, cambiar `getLastQuodomOrCreate,` por `getActivoPorRubro,`.

- [ ] **Step 4: Replace the route**

En `quodom-web/api/src/routes/quodom.route.js`, borrar la línea `router.post('/getLastQuodom/', ...)` y agregar, **antes** de `router.get('/:id', ...)` para que no la capture la ruta genérica:

```js
router.get('/activo/:idrubro', auth.verifyToken(), getActivo);
```

Y reemplazar la función `getLastQuodomOrCreate` del mismo archivo por:

```js
function getActivo(req, res, next) {
  Controler.getActivoPorRubro(req.user.id, parseInt(req.params.idrubro, 10))
    .then((data) => res.json({ res: true, data }))
    .catch(next);
}
```

- [ ] **Step 5: Make repetir inherit the rubro**

En `quodom-web/api/src/controllers/quodom.controller.js`, dentro de `repetir`, el `create` que arma el Quodom nuevo tiene que pasar `idrubro: quodom.idrubro`. Como `create` ya lanza 409 si hay uno abierto de ese rubro, repetir hereda esa protección sin código extra.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd quodom-web/api && npx jest tests/quodom.rubro.test.js`
Expected: PASS.

- [ ] **Step 7: Run the whole API suite**

Run: `cd quodom-web/api && npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add quodom-web/api/src/routes/quodom.route.js quodom-web/api/src/controllers/quodom.controller.js quodom-web/api/tests/quodom.rubro.test.js
git commit -m "feat(api): replace getLastQuodom with a non-creating activo/:idrubro lookup"
```

---

### Task 6: `v_Busquedas` expone el rubro

La pantalla de búsqueda agrega productos desde `BusquedaResult`, que hoy no trae el rubro. Sin esto, la Task 9 no puede decidir a qué Quodom va lo que se agrega desde el buscador.

**Files:**
- Modify: `quodom-web/api/src/helpers/views.js:4-8`
- Modify: `quodom-web/api/src/models/v_Busqueda.model.js`
- Modify: `quodom-web/app/src/api/types.ts` (`BusquedaResult` y `Quodom`)
- Test: `quodom-web/api/tests/catalogo.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `GET /busqueda?b=` devuelve además `categoriaPadre: number` en cada resultado. `BusquedaResult` incluye `categoriaPadre: number` y `Quodom` incluye `idrubro: number` y `nombrerubro?: string`. Las tareas 8 a 12 dependen de estos dos campos del tipo `Quodom`, por eso se agregan acá y no más adelante.

- [ ] **Step 1: Write the failing test**

Agregar a `quodom-web/api/tests/catalogo.test.js`, dentro del describe existente de búsqueda:

```js
  it('GET /busqueda includes the rubro of each result', async () => {
    const res = await request(app).get('/busqueda?b=Latex');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].categoriaPadre).toBe(5);
  });
```

(El producto sembrado en ese archivo es el Latex de rubro Pintura = 5. Verificá el `beforeAll` del archivo y ajustá el término de búsqueda y el rubro esperado a lo que realmente siembre.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/api && npx jest tests/catalogo.test.js`
Expected: FAIL — `categoriaPadre` es `undefined`.

- [ ] **Step 3: Add the column to the view**

En `quodom-web/api/src/helpers/views.js`:

```sql
        CREATE VIEW v_Busquedas AS
        SELECT p.id, p.nombreproducto AS nombre, p.descripcion, p.imagen, p.refreshImagen,
               p.categoriaPadre
        FROM productos p
```

- [ ] **Step 4: Add it to the view model**

En `quodom-web/api/src/models/v_Busqueda.model.js`, dentro de `attributes`:

```js
        categoriaPadre: { type: DataTypes.INTEGER, allowNull: true },
```

- [ ] **Step 5: Add it to the TypeScript type**

En `quodom-web/app/src/api/types.ts`:

```ts
export type BusquedaResult = { id: number; nombre: string; descripcion?: string | null; imagen: string | null; refreshImagen: string | null; categoriaPadre: number };
```

Y en el mismo archivo, sumar los dos campos nuevos al tipo `Quodom` (los devuelve `v_Quodoms` desde la Task 2):

```ts
export type Quodom = {
  id: string;
  descripcion: string;
  estado: 'CREADO' | 'ENVIADO';
  nro: string;
  createdBy: string;
  iddireccion: number | null;
  idrubro: number;
  nombrerubro?: string;
  cantproductos?: number;
  porccompletado?: number;
  fechaenvio?: string | null;
  createdAt?: string;
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd quodom-web/api && npx jest tests/catalogo.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add quodom-web/api/src/helpers/views.js quodom-web/api/src/models/v_Busqueda.model.js quodom-web/app/src/api/types.ts quodom-web/api/tests/catalogo.test.js
git commit -m "feat(api): expose the product rubro in search results"
```

---

### Task 7: Carrito de invitado por rubro

**Files:**
- Modify: `quodom-web/app/src/guest/guestQuodom.ts` (reescritura)
- Modify: `quodom-web/app/tests/guestQuodom.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type GuestCart = { descripcion: string; lines: GuestLine[] }`
  - `type GuestQuodoms = Record<number, GuestCart>` (clave: `idrubro`)
  - `getGuestQuodoms(): GuestQuodoms`
  - `getGuestCart(idrubro: number): GuestCart`
  - `addGuestLine(idrubro: number, line: GuestLine): void`
  - `setGuestDescripcion(idrubro: number, descripcion: string): void`
  - `updateGuestLineCantidad(idrubro: number, index: number, cantidad: number): void`
  - `updateGuestLineAtributos(idrubro: number, index: number, patch: { atributo1?: string; atributo2?: string }): void`
  - `removeGuestLine(idrubro: number, index: number): void`
  - `clearGuestCart(idrubro: number): void`
  - `clearGuestQuodoms(): void`
  - `guestRubrosConLineas(): number[]`
  - `guestLineCount(idrubro?: number): number` — total si no se pasa rubro

- [ ] **Step 1: Write the failing tests**

Reemplazar `quodom-web/app/tests/guestQuodom.test.ts` por tests sobre la forma nueva:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  addGuestLine, getGuestCart, getGuestQuodoms, clearGuestQuodoms,
  guestLineCount, guestRubrosConLineas, removeGuestLine, updateGuestLineCantidad
} from '../src/guest/guestQuodom';

const GASEOSA = { idproducto: 700, nombreProducto: 'Gaseosa 2L', cantidad: 1 };
const CEMENTO = { idproducto: 400, nombreProducto: 'Cemento 50kg', cantidad: 2 };

describe('guest carts by rubro', () => {
  beforeEach(() => clearGuestQuodoms());

  it('keeps two rubros side by side without mixing them', () => {
    addGuestLine(7, GASEOSA);
    addGuestLine(4, CEMENTO);

    expect(getGuestCart(7).lines).toEqual([GASEOSA]);
    expect(getGuestCart(4).lines).toEqual([CEMENTO]);
    expect(guestRubrosConLineas().sort()).toEqual([4, 7]);
  });

  it('sums the quantity when the same product is added twice to a rubro', () => {
    addGuestLine(7, GASEOSA);
    addGuestLine(7, { ...GASEOSA, cantidad: 3 });
    expect(getGuestCart(7).lines).toHaveLength(1);
    expect(getGuestCart(7).lines[0].cantidad).toBe(4);
  });

  it('counts lines per rubro and in total', () => {
    addGuestLine(7, GASEOSA);
    addGuestLine(4, CEMENTO);
    expect(guestLineCount(7)).toBe(1);
    expect(guestLineCount()).toBe(2);
  });

  it('drops a rubro from the map once its last line is removed', () => {
    addGuestLine(7, GASEOSA);
    removeGuestLine(7, 0);
    expect(guestRubrosConLineas()).toEqual([]);
    expect(getGuestQuodoms()[7]).toBeUndefined();
  });

  it('removes the line when the quantity drops to zero', () => {
    addGuestLine(4, CEMENTO);
    updateGuestLineCantidad(4, 0, 0);
    expect(getGuestCart(4).lines).toEqual([]);
  });

  it('discards a legacy single-cart payload instead of crashing', () => {
    localStorage.setItem('quodom.guest', JSON.stringify({ descripcion: 'viejo', lines: [GASEOSA] }));
    expect(getGuestQuodoms()).toEqual({});
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd quodom-web/app && npx vitest run tests/guestQuodom.test.ts`
Expected: FAIL — las funciones tienen otra firma.

- [ ] **Step 3: Rewrite the module**

Reemplazar `quodom-web/app/src/guest/guestQuodom.ts`:

```ts
const KEY = 'quodom.guest';

export type GuestLine = {
  idproducto: number;
  nombreProducto: string;
  cantidad: number;
  atributo1?: string;
  atributo2?: string;
  nombreAtributo1?: string;
  nombreAtributo2?: string;
};

export type GuestCart = { descripcion: string; lines: GuestLine[] };
export type GuestQuodoms = Record<number, GuestCart>;

function esMapaDeCarritos(parsed: unknown): parsed is GuestQuodoms {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  // The legacy shape was a single cart: { descripcion, lines }. Anything with a
  // top-level `lines` is that old payload and gets discarded.
  if ('lines' in (parsed as Record<string, unknown>)) return false;
  return Object.values(parsed as Record<string, unknown>).every(
    v => !!v && typeof v === 'object' && Array.isArray((v as GuestCart).lines)
  );
}

export function getGuestQuodoms(): GuestQuodoms {
  const raw = localStorage.getItem(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (esMapaDeCarritos(parsed)) return parsed;
  } catch {}
  return {};
}

function save(q: GuestQuodoms): void {
  localStorage.setItem(KEY, JSON.stringify(q));
}

export function getGuestCart(idrubro: number): GuestCart {
  return getGuestQuodoms()[idrubro] ?? { descripcion: '', lines: [] };
}

function sameLine(a: GuestLine, b: GuestLine): boolean {
  return a.idproducto === b.idproducto
    && (a.atributo1 ?? '') === (b.atributo1 ?? '')
    && (a.atributo2 ?? '') === (b.atributo2 ?? '');
}

export function addGuestLine(idrubro: number, line: GuestLine): void {
  const q = getGuestQuodoms();
  const cart = q[idrubro] ?? { descripcion: '', lines: [] };
  const idx = cart.lines.findIndex(l => sameLine(l, line));
  if (idx >= 0) cart.lines[idx].cantidad += line.cantidad;
  else cart.lines.push({ ...line });
  q[idrubro] = cart;
  save(q);
}

export function setGuestDescripcion(idrubro: number, descripcion: string): void {
  const q = getGuestQuodoms();
  const cart = q[idrubro] ?? { descripcion: '', lines: [] };
  cart.descripcion = descripcion;
  q[idrubro] = cart;
  save(q);
}

function mutar(idrubro: number, fn: (cart: GuestCart) => void): void {
  const q = getGuestQuodoms();
  const cart = q[idrubro];
  if (!cart) return;
  fn(cart);
  if (cart.lines.length === 0) delete q[idrubro];
  else q[idrubro] = cart;
  save(q);
}

export function updateGuestLineCantidad(idrubro: number, index: number, cantidad: number): void {
  mutar(idrubro, cart => {
    if (index < 0 || index >= cart.lines.length) return;
    if (cantidad <= 0) cart.lines.splice(index, 1);
    else cart.lines[index].cantidad = cantidad;
  });
}

export function updateGuestLineAtributos(idrubro: number, index: number, patch: { atributo1?: string; atributo2?: string }): void {
  mutar(idrubro, cart => {
    if (index < 0 || index >= cart.lines.length) return;
    cart.lines[index] = { ...cart.lines[index], ...patch };
  });
}

export function removeGuestLine(idrubro: number, index: number): void {
  mutar(idrubro, cart => {
    if (index < 0 || index >= cart.lines.length) return;
    cart.lines.splice(index, 1);
  });
}

export function clearGuestCart(idrubro: number): void {
  const q = getGuestQuodoms();
  delete q[idrubro];
  save(q);
}

export function clearGuestQuodoms(): void {
  localStorage.removeItem(KEY);
}

export function guestRubrosConLineas(): number[] {
  const q = getGuestQuodoms();
  return Object.keys(q).map(Number).filter(r => q[r].lines.length > 0);
}

export function guestLineCount(idrubro?: number): number {
  const q = getGuestQuodoms();
  if (idrubro !== undefined) return q[idrubro]?.lines.length ?? 0;
  return Object.values(q).reduce((acc, cart) => acc + cart.lines.length, 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd quodom-web/app && npx vitest run tests/guestQuodom.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Note the breakage**

Run: `cd quodom-web/app && npx tsc -b --noEmit`
Expected: FALLA en `agregarProducto.ts`, `migrateGuestQuodom.ts`, `DetalleQuodom.tsx` y `BarraQuodomInferior.tsx`, que todavía llaman a las firmas viejas. Las tareas 8, 10, 12 y 13 los arreglan. No intentes arreglarlos acá.

- [ ] **Step 6: Commit**

```bash
git add quodom-web/app/src/guest/guestQuodom.ts quodom-web/app/tests/guestQuodom.test.ts
git commit -m "feat(app): split the guest cart by rubro"
```

---

### Task 8: `agregarProducto` resuelve el rubro y pide confirmación

**Files:**
- Modify: `quodom-web/app/src/api/quodom.ts`
- Modify: `quodom-web/app/src/quodom/agregarProducto.ts` (reescritura)
- Modify: `quodom-web/app/src/quodom/__tests__/agregarProducto.test.ts`

**Interfaces:**
- Consumes: `GET /quodom/activo/:idrubro` (Task 5); carrito por rubro (Task 7).
- Produces:
  - `quodom.activoPorRubro(idrubro: number): Promise<Quodom | null>` en `api/quodom.ts`
  - `quodom.create(body: { descripcion: string; idrubro: number; iddireccion?: number | null })` — firma actualizada
  - `type AgregarResult = { estado: 'agregado'; idquodom: string | null } | { estado: 'necesita_confirmacion'; idrubro: number }`
  - `agregarProducto(line: GuestLine, opts: { logueado: boolean; idrubro: number }): Promise<AgregarResult>`
  - `confirmarYAgregar(line: GuestLine, opts: { logueado: boolean; idrubro: number; descripcion: string }): Promise<{ idquodom: string | null }>`

- [ ] **Step 1: Write the failing tests**

Reemplazar `quodom-web/app/src/quodom/__tests__/agregarProducto.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agregarProducto, confirmarYAgregar } from '../agregarProducto';
import { quodom as quodomApi } from '../../api/quodom';
import { quodomLines } from '../../api/quodom_lines';
import { getGuestCart, clearGuestQuodoms } from '../../guest/guestQuodom';

vi.mock('../../api/quodom', () => ({
  quodom: { activoPorRubro: vi.fn(), create: vi.fn() }
}));
vi.mock('../../api/quodom_lines', () => ({
  quodomLines: { add: vi.fn() }
}));

const activoPorRubro = quodomApi.activoPorRubro as unknown as ReturnType<typeof vi.fn>;
const create = quodomApi.create as unknown as ReturnType<typeof vi.fn>;
const addLine = quodomLines.add as unknown as ReturnType<typeof vi.fn>;

const GASEOSA = { idproducto: 700, nombreProducto: 'Gaseosa 2L', cantidad: 1 };

describe('agregarProducto', () => {
  beforeEach(() => {
    clearGuestQuodoms();
    activoPorRubro.mockReset();
    create.mockReset();
    addLine.mockReset();
  });

  it('adds to the open quodom of that rubro without asking', async () => {
    activoPorRubro.mockResolvedValue({ id: 'q-7', idrubro: 7 });
    addLine.mockResolvedValue({ res: true, id: 1 });

    const res = await agregarProducto(GASEOSA, { logueado: true, idrubro: 7 });

    expect(res).toEqual({ estado: 'agregado', idquodom: 'q-7' });
    expect(activoPorRubro).toHaveBeenCalledWith(7);
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'q-7', idproducto: 700 }));
    expect(create).not.toHaveBeenCalled();
  });

  it('asks for confirmation and adds nothing when there is no quodom of that rubro', async () => {
    activoPorRubro.mockResolvedValue(null);

    const res = await agregarProducto(GASEOSA, { logueado: true, idrubro: 7 });

    expect(res).toEqual({ estado: 'necesita_confirmacion', idrubro: 7 });
    expect(create).not.toHaveBeenCalled();
    expect(addLine).not.toHaveBeenCalled();
  });

  it('creates with the right idrubro and then adds, on confirmation', async () => {
    create.mockResolvedValue({ res: true, idquodom: 'q-new' });
    addLine.mockResolvedValue({ res: true, id: 1 });

    const res = await confirmarYAgregar(GASEOSA, { logueado: true, idrubro: 7, descripcion: 'Bebidas' });

    expect(create).toHaveBeenCalledWith({ descripcion: 'Bebidas', idrubro: 7 });
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'q-new' }));
    expect(res.idquodom).toBe('q-new');
  });

  it('adds a guest line into the cart of that rubro, untouched backend', async () => {
    const res = await agregarProducto(GASEOSA, { logueado: false, idrubro: 7 });

    expect(res).toEqual({ estado: 'agregado', idquodom: null });
    expect(getGuestCart(7).lines).toEqual([GASEOSA]);
    expect(activoPorRubro).not.toHaveBeenCalled();
  });

  it('asks a guest for confirmation when the rubro has no cart yet but another does', async () => {
    await agregarProducto(GASEOSA, { logueado: false, idrubro: 7 });

    const res = await agregarProducto({ idproducto: 400, nombreProducto: 'Cemento', cantidad: 1 }, { logueado: false, idrubro: 4 });

    expect(res).toEqual({ estado: 'necesita_confirmacion', idrubro: 4 });
    expect(getGuestCart(4).lines).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd quodom-web/app && npx vitest run src/quodom`
Expected: FAIL — `confirmarYAgregar` no existe y `agregarProducto` tiene otra firma.

- [ ] **Step 3: Update the API bindings**

En `quodom-web/app/src/api/quodom.ts`, reemplazar el binding `getLastOrCreate` (agregado el 2026-08-18) y ajustar `create`:

```ts
  create: (body: { descripcion: string; idrubro: number; iddireccion?: number | null }) =>
    apiFetch<{ res: boolean; idquodom: string }>('/quodom/create', { method: 'POST', body }),
  // The open Quodom of a rubro, or null. Never creates.
  activoPorRubro: (idrubro: number) =>
    apiFetch<{ res: boolean; data: Quodom | null }>('/quodom/activo/' + idrubro).then(r => r.data),
```

- [ ] **Step 4: Rewrite agregarProducto**

Reemplazar `quodom-web/app/src/quodom/agregarProducto.ts`:

```ts
import { quodom as quodomApi } from '../api/quodom';
import { quodomLines } from '../api/quodom_lines';
import { addGuestLine, guestLineCount, type GuestLine } from '../guest/guestQuodom';

export type AgregarResult =
  | { estado: 'agregado'; idquodom: string | null }
  | { estado: 'necesita_confirmacion'; idrubro: number };

type Opts = { logueado: boolean; idrubro: number };

/**
 * Adds a product to the Quodom of its rubro. A Quodom holds a single rubro, so
 * when there is no open one for it nothing is added: the caller has to confirm
 * creating it first (confirmarYAgregar).
 */
export async function agregarProducto(line: GuestLine, opts: Opts): Promise<AgregarResult> {
  if (!opts.logueado) {
    if (guestLineCount(opts.idrubro) === 0 && guestLineCount() > 0) {
      return { estado: 'necesita_confirmacion', idrubro: opts.idrubro };
    }
    addGuestLine(opts.idrubro, line);
    notificarCambio();
    return { estado: 'agregado', idquodom: null };
  }

  const activo = await quodomApi.activoPorRubro(opts.idrubro);
  if (!activo) return { estado: 'necesita_confirmacion', idrubro: opts.idrubro };

  await agregarAlServidor(activo.id, line);
  notificarCambio();
  return { estado: 'agregado', idquodom: activo.id };
}

/** Second half of the flow: the user accepted opening a Quodom for this rubro. */
export async function confirmarYAgregar(
  line: GuestLine,
  opts: Opts & { descripcion: string }
): Promise<{ idquodom: string | null }> {
  if (!opts.logueado) {
    addGuestLine(opts.idrubro, line);
    notificarCambio();
    return { idquodom: null };
  }

  const creado = await quodomApi.create({ descripcion: opts.descripcion, idrubro: opts.idrubro });
  await agregarAlServidor(creado.idquodom, line);
  notificarCambio();
  return { idquodom: creado.idquodom };
}

async function agregarAlServidor(idquodom: string, line: GuestLine): Promise<void> {
  await quodomLines.add({
    idquodom,
    idproducto: line.idproducto,
    cantidad: line.cantidad,
    nombreProducto: line.nombreProducto,
    ...(line.atributo1 ? { atributo1: line.atributo1 } : {}),
    ...(line.atributo2 ? { atributo2: line.atributo2 } : {})
  });
}

function notificarCambio(): void {
  window.dispatchEvent(new Event('quodom:changed'));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd quodom-web/app && npx vitest run src/quodom`
Expected: PASS, 5 tests.

- [ ] **Step 6: Note the expected typecheck breakage**

Run: `cd quodom-web/app && npx tsc -b --noEmit`
Expected: FALLA en **tres** archivos que todavía llaman a `quodomApi.create` sin `idrubro` — `guest/migrateGuestQuodom.ts` (Task 10), `screens/MisQuodoms/ListaMisQuodoms.tsx` (Task 14) y `screens/ModoIA/ModoIA.tsx` (Task 15) — además de los que ya venían rotos desde la Task 7. **Es lo esperado.** El typecheck no vuelve a estar limpio hasta la Task 15; hasta entonces el gate de cada tarea es `npx vitest run`. No arregles esos tres archivos acá: cada uno se reescribe entero en su tarea.

- [ ] **Step 7: Commit**

```bash
git add quodom-web/app/src/api/quodom.ts quodom-web/app/src/quodom/agregarProducto.ts quodom-web/app/src/quodom/__tests__/agregarProducto.test.ts
git commit -m "feat(app): resolve the quodom by rubro and require confirmation to open a new one"
```

---

### Task 9: Diálogo de rubro y pantallas del catálogo

**Files:**
- Create: `quodom-web/app/src/quodom/rubros.ts`
- Create: `quodom-web/app/src/quodom/DialogoNuevoRubro.tsx`
- Create: `quodom-web/app/src/quodom/DialogoNuevoRubro.css`
- Modify: `quodom-web/app/src/quodom/useAgregarProducto.ts` (reescritura)
- Modify: `quodom-web/app/src/screens/Home/ProductosPorCategoria.tsx`
- Modify: `quodom-web/app/src/screens/Home/MasBuscados.tsx`
- Modify: `quodom-web/app/src/screens/Home/BusquedaScreen.tsx`
- Test: `quodom-web/app/src/quodom/__tests__/useAgregarProducto.test.tsx`

**Interfaces:**
- Consumes: `agregarProducto`, `confirmarYAgregar` (Task 8); `categoriaPadre` en `Product` y `BusquedaResult` (Task 6).
- Produces:
  - `useAgregarProducto()` → `{ agregar(line: GuestLine, idrubro: number): Promise<void>; agregando: boolean; error: string | null; pendiente: { line: GuestLine; idrubro: number } | null; confirmar(): Promise<void>; cancelar(): void }`
  - `nombreRubro(idrubro: number): string` y `RUBROS: Record<number, string>` en `quodom/rubros.ts` — los consumen las tareas 10, 12 y 14.
  - `<DialogoNuevoRubro nombreRubro nombreRubroAbierto? onConfirmar onCancelar ocupado? />`

- [ ] **Step 1: Write the failing test**

Crear `quodom-web/app/src/quodom/__tests__/useAgregarProducto.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAgregarProducto } from '../useAgregarProducto';
import * as agregarModule from '../agregarProducto';

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1' } })
}));

function Probe() {
  const { agregar, pendiente, confirmar } = useAgregarProducto();
  return (
    <div>
      <button onClick={() => agregar({ idproducto: 700, nombreProducto: 'Gaseosa', cantidad: 1 }, 7)}>agregar</button>
      {pendiente && <button onClick={confirmar}>confirmar rubro {pendiente.idrubro}</button>}
    </div>
  );
}

describe('useAgregarProducto', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('exposes the pending line when the rubro needs confirmation', async () => {
    vi.spyOn(agregarModule, 'agregarProducto').mockResolvedValue({ estado: 'necesita_confirmacion', idrubro: 7 });
    render(<Probe />);

    fireEvent.click(screen.getByText('agregar'));

    await waitFor(() => expect(screen.getByText('confirmar rubro 7')).toBeInTheDocument());
  });

  it('clears the pending line after confirming', async () => {
    vi.spyOn(agregarModule, 'agregarProducto').mockResolvedValue({ estado: 'necesita_confirmacion', idrubro: 7 });
    const confirmarSpy = vi.spyOn(agregarModule, 'confirmarYAgregar').mockResolvedValue({ idquodom: 'q-new' });
    render(<Probe />);

    fireEvent.click(screen.getByText('agregar'));
    await waitFor(() => screen.getByText('confirmar rubro 7'));
    fireEvent.click(screen.getByText('confirmar rubro 7'));

    await waitFor(() => expect(screen.queryByText(/confirmar rubro/)).not.toBeInTheDocument());
    expect(confirmarSpy).toHaveBeenCalled();
  });

  it('does not ask when the line was added straight away', async () => {
    vi.spyOn(agregarModule, 'agregarProducto').mockResolvedValue({ estado: 'agregado', idquodom: 'q-7' });
    render(<Probe />);

    fireEvent.click(screen.getByText('agregar'));

    await waitFor(() => expect(screen.queryByText(/confirmar rubro/)).not.toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/app && npx vitest run src/quodom/__tests__/useAgregarProducto.test.tsx`
Expected: FAIL — el hook no expone `pendiente` ni `confirmar`.

- [ ] **Step 3: Rewrite the hook**

Reemplazar `quodom-web/app/src/quodom/useAgregarProducto.ts`:

```ts
import { useCallback, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import type { GuestLine } from '../guest/guestQuodom';
import { agregarProducto, confirmarYAgregar } from './agregarProducto';

type Pendiente = { line: GuestLine; idrubro: number };

export function useAgregarProducto() {
  const { user } = useAuth();
  const [agregando, setAgregando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);

  const agregar = useCallback(async (line: GuestLine, idrubro: number) => {
    setAgregando(true);
    setError(null);
    try {
      const res = await agregarProducto(line, { logueado: !!user, idrubro });
      if (res.estado === 'necesita_confirmacion') setPendiente({ line, idrubro });
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo agregar el producto.');
    } finally {
      setAgregando(false);
    }
  }, [user]);

  const confirmar = useCallback(async () => {
    if (!pendiente) return;
    setAgregando(true);
    setError(null);
    try {
      await confirmarYAgregar(pendiente.line, {
        logueado: !!user,
        idrubro: pendiente.idrubro,
        descripcion: 'Mi Quodom'
      });
      setPendiente(null);
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo crear el Quodom.');
    } finally {
      setAgregando(false);
    }
  }, [pendiente, user]);

  const cancelar = useCallback(() => setPendiente(null), []);

  return { agregar, agregando, error, pendiente, confirmar, cancelar };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quodom-web/app && npx vitest run src/quodom/__tests__/useAgregarProducto.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Build the dialog**

Crear `quodom-web/app/src/quodom/DialogoNuevoRubro.tsx`:

```tsx
import { useEffect } from 'react';
import './DialogoNuevoRubro.css';

type Props = {
  nombreRubro: string;
  nombreRubroAbierto?: string | null;
  onConfirmar: () => void;
  onCancelar: () => void;
  ocupado?: boolean;
};

export function DialogoNuevoRubro({ nombreRubro, nombreRubroAbierto, onConfirmar, onCancelar, ocupado }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancelar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancelar]);

  return (
    <div className="dnr-backdrop" onClick={onCancelar}>
      <section
        className="dnr card hoja"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dnr-titulo"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="dnr-titulo" className="dnr-titulo">No se pueden mezclar rubros</h2>
        <p className="dnr-texto">
          Este producto es de <strong>{nombreRubro}</strong>
          {nombreRubroAbierto ? <> y tu Quodom abierto es de <strong>{nombreRubroAbierto}</strong></> : null}.
          Cada Quodom lleva un solo rubro.
        </p>
        <div className="dnr-acciones">
          <button type="button" className="btn btn-ghost" onClick={onCancelar}>Cancelar</button>
          <button type="button" className="btn btn-exito" onClick={onConfirmar} disabled={ocupado}>
            {ocupado ? 'Creando…' : 'Crear Quodom de ' + nombreRubro}
          </button>
        </div>
      </section>
    </div>
  );
}
```

Crear `quodom-web/app/src/quodom/DialogoNuevoRubro.css`:

```css
.dnr-backdrop {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(30, 30, 42, 0.55);
  display: flex; align-items: center; justify-content: center;
  padding: var(--sp-4);
}
.dnr { background: var(--color-tarjeta); max-width: 420px; width: 100%; padding: var(--sp-4); }
.dnr-titulo { font-size: var(--fs-h2); margin: 0 0 var(--sp-3) 0; color: var(--color-acento); }
.dnr-texto { margin: 0 0 var(--sp-4) 0; color: var(--color-texto); }
.dnr-acciones { display: flex; gap: var(--sp-3); justify-content: flex-end; flex-wrap: wrap; }
```

Verificá los nombres reales de las variables en `quodom-web/app/src/styles/tokens.css` antes de escribir el CSS y ajustá si alguna no existe.

- [ ] **Step 6: Wire the three catalog screens**

En las tres pantallas, la llamada a `agregar` pasa a llevar el rubro, y se renderiza el diálogo cuando hay pendiente. Para `ProductosPorCategoria.tsx`:

```tsx
  const { agregar: agregarLinea, agregando, error: errAgregar, pendiente, confirmar, cancelar } = useAgregarProducto();

  function agregar(p: Product) {
    agregarLinea(
      { idproducto: p.id, nombreProducto: p.nombreproducto, cantidad: 1, nombreAtributo1: p.atributo1 ?? undefined, nombreAtributo2: p.atributo2 ?? undefined },
      p.categoriaPadre
    );
  }
```

Y antes del cierre del `</section>`:

```tsx
        {pendiente && (
          <DialogoNuevoRubro
            nombreRubro={nombreRubro(pendiente.idrubro)}
            onConfirmar={confirmar}
            onCancelar={cancelar}
            ocupado={agregando}
          />
        )}
```

`nombreRubro` sale de `quodom-web/app/src/quodom/rubros.ts`, un módulo nuevo con el mapa fijo de los 8 rubros:

```ts
export const RUBROS: Record<number, string> = {
  1: 'Limpieza',
  2: 'Librería',
  3: 'Papelera',
  4: 'Construcción',
  5: 'Pintura',
  6: 'Sanitarios',
  7: 'Bebidas',
  8: 'Seguridad Industrial'
};

export function nombreRubro(idrubro: number): string {
  return RUBROS[idrubro] ?? 'ese rubro';
}
```

Repetí el mismo cableado en `MasBuscados.tsx` (usa `p.categoriaPadre`) y en `BusquedaScreen.tsx` (usa `r.categoriaPadre`, disponible desde la Task 6).

- [ ] **Step 7: Typecheck and test**

Run: `cd quodom-web/app && npx vitest run`
Expected: PASS. El typecheck sigue rojo en los archivos que arreglan las tareas 10, 12, 13, 14 y 15 (ver Task 8 Step 6) — no lo corras como gate acá.

- [ ] **Step 8: Commit**

```bash
git add quodom-web/app/src/quodom quodom-web/app/src/screens/Home
git commit -m "feat(app): ask before opening a Quodom for a new rubro from the catalog"
```

---

### Task 10: Migración del carrito de invitado, rubro por rubro

**Files:**
- Modify: `quodom-web/app/src/guest/migrateGuestQuodom.ts` (reescritura)
- Modify: `quodom-web/app/src/auth/AuthContext.tsx:42-43`
- Modify: `quodom-web/app/src/screens/Auth/SignIn.tsx:20-22`
- Create: `quodom-web/app/src/guest/DialogoConflictoRubro.tsx`
- Modify: `quodom-web/app/tests/migrateGuestQuodom.test.ts`

**Interfaces:**
- Consumes: carrito por rubro (Task 7); `activoPorRubro`, `create` (Task 8); `quodom.eliminar` (ya existe).
- Produces:
  - `type ConflictoRubro = { idrubro: number; quodomExistente: Quodom; lineasInvitado: number }`
  - `planificarMigracion(): Promise<{ conflictos: ConflictoRubro[]; sinConflicto: number[] }>`
  - `migrarRubro(idrubro: number, accion: 'crear' | 'integrar' | 'reemplazar'): Promise<string | null>`

- [ ] **Step 1: Write the failing tests**

Reemplazar `quodom-web/app/tests/migrateGuestQuodom.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { planificarMigracion, migrarRubro } from '../src/guest/migrateGuestQuodom';
import { quodom as quodomApi } from '../src/api/quodom';
import { quodomLines } from '../src/api/quodom_lines';
import { addGuestLine, clearGuestQuodoms, getGuestCart } from '../src/guest/guestQuodom';

vi.mock('../src/api/quodom', () => ({
  quodom: { activoPorRubro: vi.fn(), create: vi.fn(), eliminar: vi.fn() }
}));
vi.mock('../src/api/quodom_lines', () => ({
  quodomLines: { add: vi.fn() }
}));

const activoPorRubro = quodomApi.activoPorRubro as unknown as ReturnType<typeof vi.fn>;
const create = quodomApi.create as unknown as ReturnType<typeof vi.fn>;
const eliminar = quodomApi.eliminar as unknown as ReturnType<typeof vi.fn>;
const addLine = quodomLines.add as unknown as ReturnType<typeof vi.fn>;

const GASEOSA = { idproducto: 700, nombreProducto: 'Gaseosa 2L', cantidad: 2 };
const CEMENTO = { idproducto: 400, nombreProducto: 'Cemento 50kg', cantidad: 1 };

describe('guest migration by rubro', () => {
  beforeEach(() => {
    clearGuestQuodoms();
    [activoPorRubro, create, eliminar, addLine].forEach(m => m.mockReset());
    create.mockResolvedValue({ res: true, idquodom: 'q-new' });
    addLine.mockResolvedValue({ res: true, id: 1 });
    eliminar.mockResolvedValue({ res: true });
  });

  it('splits rubros into conflicting and free ones', async () => {
    addGuestLine(7, GASEOSA);
    addGuestLine(4, CEMENTO);
    activoPorRubro.mockImplementation(async (r: number) => (r === 7 ? { id: 'q-7', idrubro: 7, nro: 'QD-1', cantproductos: 3 } : null));

    const plan = await planificarMigracion();

    expect(plan.sinConflicto).toEqual([4]);
    expect(plan.conflictos).toHaveLength(1);
    expect(plan.conflictos[0].idrubro).toBe(7);
    expect(plan.conflictos[0].lineasInvitado).toBe(1);
  });

  it('creates a new quodom for a rubro without conflict and clears its cart', async () => {
    addGuestLine(4, CEMENTO);

    const id = await migrarRubro(4, 'crear');

    expect(create).toHaveBeenCalledWith({ descripcion: 'Mi Quodom', idrubro: 4 });
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'q-new', idproducto: 400 }));
    expect(id).toBe('q-new');
    expect(getGuestCart(4).lines).toEqual([]);
  });

  it('integrar adds the guest lines into the existing quodom', async () => {
    addGuestLine(7, GASEOSA);
    activoPorRubro.mockResolvedValue({ id: 'q-7', idrubro: 7 });

    const id = await migrarRubro(7, 'integrar');

    expect(create).not.toHaveBeenCalled();
    expect(eliminar).not.toHaveBeenCalled();
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'q-7', cantidad: 2 }));
    expect(id).toBe('q-7');
  });

  it('reemplazar deletes the whole existing quodom and creates a new one', async () => {
    addGuestLine(7, GASEOSA);
    activoPorRubro.mockResolvedValue({ id: 'q-7', idrubro: 7 });

    const id = await migrarRubro(7, 'reemplazar');

    expect(eliminar).toHaveBeenCalledWith('q-7');
    expect(create).toHaveBeenCalledWith({ descripcion: 'Mi Quodom', idrubro: 7 });
    expect(id).toBe('q-new');
  });

  it('leaves the cart untouched when a rubro is never migrated', async () => {
    addGuestLine(7, GASEOSA);
    expect(getGuestCart(7).lines).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd quodom-web/app && npx vitest run tests/migrateGuestQuodom.test.ts`
Expected: FAIL — `planificarMigracion` y `migrarRubro` no existen.

- [ ] **Step 3: Rewrite the module**

Reemplazar `quodom-web/app/src/guest/migrateGuestQuodom.ts`:

```ts
import { quodom as quodomApi } from '../api/quodom';
import { quodomLines } from '../api/quodom_lines';
import type { Quodom } from '../api/types';
import { clearGuestCart, getGuestCart, guestRubrosConLineas } from './guestQuodom';

export type ConflictoRubro = {
  idrubro: number;
  quodomExistente: Quodom;
  lineasInvitado: number;
};

export type AccionRubro = 'crear' | 'integrar' | 'reemplazar';

/**
 * A Quodom holds one rubro and a user can only have one open per rubro, so the
 * guest carts are migrated rubro by rubro. The ones whose rubro is free are
 * created outright; the rest need the user to pick integrar or reemplazar.
 */
export async function planificarMigracion(): Promise<{ conflictos: ConflictoRubro[]; sinConflicto: number[] }> {
  const conflictos: ConflictoRubro[] = [];
  const sinConflicto: number[] = [];

  for (const idrubro of guestRubrosConLineas()) {
    const existente = await quodomApi.activoPorRubro(idrubro);
    if (existente) {
      conflictos.push({ idrubro, quodomExistente: existente, lineasInvitado: getGuestCart(idrubro).lines.length });
    } else {
      sinConflicto.push(idrubro);
    }
  }

  return { conflictos, sinConflicto };
}

export async function migrarRubro(idrubro: number, accion: AccionRubro): Promise<string | null> {
  const cart = getGuestCart(idrubro);
  if (cart.lines.length === 0) return null;

  let idquodom: string;

  if (accion === 'integrar') {
    const existente = await quodomApi.activoPorRubro(idrubro);
    if (!existente) return await migrarRubro(idrubro, 'crear');
    idquodom = existente.id;
  } else {
    if (accion === 'reemplazar') {
      const existente = await quodomApi.activoPorRubro(idrubro);
      // Reemplazar discards the whole Quodom, not just its lines: DELETE removes
      // header and lines when the estado is CREADO.
      if (existente) await quodomApi.eliminar(existente.id);
    }
    const creado = await quodomApi.create({ descripcion: cart.descripcion.trim() || 'Mi Quodom', idrubro });
    idquodom = creado.idquodom;
  }

  for (const l of cart.lines) {
    await quodomLines.add({
      idquodom,
      idproducto: l.idproducto,
      cantidad: l.cantidad,
      nombreProducto: l.nombreProducto,
      ...(l.atributo1 ? { atributo1: l.atributo1 } : {}),
      ...(l.atributo2 ? { atributo2: l.atributo2 } : {})
    });
  }

  clearGuestCart(idrubro);
  window.dispatchEvent(new Event('quodom:changed'));
  return idquodom;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd quodom-web/app && npx vitest run tests/migrateGuestQuodom.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Move the migration out of AuthContext**

`signin` en `AuthContext.tsx` hoy migra solo y devuelve un id. Ahora la migración necesita interacción, así que `signin` deja de migrar:

```tsx
  const signin = useCallback(async (username: string, password: string) => {
    const u = await users.signin({ username, password });
    if (u.token) setToken(u.token);
    setUser(u);
  }, []);
```

Actualizá el tipo `AuthState.signin` a `(username: string, password: string) => Promise<void>` y sacá el import de `migrateGuestQuodom`.

- [ ] **Step 6: Drive the migration from SignIn**

En `quodom-web/app/src/screens/Auth/SignIn.tsx`, reemplazar el bloque que hoy hace `const migratedId = await signin(...)` y navega, por:

```tsx
  const [conflictos, setConflictos] = useState<ConflictoRubro[]>([]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await signin(username, password);
      const plan = await planificarMigracion();
      for (const idrubro of plan.sinConflicto) {
        await migrarRubro(idrubro, 'crear');
      }
      if (plan.conflictos.length > 0) {
        setConflictos(plan.conflictos);   // el diálogo los resuelve de a uno
        return;                            // no navegamos todavía
      }
      navigate(from ?? '/', { replace: true });
    } catch (e) {
      setErr(e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo ingresar.');
    } finally {
      setBusy(false);
    }
  }

  async function resolverConflicto(accion: AccionRubro | null) {
    const [actual, ...resto] = conflictos;
    if (accion) await migrarRubro(actual.idrubro, accion);
    setConflictos(resto);
    if (resto.length === 0) navigate(from ?? '/', { replace: true });
  }
```

Y en el render, antes del cierre:

```tsx
      {conflictos.length > 0 && (
        <DialogoConflictoRubro conflicto={conflictos[0]} onElegir={resolverConflicto} />
      )}
```

Los imports nuevos: `planificarMigracion`, `migrarRubro`, y los tipos `ConflictoRubro` y `AccionRubro` desde `../../guest/migrateGuestQuodom`, más `DialogoConflictoRubro` desde `../../guest/DialogoConflictoRubro`. Verificá los nombres reales de `err`/`setErr`/`busy`/`from` en el archivo antes de pegar y ajustá.

Crear `quodom-web/app/src/guest/DialogoConflictoRubro.tsx` con las tres acciones. El texto de reemplazar tiene que decir qué se descarta, porque es irreversible:

```tsx
<p className="dcr-texto">
  Ya tenés un Quodom abierto de <strong>{nombreRubro(conflicto.idrubro)}</strong> ({conflicto.quodomExistente.nro},
  {' '}{conflicto.quodomExistente.cantproductos ?? 0} productos) y armaste {conflicto.lineasInvitado} producto(s) sin
  iniciar sesión.
</p>
<button className="btn btn-exito" onClick={() => onElegir('integrar')}>Integrar los dos</button>
<button className="btn" onClick={() => onElegir('reemplazar')}>
  Reemplazar — se descarta {conflicto.quodomExistente.nro} entero
</button>
<button className="btn btn-ghost" onClick={() => onElegir(null)}>Ahora no</button>
```

- [ ] **Step 7: Run the app suite**

Run: `cd quodom-web/app && npx vitest run`
Expected: PASS. El typecheck todavía no: quedan `ListaMisQuodoms.tsx` (Task 14) y `ModoIA.tsx` (Task 15). `signin` sólo se llama desde `SignIn.tsx` — verificado en el preflight — así que cambiarle la firma no rompe nada más.

- [ ] **Step 8: Commit**

```bash
git add quodom-web/app/src/guest quodom-web/app/src/auth/AuthContext.tsx quodom-web/app/src/screens/Auth/SignIn.tsx quodom-web/app/tests/migrateGuestQuodom.test.ts
git commit -m "feat(app): migrate guest carts rubro by rubro with integrate/replace choice"
```

---

### Task 11: Sidebar con todos los Quodoms abiertos, en tiempo real

**Files:**
- Modify: `quodom-web/app/src/components/layout/MisQuodomsSidebar.tsx`
- Modify: `quodom-web/app/src/components/layout/MisQuodomsSidebar.css`
- Test: `quodom-web/app/src/components/layout/__tests__/MisQuodomsSidebar.test.tsx`

**Interfaces:**
- Consumes: `idrubro` y `nombrerubro` en el tipo `Quodom` (Task 6).
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Write the failing test**

Crear `quodom-web/app/src/components/layout/__tests__/MisQuodomsSidebar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MisQuodomsSidebar } from '../MisQuodomsSidebar';
import { quodom as quodomApi } from '../../../api/quodom';

vi.mock('../../../api/quodom', () => ({ quodom: { misQuodom: vi.fn() } }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-1' } }) }));

const misQuodom = quodomApi.misQuodom as unknown as ReturnType<typeof vi.fn>;

const BEBIDAS = { id: 'q-7', descripcion: 'Bebidas', estado: 'CREADO', nro: 'QD-1', idrubro: 7, nombrerubro: 'Bebidas', cantproductos: 2, createdBy: 'u-1', iddireccion: null };
const OBRA = { id: 'q-4', descripcion: 'Obra', estado: 'CREADO', nro: 'QD-2', idrubro: 4, nombrerubro: 'Construcción', cantproductos: 1, createdBy: 'u-1', iddireccion: null };

describe('MisQuodomsSidebar', () => {
  beforeEach(() => misQuodom.mockReset());

  it('lists every open quodom with its rubro', async () => {
    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('Bebidas')).toBeInTheDocument());
    expect(screen.getByText('Construcción')).toBeInTheDocument();
    expect(screen.getByText(/Quodoms activos/i)).toBeInTheDocument();
  });

  it('reloads when quodom:changed fires', async () => {
    misQuodom.mockResolvedValue([BEBIDAS]);
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await waitFor(() => expect(misQuodom).toHaveBeenCalledTimes(1));

    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);
    act(() => { window.dispatchEvent(new Event('quodom:changed')); });

    await waitFor(() => expect(screen.getByText('Construcción')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/app && npx vitest run src/components/layout`
Expected: FAIL — hoy sólo muestra un "Quodom activo" y no escucha el evento.

- [ ] **Step 3: Update the component**

En `MisQuodomsSidebar.tsx`: reemplazar `const activo = list.find(...)` por `const activos = list.filter(q => q.estado === 'CREADO')` y `const enviados = list.filter(q => q.estado === 'ENVIADO').slice(0, MAX_ULTIMOS)`. El título de la primera sección pasa a "Quodoms activos" y renderiza `activos.map(...)` con el `nombrerubro` visible sobre cada card. Y el efecto se suscribe al evento:

```tsx
  useEffect(() => {
    if (!user) { setList([]); return; }
    let alive = true;
    const cargar = () => {
      quodomApi.misQuodom()
        .then(d => { if (alive) setList(d); })
        .catch(() => { if (alive) setList([]); });
    };
    cargar();
    window.addEventListener('quodom:changed', cargar);
    return () => { alive = false; window.removeEventListener('quodom:changed', cargar); };
  }, [user, nonce]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quodom-web/app && npx vitest run src/components/layout`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add quodom-web/app/src/components/layout/MisQuodomsSidebar.tsx quodom-web/app/src/components/layout/MisQuodomsSidebar.css quodom-web/app/src/components/layout/__tests__
git commit -m "feat(app): show every open quodom in the sidebar and refresh it live"
```

---

### Task 12: Barra inferior desplegable

**Files:**
- Modify: `quodom-web/app/src/components/layout/BarraQuodomInferior.tsx` (reescritura)
- Modify: `quodom-web/app/src/components/layout/BarraQuodomInferior.css`
- Create: `quodom-web/app/src/components/layout/PanelQuodomsActivos.tsx`
- Create: `quodom-web/app/src/components/layout/PanelQuodomsActivos.css`
- Test: `quodom-web/app/src/components/layout/__tests__/BarraQuodomInferior.test.tsx`

**Interfaces:**
- Consumes: `misQuodom` y `nombrerubro` (Task 11); `guestRubrosConLineas`, `guestLineCount` (Task 7); ruta `/quodom?rubro=` (Task 13).
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Write the failing test**

Crear `quodom-web/app/src/components/layout/__tests__/BarraQuodomInferior.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BarraQuodomInferior } from '../BarraQuodomInferior';
import { quodom as quodomApi } from '../../../api/quodom';

vi.mock('../../../api/quodom', () => ({ quodom: { misQuodom: vi.fn() } }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-1' } }) }));

const misQuodom = quodomApi.misQuodom as unknown as ReturnType<typeof vi.fn>;
const BEBIDAS = { id: 'q-7', descripcion: 'Bebidas', estado: 'CREADO', nro: 'QD-1', idrubro: 7, nombrerubro: 'Bebidas', cantproductos: 2, createdBy: 'u-1', iddireccion: null };
const OBRA = { id: 'q-4', descripcion: 'Obra', estado: 'CREADO', nro: 'QD-2', idrubro: 4, nombrerubro: 'Construcción', cantproductos: 1, createdBy: 'u-1', iddireccion: null };

describe('BarraQuodomInferior', () => {
  beforeEach(() => misQuodom.mockReset());

  it('stays hidden when there is no open quodom', async () => {
    misQuodom.mockResolvedValue([]);
    const { container } = render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);
    await waitFor(() => expect(container.querySelector('.barra-quodom')).toBeNull());
  });

  it('shows the label with the number of open quodoms, collapsed', async () => {
    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);
    render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText(/Mis Quodoms activos/i)).toBeInTheDocument());
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('expands the panel on click and lists each open quodom', async () => {
    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);
    render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);
    await waitFor(() => screen.getByText(/Mis Quodoms activos/i));

    fireEvent.click(screen.getByRole('button', { name: /Mis Quodoms activos/i }));

    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByText('Bebidas')).toBeInTheDocument();
    expect(screen.getByText('Construcción')).toBeInTheDocument();
  });

  it('collapses again on a second click', async () => {
    misQuodom.mockResolvedValue([BEBIDAS]);
    render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);
    await waitFor(() => screen.getByText(/Mis Quodoms activos/i));

    const toggle = screen.getByRole('button', { name: /Mis Quodoms activos/i });
    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(screen.queryByRole('list')).toBeNull();
  });

  it('refreshes the list when quodom:changed fires', async () => {
    misQuodom.mockResolvedValue([BEBIDAS]);
    render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);
    await waitFor(() => expect(misQuodom).toHaveBeenCalledTimes(1));

    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);
    act(() => { window.dispatchEvent(new Event('quodom:changed')); });

    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/app && npx vitest run src/components/layout/__tests__/BarraQuodomInferior.test.tsx`
Expected: FAIL — la barra sigue siendo un link con un contador único.

- [ ] **Step 3: Build the panel**

Crear `quodom-web/app/src/components/layout/PanelQuodomsActivos.tsx`:

```tsx
import { Link } from 'react-router-dom';
import type { Quodom } from '../../api/types';
import './PanelQuodomsActivos.css';

export type ItemActivo = {
  key: string;
  to: string;
  nombreRubro: string;
  descripcion: string;
  cantproductos: number;
};

export function PanelQuodomsActivos({ items, onNavegar }: { items: ItemActivo[]; onNavegar: () => void }) {
  return (
    <ul className="pqa-list" aria-label="Quodoms activos">
      {items.map(it => (
        <li key={it.key} className="pqa-item">
          <Link to={it.to} className="pqa-link" onClick={onNavegar}>
            <span className="pqa-rubro">{it.nombreRubro}</span>
            <span className="pqa-desc">{it.descripcion}</span>
            <span className="pqa-cant">{it.cantproductos}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function quodomsAItems(list: Quodom[]): ItemActivo[] {
  return list
    .filter(q => q.estado === 'CREADO')
    .map(q => ({
      key: q.id,
      to: '/quodom?id=' + encodeURIComponent(q.id),
      nombreRubro: q.nombrerubro ?? 'Sin rubro',
      descripcion: q.descripcion,
      cantproductos: q.cantproductos ?? 0
    }));
}
```

Crear `quodom-web/app/src/components/layout/PanelQuodomsActivos.css` siguiendo la paleta: fondo `--color-panel-oscuro` (`#1E1E2A`), texto claro, forma de hoja en cada ítem.

- [ ] **Step 4: Rewrite the bar**

Reemplazar `quodom-web/app/src/components/layout/BarraQuodomInferior.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { quodom as quodomApi } from '../../api/quodom';
import { getGuestCart, guestRubrosConLineas } from '../../guest/guestQuodom';
import { nombreRubro } from '../../quodom/rubros';
import { PanelQuodomsActivos, quodomsAItems, type ItemActivo } from './PanelQuodomsActivos';
import './BarraQuodomInferior.css';

export function BarraQuodomInferior() {
  const { user } = useAuth();
  const [items, setItems] = useState<ItemActivo[]>([]);
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  const refrescar = useCallback(async () => {
    if (!user) {
      setItems(guestRubrosConLineas().map(idrubro => ({
        key: 'g-' + idrubro,
        to: '/quodom?rubro=' + idrubro,
        nombreRubro: nombreRubro(idrubro),
        descripcion: getGuestCart(idrubro).descripcion || 'Sin guardar',
        cantproductos: getGuestCart(idrubro).lines.length
      })));
      return;
    }
    try {
      setItems(quodomsAItems(await quodomApi.misQuodom()));
    } catch {
      setItems([]);
    }
  }, [user]);

  useEffect(() => {
    let alive = true;
    const onChanged = () => { if (alive) refrescar(); };
    onChanged();
    window.addEventListener('quodom:changed', onChanged);
    window.addEventListener('storage', onChanged);
    return () => {
      alive = false;
      window.removeEventListener('quodom:changed', onChanged);
      window.removeEventListener('storage', onChanged);
    };
  }, [refrescar]);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    const onClickFuera = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickFuera);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickFuera);
    };
  }, [abierto]);

  if (items.length === 0) return null;

  return (
    <div className="barra-quodom-wrap" ref={contenedor}>
      {abierto && <PanelQuodomsActivos items={items} onNavegar={() => setAbierto(false)} />}
      <button
        type="button"
        className="barra-quodom"
        aria-expanded={abierto}
        onClick={() => setAbierto(a => !a)}
      >
        <span className="barra-quodom-count">{items.length}</span>
        <span className="barra-quodom-label">Mis Quodoms activos</span>
        <span className="barra-quodom-arrow" aria-hidden="true">{abierto ? '⌄' : '⌃'}</span>
      </button>
    </div>
  );
}
```

En `BarraQuodomInferior.css`, `.barra-quodom` deja de ser un `a` y pasa a ser un `button` a ancho completo: sacale cualquier `text-decoration` y agregale `border: none; width: 100%; cursor: pointer;` conservando el fondo `--color-panel-oscuro`. `.barra-quodom-wrap` es el `position: fixed; bottom: 0; left: 0; right: 0;` que antes tenía `.barra-quodom`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd quodom-web/app && npx vitest run src/components/layout/__tests__/BarraQuodomInferior.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add quodom-web/app/src/components/layout
git commit -m "feat(app): turn the bottom bar into an expandable list of open quodoms"
```

---

### Task 13: Detalle del Quodom por rubro

**Files:**
- Modify: `quodom-web/app/src/screens/Quodom/DetalleQuodom.tsx`
- Test: `quodom-web/app/src/screens/Quodom/__tests__/DetalleQuodom.test.tsx`

**Interfaces:**
- Consumes: carrito por rubro (Task 7).
- Produces: ruta `/quodom?rubro=<idrubro>` para el invitado; `/quodom?id=<uuid>` sin cambios para el servidor.

- [ ] **Step 1: Write the failing test**

Crear `quodom-web/app/src/screens/Quodom/__tests__/DetalleQuodom.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DetalleQuodom } from '../DetalleQuodom';
import { addGuestLine, clearGuestQuodoms } from '../../../guest/guestQuodom';

vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../../../api/quodom', () => ({ quodom: { misQuodom: vi.fn(), porId: vi.fn(), update: vi.fn(), whatsapp: vi.fn() } }));
vi.mock('../../../api/quodom_lines', () => ({ quodomLines: { porQuodom: vi.fn(), update: vi.fn(), eliminar: vi.fn() } }));

const GASEOSA = { idproducto: 700, nombreProducto: 'Gaseosa 2L', cantidad: 1 };
const CEMENTO = { idproducto: 400, nombreProducto: 'Cemento 50kg', cantidad: 1 };

function renderEn(ruta: string) {
  return render(<MemoryRouter initialEntries={[ruta]}><DetalleQuodom /></MemoryRouter>);
}

describe('DetalleQuodom for guests', () => {
  beforeEach(() => clearGuestQuodoms());

  it('shows only the lines of the rubro in the query string', async () => {
    addGuestLine(7, GASEOSA);
    addGuestLine(4, CEMENTO);

    renderEn('/quodom?rubro=7');

    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());
    expect(screen.queryByText('Cemento 50kg')).not.toBeInTheDocument();
  });

  it('lists the carts to choose from when no rubro is given and there are several', async () => {
    addGuestLine(7, GASEOSA);
    addGuestLine(4, CEMENTO);

    renderEn('/quodom');

    await waitFor(() => expect(screen.getByText('Bebidas')).toBeInTheDocument());
    expect(screen.getByText('Construcción')).toBeInTheDocument();
  });

  it('goes straight into the only cart when there is just one', async () => {
    addGuestLine(7, GASEOSA);

    renderEn('/quodom');

    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/app && npx vitest run src/screens/Quodom`
Expected: FAIL.

- [ ] **Step 3: Read the rubro from the query string**

En `DetalleQuodom.tsx`: `const idrubro = sp.get('rubro') ? Number(sp.get('rubro')) : null;` y `const mode: Mode = id ? 'server' : 'guest'`. En modo guest, `guest` sale de `getGuestCart(idrubro)` y todas las mutaciones (`updateGuestLineCantidad`, `removeGuestLine`, `updateGuestLineAtributos`, `setGuestDescripcion`) pasan a llevar el `idrubro` como primer argumento. Cuando `mode === 'guest'` y no hay `idrubro`, renderizar la lista de `guestRubrosConLineas()` con un link a cada `/quodom?rubro=<r>`; si hay exactamente uno, redirigir a él con `navigate(..., { replace: true })`.

El efecto de redirección del usuario logueado (agregado el 2026-08-18) sigue igual, pero sólo cuando no hay `rubro` ni carritos de invitado.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quodom-web/app && npx vitest run src/screens/Quodom`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add quodom-web/app/src/screens/Quodom
git commit -m "feat(app): scope the guest quodom detail to a rubro"
```

---

### Task 14: "Nuevo" en Mis Quodoms pide rubro

**Files:**
- Modify: `quodom-web/app/src/screens/MisQuodoms/ListaMisQuodoms.tsx`
- Test: `quodom-web/app/src/screens/MisQuodoms/__tests__/ListaMisQuodoms.test.tsx`

**Interfaces:**
- Consumes: `RUBROS` (Task 9); `create` con `idrubro` (Task 8).
- Produces: nada.

- [ ] **Step 1: Write the failing test**

Crear `quodom-web/app/src/screens/MisQuodoms/__tests__/ListaMisQuodoms.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListaMisQuodoms } from '../ListaMisQuodoms';
import { quodom as quodomApi } from '../../../api/quodom';

vi.mock('../../../api/quodom', () => ({ quodom: { misQuodom: vi.fn(), create: vi.fn() } }));

const misQuodom = quodomApi.misQuodom as unknown as ReturnType<typeof vi.fn>;
const create = quodomApi.create as unknown as ReturnType<typeof vi.fn>;

const BEBIDAS_ABIERTO = { id: 'q-7', descripcion: 'Bebidas', estado: 'CREADO', nro: 'QD-1', idrubro: 7, nombrerubro: 'Bebidas', cantproductos: 1, createdBy: 'u-1', iddireccion: null };

describe('ListaMisQuodoms: nuevo por rubro', () => {
  beforeEach(() => { misQuodom.mockReset(); create.mockReset(); });

  it('offers the eight rubros when creating a new quodom', async () => {
    misQuodom.mockResolvedValue([]);
    render(<MemoryRouter><ListaMisQuodoms /></MemoryRouter>);
    await waitFor(() => screen.getByRole('button', { name: /nuevo/i }));

    fireEvent.click(screen.getByRole('button', { name: /nuevo/i }));

    expect(screen.getByRole('button', { name: 'Bebidas' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Construcción' })).toBeEnabled();
  });

  it('disables a rubro that already has an open quodom', async () => {
    misQuodom.mockResolvedValue([BEBIDAS_ABIERTO]);
    render(<MemoryRouter><ListaMisQuodoms /></MemoryRouter>);
    await waitFor(() => screen.getByRole('button', { name: /nuevo/i }));

    fireEvent.click(screen.getByRole('button', { name: /nuevo/i }));

    expect(screen.getByRole('button', { name: /Bebidas/ })).toBeDisabled();
  });

  it('creates with the chosen idrubro', async () => {
    misQuodom.mockResolvedValue([]);
    create.mockResolvedValue({ res: true, idquodom: 'q-new' });
    render(<MemoryRouter><ListaMisQuodoms /></MemoryRouter>);
    await waitFor(() => screen.getByRole('button', { name: /nuevo/i }));

    fireEvent.click(screen.getByRole('button', { name: /nuevo/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Construcción' }));

    await waitFor(() => expect(create).toHaveBeenCalledWith({ descripcion: 'Mi Quodom', idrubro: 4 }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/app && npx vitest run src/screens/MisQuodoms`
Expected: FAIL.

- [ ] **Step 3: Implement the rubro picker**

En `ListaMisQuodoms.tsx`, reemplazar `crearNuevo()` por un selector de rubro:

```tsx
  const [eligiendoRubro, setEligiendoRubro] = useState(false);

  const rubrosOcupados = new Set((list ?? []).filter(q => q.estado === 'CREADO').map(q => q.idrubro));

  async function crearDeRubro(idrubro: number) {
    try {
      const r = await quodomApi.create({ descripcion: 'Mi Quodom', idrubro });
      setEligiendoRubro(false);
      window.dispatchEvent(new Event('quodom:changed'));
      navigate('/quodom?id=' + encodeURIComponent(r.idquodom));
    } catch (e) {
      setErr(e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo crear.');
    }
  }
```

El botón "Nuevo" pasa a `onClick={() => setEligiendoRubro(true)}`, y se agrega el selector al render:

```tsx
      {eligiendoRubro && (
        <section className="mq-rubros" aria-label="Elegí el rubro del Quodom">
          <h2 className="mq-rubros-titulo">¿De qué rubro es el Quodom?</h2>
          <ul className="mq-rubros-list">
            {Object.entries(RUBROS).map(([id, nombre]) => {
              const idrubro = Number(id);
              const ocupado = rubrosOcupados.has(idrubro);
              return (
                <li key={id}>
                  <button
                    type="button"
                    className="btn btn-block"
                    disabled={ocupado}
                    onClick={() => crearDeRubro(idrubro)}
                  >
                    {nombre}{ocupado ? ' — ya tenés uno abierto' : ''}
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn btn-ghost" onClick={() => setEligiendoRubro(false)}>Cancelar</button>
        </section>
      )}
```

Importar `RUBROS` desde `../../quodom/rubros` (Task 9). Ojo con el test "disables a rubro that already has an open quodom": el nombre accesible del botón incluye la leyenda, por eso el test lo busca con `/Bebidas/` y no con el string exacto.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quodom-web/app && npx vitest run src/screens/MisQuodoms`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add quodom-web/app/src/screens/MisQuodoms
git commit -m "feat(app): pick a rubro when creating a quodom from Mis Quodoms"
```

---

### Task 15: Modo IA, un rubro por conversación

**Files:**
- Modify: `quodom-web/api/src/controllers/ia.controller.js`
- Modify: `quodom-web/app/src/screens/ModoIA/ModoIA.tsx:64-88`
- Modify: `quodom-web/api/tests/ia.controller.test.js`
- Modify: `quodom-web/app/src/screens/ModoIA/__tests__/ModoIA.test.tsx`

**Interfaces:**
- Consumes: `create` con `idrubro` (Task 3); `activoPorRubro` (Task 5).
- Produces: `POST /api/ia/chat` devuelve `idrubro: number` junto a `type`, `text` e `items` cuando la propuesta tiene productos.

- [ ] **Step 1: Write the failing tests**

En `quodom-web/api/tests/ia.controller.test.js`, agregar (adaptá los nombres de los mocks a los que ya usa el archivo):

```js
  it('drops subcategories that do not belong to the returned rubro', async () => {
    // Pintura (5) tiene la subcategoría 35; Bebidas (7) tiene la 70.
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35, 70] })
      .mockResolvedValueOnce({ type: 'question', text: '¿Interior o exterior?' });

    await Controler.chat(userId, [{ role: 'user', text: 'quiero pintar' }]);

    // La segunda llamada arma la lista de productos: sólo puede traer los de Pintura.
    const prompt = callGemini.mock.calls[1][0].systemPrompt;
    expect(prompt).toContain('Latex');
    expect(prompt).not.toContain('Gaseosa');
  });

  it('returns the idrubro alongside a proposal', async () => {
    callGemini
      .mockResolvedValueOnce({ idrubro: 5, idsSubcategoria: [35] })
      .mockResolvedValueOnce({ type: 'proposal', text: 'Listo', items: [{ idproducto: 100, cantidad: 2 }] });

    const res = await Controler.chat(userId, [
      { role: 'user', text: 'quiero pintar' },
      { role: 'assistant', text: '¿cuántos m2?' },
      { role: 'assistant', text: '¿interior?' },
      { role: 'user', text: '30m2 interior' }
    ]);

    expect(res.type).toBe('proposal');
    expect(res.idrubro).toBe(5);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd quodom-web/api && npx jest tests/ia.controller.test.js`
Expected: FAIL.

- [ ] **Step 3: Change the intent schema and prompt**

En `quodom-web/api/src/controllers/ia.controller.js`:

```js
const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    idrubro: { type: 'integer' },
    idsSubcategoria: { type: 'array', items: { type: 'integer' } }
  },
  required: ['idrubro', 'idsSubcategoria']
};
```

El prompt del clasificador pasa a pedir **un solo rubro**: "Devolvé el id del rubro más relevante y sólo las subcategorías que pertenezcan a ese rubro. Si el mensaje abarca varios rubros, elegí el principal." Y la lista que se le pasa incluye el `idrubro` de cada subcategoría.

Después de recibir la respuesta, filtrar por las dudas: `const ids = intent.idsSubcategoria.filter(id => subcatPorId.get(id)?.idrubro === intent.idrubro)`.

En el prompt del chat, agregar la regla: si el proyecto del usuario abarca varios rubros, repreguntar por cuál arrancar en vez de mezclar.

Y `chat()` devuelve `idrubro` en la propuesta.

- [ ] **Step 4: Confirm the proposal through the shared flow**

En `ModoIA.tsx`, `confirmProposal` deja de crear siempre un Quodom nuevo: busca `activoPorRubro(idrubro)`, y si no hay, muestra `DialogoNuevoRubro` (Task 9) antes de crear. Si ya hay, agrega ahí.

- [ ] **Step 5: Run both suites and close the typecheck**

Run: `cd quodom-web/api && npm test`, `cd quodom-web/app && npx vitest run`, y `cd quodom-web/app && npx tsc -b --noEmit`
Expected: PASS los tres. **Ésta es la tarea donde el typecheck vuelve a quedar limpio**: es el último de los archivos que quedaron rojos desde la Task 7. Si `tsc` marca algo más, es un cabo suelto de una tarea anterior — arreglalo acá.

- [ ] **Step 6: Commit**

```bash
git add quodom-web/api/src/controllers/ia.controller.js quodom-web/api/tests/ia.controller.test.js quodom-web/app/src/screens/ModoIA
git commit -m "feat(ia): keep an IA conversation within a single rubro"
```

---

## Verificación final

- [ ] `cd quodom-web/api && npm test` — toda la suite en verde.
- [ ] `cd quodom-web/app && npx tsc -b --noEmit && npx vitest run` — typecheck limpio y suite en verde.
- [ ] `cd quodom-web/api && npm run reset-quodoms` y arrancar el server: la base queda sin Quodoms y `quodom_headers` tiene `idrubro`.
- [ ] Prueba manual del recorrido completo: como invitado agregar Bebidas, agregar Construcción (aparece el cartel), confirmar, ver los dos carritos en la barra inferior desplegada, iniciar sesión, ver la migración crear los dos Quodoms, y confirmar que el sidebar muestra los dos y se actualiza al agregar otro producto.
