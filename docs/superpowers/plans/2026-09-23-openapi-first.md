# OpenAPI First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `quodom-web/api/openapi.yaml` the single source of truth for the API: it validates requests at runtime, validates responses in tests, generates the app's TypeScript types, and feeds a dev-only docs page.

**Architecture:** A hand-written OpenAPI 3.0.3 file describes all 57 routes (56 in `routes/` plus `GET /`). `express-openapi-validator` is mounted in `server.js` before the routers; request validation always, response validation only under `NODE_ENV=test`. The Joi schemas in `routes/*.js` are deleted as the validator takes over. `openapi-typescript` generates `app/src/api/schema.d.ts`, and `app/src/api/types.ts` becomes aliases over it. Three tests guard against drift: route coverage, response validation (the existing suite), and generated-types freshness.

**Tech Stack:** Express 4, `express-openapi-validator@5.6.2`, `swagger-ui-express@5.0.1`, `yaml` (API side, to read the spec in tests); `openapi-typescript@7.13.0` (app side). Jest + Supertest (API), Vitest (app).

**Spec:** `docs/superpowers/specs/2026-09-23-openapi-first-design.md`

## Global Constraints

- The contract file is `quodom-web/api/openapi.yaml`, **OpenAPI 3.0.3** (not 3.1: `express-openapi-validator` 5.x supports 3.0 fully and 3.1 only partially; the spec is updated in Task 1 to say so). Nullable is `nullable: true`.
- Every error response keeps the existing shape `{ res: false, message }` (optionally `error`). The app shows `message` as is.
- Validation messages returned to the client are in Spanish: `Faltan datos o hay datos inválidos: <campo>[, <campo>…]`.
- Unknown body fields are **dropped silently** (`removeAdditional: 'all'`). The existing test `PUT /users strips mass-assignment fields like role, emailValidado, activo` must keep passing unmodified.
- Response validation runs **only** when `NODE_ENV === 'test'`.
- An undocumented route answers `404 { res: false, message: 'Route-not-found' }`, as today.
- `/img/...` routes are outside the contract.
- `/docs` exists only when `API_DOCS=true`; Render never sets it.
- **Never change an existing test's expectation to make the validator fit.** If the validator pre-empts a handler that a test pins (an error code like `idrubro_invalido`, `no_last_user_message`), loosen the schema for that field instead.
- UI copy Spanish; code, comments and commit messages English (project rule). Commits end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Test fixtures use relative dates (`new Date(Date.now() - …)`), never absolute ones (project rule, CLAUDE.md §5).
- Prefer in-place edits over truncate-and-rewrite for files under `app/src` while Vite runs (CLAUDE.md §7).

## Review Focus

1. **Empty strings that Joi used to drop.** Joi's `.empty('')` removed the key, so `PUT /quodom_lines/:id` with `atributo1: ''` left the stored value untouched; a plain OpenAPI `string` passes `''` through and would overwrite it. Expected: same as today, the key is dropped. Pinned in Task 5 (`omitEmpty` + test).
2. **`iddireccion: null` on `POST /quodom/create`.** Joi's `.empty(null)` dropped it so the controller filled in the default address. Expected: still filled in. Pinned in Task 5.
3. **Trailing slashes the app sends** (`/users/dire/`, `/users/direcciondefault/`, `PUT /users/`, `/quodom/misQuodom/`). Express matches them today; the validator must too. Expected: same response as without the slash. Pinned in Task 5.
4. **Sequelize instances and `Date` objects in responses.** The response validator sees the body before `JSON.stringify`. Expected: a valid response is not reported as invalid because it is a model instance or a `Date`. Pinned in Task 6 (probe + fix).
5. **A request that fails validation *and* has no session.** The validator runs before `auth`, so it answers 400 before auth answers 401. Expected: an unauthenticated request with a valid body still gets 401. Pinned in Task 5.

---

## File Structure

API (`quodom-web/api/`):
- Create `openapi.yaml` — the contract.
- Create `src/helpers/openapi.js` — loads the spec path, exports `SPEC_PATH` and `buildValidator()`; one place that knows the validator options.
- Create `src/helpers/listRoutes.js` — walks the Express app and returns `[{ method, path }]` in OpenAPI path syntax. Used by the coverage test.
- Create `src/middleware/stripTrailingSlash.js` — `/users/dire/` → `/users/dire` before validation.
- Create `src/middleware/omitEmpty.js` — replaces Joi's `.empty('')` / `.empty(null)`.
- Modify `src/server.js` — mount strip-slash, validator, dev docs.
- Modify `src/middleware/error-handler.js` — translate validator errors.
- Modify `src/routes/*.js` — delete Joi schemas, add `omitEmpty` where Joi had `.empty(...)`.
- Delete `src/middleware/validate-request.js`.
- Create `nodemon.json` — sets `API_DOCS=true` for `npm run dev`.
- Tests: create `tests/openapi.coverage.test.js`, `tests/openapi.validation.test.js`, `tests/openapi.docs.test.js`.

App (`quodom-web/app/`):
- Create `src/api/schema.d.ts` — generated, committed.
- Modify `src/api/types.ts` — aliases over `components['schemas']`.
- Modify `package.json` — `api-types` script, `openapi-typescript` devDependency.
- Create `tests/api-types.test.ts` — freshness check.

Docs: modify root `CLAUDE.md`, `quodom-web/api/CLAUDE.md`, `quodom-web/app/CLAUDE.md`.

---

### Task 1: Tooling, contract skeleton with shared components, catalog paths, and the coverage test

**Files:**
- Create: `quodom-web/api/openapi.yaml`
- Create: `quodom-web/api/src/helpers/listRoutes.js`
- Create: `quodom-web/api/tests/openapi.coverage.test.js`
- Modify: `quodom-web/api/package.json` (deps)
- Modify: `docs/superpowers/specs/2026-09-23-openapi-first-design.md` (3.1 → 3.0.3)

**Interfaces:**
- Produces: `listRoutes(app) -> Array<{ method: 'get'|'post'|'put'|'delete', path: string }>` where `path` uses `{param}` syntax and has no trailing slash (except `/`).
- Produces: `openapi.yaml` with `components.schemas`: `Error`, `Ok`, `OkMessage`, `Category`, `Product`, `ProductWithExiste`, `Atributo`, `BusquedaResult`, `Provincia`, `Localidad`, `VQuodom`, `VQuodomLine`, `Direccion`, `DireccionInput`, `Notificacion`, `CurrentUser`, `SigninResponse`, `InfoComprador`; `components.securitySchemes`: `cookieAuth`, `bearerAuth`; `components.responses`: `BadRequest`, `Unauthorized`, `NotFound`, `TooMany`.
- Produces: in the coverage test, a `PENDIENTES` array that later tasks shrink and Task 4 deletes.

- [ ] **Step 1: Install dependencies**

```bash
cd quodom-web/api
npm install express-openapi-validator@5.6.2 swagger-ui-express@5.0.1 yaml@2
```

Expected: `package.json` gains the three under `dependencies`.

- [ ] **Step 2: Write `src/helpers/listRoutes.js`**

```js
// Lists every route the Express app answers, in OpenAPI path syntax, so a
// test can compare the code against openapi.yaml. Relies on Express 4
// internals (app._router.stack); if Express is upgraded, this is the file
// that breaks, loudly, in tests.
function prefixOf(layer) {
  // Express 4 compiles app.use('/users', router) to /^\/users\/?(?=\/|$)/i
  const src = layer.regexp.source;
  if (src === '^\\/?(?=\\/|$)') return '';
  return src
    .replace(/^\^/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '')
    .replace(/\\\//g, '/');
}

function normalize(path) {
  const p = path.replace(/:(\w+)/g, '{$1}').replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

function listRoutes(app) {
  const out = [];
  for (const layer of app._router.stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        if (method === '_all') continue;
        out.push({ method, path: normalize(layer.route.path) });
      }
    } else if (layer.name === 'router' && layer.handle.stack) {
      const prefix = prefixOf(layer);
      for (const sub of layer.handle.stack) {
        if (!sub.route) continue;
        for (const method of Object.keys(sub.route.methods)) {
          out.push({ method, path: normalize(prefix + sub.route.path) });
        }
      }
    }
  }
  return out.filter(r => r.path !== '*' && !r.path.startsWith('/img'));
}

module.exports = { listRoutes };
```

- [ ] **Step 3: Write the coverage test (it fails: there is no `openapi.yaml`)**

`tests/openapi.coverage.test.js`:

```js
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const app = require('../src/server');
const { listRoutes } = require('../src/helpers/listRoutes');

const SPEC = YAML.parse(fs.readFileSync(path.join(__dirname, '..', 'openapi.yaml'), 'utf8'));
const METHODS = ['get', 'post', 'put', 'delete', 'patch'];

// Routes not described yet. Each task that documents a group removes its
// entries; Task 4 deletes this list, and from then on every route must be in
// openapi.yaml.
const PENDIENTES = [
  'users', 'quodom', 'quodom_lines', 'user_direcciones',
  'oper_notificaciones', 'hist_busquedas', 'api/ia'
];
const pendiente = p => PENDIENTES.some(g => p === '/' + g || p.startsWith('/' + g + '/'));

const key = r => r.method.toUpperCase() + ' ' + r.path;
const enCodigo = listRoutes(app).map(key);
const enSpec = Object.entries(SPEC.paths || {}).flatMap(([p, ops]) =>
  Object.keys(ops).filter(m => METHODS.includes(m)).map(m => m.toUpperCase() + ' ' + p));

describe('openapi.yaml covers the API', () => {
  it('describes every route the code answers', () => {
    const faltan = enCodigo.filter(k => !enSpec.includes(k) && !pendiente(k.split(' ')[1]));
    expect(faltan).toEqual([]);
  });

  it('describes no route the code does not answer', () => {
    const sobran = enSpec.filter(k => !enCodigo.includes(k));
    expect(sobran).toEqual([]);
  });

  it('lists the routes this test expects to find', () => {
    // Guards listRoutes itself: if it silently returned nothing, the two tests
    // above would pass on an empty API.
    expect(enCodigo).toEqual(expect.arrayContaining(['GET /', 'GET /categorias', 'POST /users/signin', 'POST /api/ia/chat']));
    expect(enCodigo.length).toBe(57);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `cd quodom-web/api && npx jest tests/openapi.coverage.test.js`
Expected: FAIL with `ENOENT ... openapi.yaml`.

- [ ] **Step 5: Write `openapi.yaml` with shared components and the catalog paths**

```yaml
openapi: 3.0.3
info:
  title: Quodom API
  version: 1.0.0
  description: |
    Contrato entre la app y el API. **Este archivo manda**: todo cambio de API
    empieza acá y después va el código. El servidor valida los pedidos contra
    este archivo, los tests validan las respuestas, y la app genera sus tipos
    con `npm run api-types`.
servers:
  - url: /
tags:
  - name: catalogo
  - name: users
  - name: quodom
  - name: quodom_lines
  - name: user_direcciones
  - name: oper_notificaciones
  - name: hist_busquedas
  - name: ia

components:
  securitySchemes:
    cookieAuth:
      type: apiKey
      in: cookie
      name: quodom_session
    bearerAuth:
      type: http
      scheme: bearer

  responses:
    BadRequest:
      description: Pedido inválido o regla de negocio rota
      content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
    Unauthorized:
      description: Sin sesión o sesión inválida
      content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
    NotFound:
      description: No existe
      content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
    TooMany:
      description: Demasiados intentos
      content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
    Conflict:
      description: Choca con un Quodom abierto (rubro_duplicado / rubro_mismatch)
      content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }

  parameters:
    IntId:
      name: id
      in: path
      required: true
      schema: { type: integer }
    QuodomId:
      name: id
      in: path
      required: true
      schema: { type: string }

  schemas:
    Error:
      type: object
      required: [res]
      properties:
        res: { type: boolean, enum: [false] }
        message: { type: string }
        error: { type: string }
        exp: { type: boolean }
      additionalProperties: true
    Ok:
      type: object
      required: [res]
      properties:
        res: { type: boolean }
    OkMessage:
      type: object
      required: [res, message]
      properties:
        res: { type: boolean }
        message: { type: string }

    Category:
      type: object
      required: [id, nombrecategoria, idcategoriapadre, orden]
      properties:
        id: { type: integer }
        nombrecategoria: { type: string }
        idcategoriapadre: { type: integer }
        activa: { type: boolean }
        imagen: { type: string, nullable: true }
        refreshImage: { type: string, nullable: true }
        orden: { type: integer }
        createdAt: { type: string, format: date-time }
        updatedAt: { type: string, format: date-time }
    Product:
      type: object
      required: [id, nombreproducto, categoria, categoriaPadre]
      properties:
        id: { type: integer }
        nombreproducto: { type: string }
        descripcion: { type: string, nullable: true }
        categoria: { type: integer }
        categoriaPadre: { type: integer }
        idatributo: { type: integer, nullable: true }
        nombreatributo: { type: string, nullable: true }
        unidadmedida: { type: integer, nullable: true }
        nombreunidadmedida: { type: string, nullable: true }
        imagen: { type: string, nullable: true }
        refreshImagen: { type: string, nullable: true }
        atributo1: { type: string, nullable: true, description: 'Nombre del grupo ("MEDIDAS"), no un valor' }
        atributo2: { type: string, nullable: true }
        valoresAtributo1: { type: array, items: { type: string } }
        valoresAtributo2: { type: array, items: { type: string } }
        createdAt: { type: string, format: date-time }
        updatedAt: { type: string, format: date-time }
    ProductWithExiste:
      type: object
      required: [id, nombreproducto, existe]
      properties:
        id: { type: integer }
        nombreproducto: { type: string }
        imagen: { type: string, nullable: true }
        refreshImagen: { type: string, nullable: true }
        existe: { type: integer }
    Atributo:
      type: object
      required: [valoratributo]
      properties:
        valoratributo: { type: string }
        orden: { type: integer, nullable: true }
        esvendedor: { type: string, nullable: true }
    BusquedaResult:
      type: object
      required: [id, nombre]
      properties:
        id: { type: integer }
        nombre: { type: string, nullable: true }
        descripcion: { type: string, nullable: true }
        imagen: { type: string, nullable: true }
        refreshImagen: { type: string, nullable: true }
        categoriaPadre: { type: integer, nullable: true }
    Provincia:
      type: object
      required: [id, provincia]
      properties:
        id: { type: integer }
        provincia: { type: string }
    Localidad:
      type: object
      required: [id]
      properties:
        id: { type: integer }
        idprovincia: { type: integer, nullable: true }
        nombre: { type: string, nullable: true }
        comprador: { type: boolean, nullable: true }
        vendedor: { type: boolean, nullable: true }

    VQuodom:
      type: object
      required: [id, descripcion, estado, nro, createdBy]
      properties:
        id: { type: string }
        descripcion: { type: string }
        createdBy: { type: string }
        estado: { type: string, enum: [CREADO, ENVIADO] }
        idrubro: { type: integer, nullable: true }
        nombrerubro: { type: string, nullable: true }
        porccompletado: { type: number, nullable: true }
        cantproductos: { type: integer, nullable: true }
        fechavencimientoenvio: { type: string, format: date-time, nullable: true }
        diasparavencimientoenvio: { type: integer, nullable: true }
        diasparavencimientoaceptacion: { type: integer, nullable: true }
        iddireccion: { type: string, nullable: true }
        nro: { type: string }
        fechaenvio: { type: string, format: date-time, nullable: true }
        createdAt: { type: string, format: date-time }
    VQuodomLine:
      type: object
      required: [id, idquodom, idproducto, cantidad]
      properties:
        id: { type: integer }
        idquodom: { type: string }
        idproducto: { type: integer }
        cantidad: { type: number }
        categoria: { type: integer, nullable: true }
        categoriaPadre: { type: integer, nullable: true }
        nombreCategoria: { type: string, nullable: true }
        nombreProducto: { type: string, nullable: true }
        detalleProducto: { type: string, nullable: true }
        marca: { type: string, nullable: true }
        unidad: { type: string, nullable: true }
        atributosFaltantes: { type: integer, nullable: true }
        imagen: { type: string, nullable: true }
        refreshImagen: { type: string, nullable: true }
        atributo1: { type: string, nullable: true, description: 'Lo que eligió el usuario' }
        atributo2: { type: string, nullable: true }
        nombreAtributo1: { type: string, nullable: true, description: 'Nombre del grupo' }
        nombreAtributo2: { type: string, nullable: true }

    Direccion:
      type: object
      required: [id, userid]
      properties:
        id: { type: integer }
        userid: { type: string }
        provincia: { type: string, nullable: true }
        partido: { type: string, nullable: true }
        localidad: { type: string, nullable: true }
        direccion: { type: string, nullable: true }
        calle: { type: string, nullable: true }
        numero: { type: string, nullable: true }
        piso: { type: string, nullable: true }
        cp: { type: string, nullable: true }
        alias: { type: string, nullable: true }
        default: { oneOf: [{ type: boolean }, { type: integer }], nullable: true }
        idprovincia: { type: string, nullable: true }
        idpartido: { type: string, nullable: true }
        observaciones: { type: string, nullable: true }
    DireccionInput:
      type: object
      properties:
        alias: { type: string }
        calle: { type: string }
        numero: { type: string }
        piso: { type: string }
        cp: { type: string }
        localidad: { type: string }
        direccion: { type: string }
        observaciones: { type: string }
        idprovincia: { type: integer }
        default: { type: boolean }

    Notificacion:
      type: object
      required: [id, titulo, texto]
      properties:
        id: { type: integer }
        userId: { type: string }
        tiponotificacion: { type: string }
        idquodom: { type: string }
        titulo: { type: string }
        texto: { type: string }
        enviada: { type: boolean, nullable: true }
        leida: { oneOf: [{ type: boolean }, { type: integer }], nullable: true }
        createdAt: { type: string, format: date-time }
        updatedAt: { type: string, format: date-time }

    CurrentUser:
      type: object
      required: [id, username, email]
      properties:
        id: { type: string }
        username: { type: string }
        email: { type: string }
        nombre: { type: string, nullable: true }
        apellido: { type: string, nullable: true }
        dni: { type: string, nullable: true }
        refreshFoto: { type: string, nullable: true }
        telefono: { type: string, nullable: true }
        codArea: { type: string, nullable: true }
    SigninResponse:
      type: object
      required: [res, id, username, email]
      description: El token NO viaja acá; queda en la cookie httpOnly quodom_session.
      properties:
        res: { type: boolean }
        id: { type: string }
        username: { type: string }
        email: { type: string }
        nombre: { type: string, nullable: true }
        apellido: { type: string, nullable: true }
        role: { type: string, nullable: true }
        refreshFoto: { type: string, nullable: true }
    InfoComprador:
      type: object
      properties:
        idquodom: { type: string }
        NombreComprador: { type: string, nullable: true }
        telefono: { type: string, nullable: true }
        email: { type: string, nullable: true }
        Direccion: { type: string, nullable: true }
        Provincia: { type: string, nullable: true }
        Localidad: { type: string, nullable: true }
        cp: { type: string, nullable: true }
        observaciones: { type: string, nullable: true }

paths:
  /:
    get:
      tags: [catalogo]
      summary: Info del API y la IP que ve el servidor (para chequear proxies)
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                required: [message, name, version, fecha, ip]
                properties:
                  message: { type: string }
                  name: { type: string }
                  version: { type: string }
                  fecha: { type: string, format: date-time }
                  ip: { type: string }

  /categorias:
    get:
      tags: [catalogo]
      summary: Rubros activos
      responses:
        '200':
          description: OK
          content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/Category' } } } }
  /categorias/Sub/{idcategoriapadre}:
    get:
      tags: [catalogo]
      summary: Subcategorías de un rubro
      parameters:
        - { name: idcategoriapadre, in: path, required: true, schema: { type: integer } }
      responses:
        '200':
          description: OK
          content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/Category' } } } }
  /categorias/{id}:
    get:
      tags: [catalogo]
      parameters: [{ $ref: '#/components/parameters/IntId' }]
      responses:
        '200':
          description: OK
          content: { application/json: { schema: { $ref: '#/components/schemas/Category' } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '404': { $ref: '#/components/responses/NotFound' }

  /productos/categoria/{idcategoria}:
    get:
      tags: [catalogo]
      parameters:
        - { name: idcategoria, in: path, required: true, schema: { type: integer } }
      responses:
        '200':
          description: OK
          content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/Product' } } } }
        '400': { $ref: '#/components/responses/BadRequest' }
  /productos/categoriaQ/{idquodom}/{idcategoria}:
    get:
      tags: [catalogo]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      parameters:
        - { name: idquodom, in: path, required: true, schema: { type: string } }
        - { name: idcategoria, in: path, required: true, schema: { type: integer } }
      responses:
        '200':
          description: OK
          content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/ProductWithExiste' } } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /productos/{id}:
    get:
      tags: [catalogo]
      parameters: [{ $ref: '#/components/parameters/IntId' }]
      responses:
        '200':
          description: OK
          content: { application/json: { schema: { $ref: '#/components/schemas/Product' } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '404': { $ref: '#/components/responses/NotFound' }

  /busqueda:
    get:
      tags: [catalogo]
      parameters:
        - { name: b, in: query, required: false, schema: { type: string } }
      responses:
        '200':
          description: OK (lista vacía si no hay b)
          content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/BusquedaResult' } } } }

  /provincias:
    get:
      tags: [catalogo]
      responses:
        '200':
          description: OK
          content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/Provincia' } } } }
  /localidades/prov:
    get:
      tags: [catalogo]
      parameters:
        - { name: idprovincia, in: query, required: false, schema: { type: integer } }
      responses:
        '200':
          description: OK
          content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/Localidad' } } } }
```

Note on `/productos/{id}` returning `400` for a missing product: `rubros.activos.test.js:76` pins `GET /productos/400 → 400`; that comes from the controller throwing a string, and stays.

- [ ] **Step 6: Update the spec's version line**

In `docs/superpowers/specs/2026-09-23-openapi-first-design.md`, §3 table, change `` `api/openapi.yaml` (OpenAPI 3.1) `` to `` `api/openapi.yaml` (OpenAPI 3.0.3; el validador soporta 3.1 sólo en parte) ``.

- [ ] **Step 7: Run the coverage test to verify it passes**

Run: `npx jest tests/openapi.coverage.test.js`
Expected: PASS (3 tests). If the count test says something other than 57, print `enCodigo` and reconcile against the route list in this plan before changing the number.

- [ ] **Step 8: Run the full API suite**

Run: `npx jest`
Expected: all suites pass (nothing mounted yet; only a new test file).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json openapi.yaml src/helpers/listRoutes.js tests/openapi.coverage.test.js ../../docs/superpowers/specs/2026-09-23-openapi-first-design.md
git commit -m "feat(api): start openapi.yaml with shared schemas and catalog routes

Adds the route-coverage test that compares the Express routes with the
contract; groups not described yet sit in a shrinking PENDIENTES list.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Describe the `users` routes

**Files:**
- Modify: `quodom-web/api/openapi.yaml` (append under `paths`)
- Modify: `quodom-web/api/tests/openapi.coverage.test.js` (remove `'users'` from `PENDIENTES`)

**Interfaces:**
- Consumes: schemas `Error`, `Ok`, `OkMessage`, `CurrentUser`, `SigninResponse`, `InfoComprador`, `Direccion`; responses `BadRequest`, `Unauthorized`, `NotFound`, `TooMany` (Task 1).

- [ ] **Step 1: Remove `'users'` from `PENDIENTES` and run the coverage test to see it fail**

Run: `npx jest tests/openapi.coverage.test.js`
Expected: FAIL, `faltan` lists the 18 `/users...` routes.

- [ ] **Step 2: Append the users paths**

Request bodies mirror the Joi schemas in `src/routes/users.routes.js` exactly (Task 5 deletes those).

```yaml
  /users:
    get:
      tags: [users]
      summary: Todos los usuarios (sólo admin)
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      responses:
        '200':
          description: OK
          content: { application/json: { schema: { type: array, items: { type: object, additionalProperties: true } } } }
        '401': { $ref: '#/components/responses/Unauthorized' }
    put:
      tags: [users]
      summary: Editar el perfil propio
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                username: { type: string }
                email: { type: string, format: email }
                nombre: { type: string }
                apellido: { type: string }
                dni: { type: string }
                codArea: { type: string }
                telefono: { type: string }
                password: { type: string, minLength: 6 }
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/OkMessage' } } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /users/current:
    get:
      tags: [users]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/CurrentUser' } } } }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /users/currentFoto:
    get:
      tags: [users]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  id: { type: string }
                  foto: { type: string, nullable: true }
                  refreshFoto: { type: string, nullable: true }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /users/dire:
    get:
      tags: [users]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      responses:
        '200': { description: OK, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/Direccion' } } } } }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /users/direcciondefault:
    get:
      tags: [users]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      responses:
        '200':
          description: La dirección por defecto, o la primera, o null
          content: { application/json: { schema: { allOf: [{ $ref: '#/components/schemas/Direccion' }], nullable: true } } }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /users/infoComprador/{idquodom}:
    get:
      tags: [users]
      summary: Datos de contacto del dueño del Quodom (sólo el propio)
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      parameters:
        - { name: idquodom, in: path, required: true, schema: { type: string } }
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/InfoComprador' } } } }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '404': { $ref: '#/components/responses/NotFound' }
  /users/validateEmail/{token}:
    get:
      tags: [users]
      parameters:
        - { name: token, in: path, required: true, schema: { type: string } }
      responses:
        '200': { description: 'res false si el token no sirve', content: { application/json: { schema: { $ref: '#/components/schemas/OkMessage' } } } }
        '400': { $ref: '#/components/responses/BadRequest' }
  /users/validateReset/{token}:
    get:
      tags: [users]
      parameters:
        - { name: token, in: path, required: true, schema: { type: string } }
      responses:
        '200':
          description: 'res false si el link venció o ya se usó'
          content:
            application/json:
              schema:
                type: object
                required: [res]
                properties:
                  res: { type: boolean }
                  message: { type: string }
        '429': { $ref: '#/components/responses/TooMany' }
  /users/{id}:
    get:
      tags: [users]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/QuodomId' }]
      responses:
        '200':
          description: Sólo el propio usuario
          content:
            application/json:
              schema:
                type: object
                properties:
                  id: { type: string }
                  username: { type: string }
                  email: { type: string }
                  nombre: { type: string, nullable: true }
                  apellido: { type: string, nullable: true }
        '401': { $ref: '#/components/responses/Unauthorized' }
    delete:
      tags: [users]
      summary: Borrar un usuario (sólo admin)
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/QuodomId' }]
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/OkMessage' } } } }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /users/signin:
    post:
      tags: [users]
      summary: Inicia sesión y pone la cookie quodom_session
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [username, password]
              properties:
                username: { type: string, description: 'Usuario o e-mail' }
                password: { type: string }
      responses:
        '200':
          description: OK. Set-Cookie quodom_session (httpOnly, SameSite=Strict, 30 días)
          content: { application/json: { schema: { $ref: '#/components/schemas/SigninResponse' } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '429': { $ref: '#/components/responses/TooMany' }
  /users/signout:
    post:
      tags: [users]
      summary: Borra la cookie de sesión (funciona sin sesión)
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/Ok' } } } }
  /users/signup:
    post:
      tags: [users]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [username, email, nombre, password, codArea, telefono]
              properties:
                username: { type: string }
                email: { type: string, format: email }
                nombre: { type: string }
                apellido: { type: string }
                password: { type: string, minLength: 6 }
                dni: { type: string }
                codArea: { type: string }
                telefono: { type: string }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                required: [res, message]
                properties:
                  res: { type: boolean }
                  id: { type: string }
                  message: { type: string }
        '400': { $ref: '#/components/responses/BadRequest' }
        '429': { $ref: '#/components/responses/TooMany' }
  /users/reset:
    post:
      tags: [users]
      summary: Pide el link de blanqueo. Contesta igual exista o no la cuenta.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email]
              properties:
                email: { type: string, description: 'E-mail o usuario' }
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/OkMessage' } } } }
        '429': { $ref: '#/components/responses/TooMany' }
  /users/reenviar:
    post:
      tags: [users]
      summary: Reenvía el link de validación. Contesta igual exista o no la cuenta.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email]
              properties:
                email: { type: string }
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/OkMessage' } } } }
        '429': { $ref: '#/components/responses/TooMany' }
  /users/changePass:
    post:
      tags: [users]
      summary: Cambia la clave con el token del link (sirve una sola vez)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [password, token]
              properties:
                password: { type: string, minLength: 6 }
                token: { type: string }
      responses:
        '200': { description: 'res false si el link venció o ya se usó', content: { application/json: { schema: { $ref: '#/components/schemas/OkMessage' } } } }
        '429': { $ref: '#/components/responses/TooMany' }
  /users/cambiarFoto/{id}:
    put:
      tags: [users]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/QuodomId' }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                foto: { type: string }
                refreshFoto: { type: string }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  res: { type: boolean }
                  refresh: { type: string }
        '401': { $ref: '#/components/responses/Unauthorized' }
```

- [ ] **Step 3: Run the coverage test**

Run: `npx jest tests/openapi.coverage.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add openapi.yaml tests/openapi.coverage.test.js
git commit -m "feat(api): describe the users routes in openapi.yaml

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Describe the `quodom` and `quodom_lines` routes

**Files:**
- Modify: `quodom-web/api/openapi.yaml`
- Modify: `quodom-web/api/tests/openapi.coverage.test.js` (remove `'quodom'`, `'quodom_lines'`)

**Interfaces:**
- Consumes: `VQuodom`, `VQuodomLine`, `Atributo`, `OkMessage`, `Conflict`, `QuodomId`, `IntId` (Task 1).

- [ ] **Step 1: Remove both groups from `PENDIENTES` and run the coverage test to see it fail**

Run: `npx jest tests/openapi.coverage.test.js`
Expected: FAIL listing 16 routes.

- [ ] **Step 2: Append the paths**

`idrubro` in `/quodom/activo/{idrubro}` is declared as **string** on purpose: the handler validates it and answers `400 idrubro_invalido`, which `quodom.rubro.test.js` pins. `iddireccion` is `nullable` because the app sends `null` (Task 5 drops it before the controller).

```yaml
  /quodom/getQuodomCreados:
    get:
      tags: [quodom]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                required: [res, data]
                properties:
                  res: { type: boolean }
                  data: { type: array, items: { $ref: '#/components/schemas/VQuodom' } }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /quodom/misQuodom:
    get:
      tags: [quodom]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      responses:
        '200': { description: OK, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/VQuodom' } } } } }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /quodom/porccompletado/{id}:
    get:
      tags: [quodom]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/QuodomId' }]
      responses:
        '200':
          description: OK (null si no existe)
          content:
            application/json:
              schema:
                type: object
                nullable: true
                properties:
                  cantproductos: { type: integer, nullable: true }
                  porccompletado: { type: number, nullable: true }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /quodom/whatsapp/{id}:
    get:
      tags: [quodom]
      summary: Arma el link wa.me y pasa el Quodom a ENVIADO
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/QuodomId' }]
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                required: [res, link]
                properties:
                  res: { type: boolean }
                  link: { type: string }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /quodom/activo/{idrubro}:
    get:
      tags: [quodom]
      summary: El Quodom abierto (CREADO) del usuario en ese rubro, o null
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      parameters:
        - { name: idrubro, in: path, required: true, schema: { type: string }, description: 'Entero positivo; el handler lo valida y contesta idrubro_invalido' }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                required: [res]
                properties:
                  res: { type: boolean }
                  data: { allOf: [{ $ref: '#/components/schemas/VQuodom' }], nullable: true }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /quodom/create:
    post:
      tags: [quodom]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [descripcion, idrubro]
              properties:
                descripcion: { type: string }
                idrubro: { type: integer }
                iddireccion: { type: integer, nullable: true }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                required: [res, idquodom]
                properties:
                  res: { type: boolean }
                  idquodom: { type: string }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '409': { $ref: '#/components/responses/Conflict' }
  /quodom/repetir/{id}:
    post:
      tags: [quodom]
      summary: Crea un Quodom nuevo con las líneas de uno ENVIADO
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/QuodomId' }]
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                required: [res, idquodom]
                properties:
                  res: { type: boolean }
                  idquodom: { type: string }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '409': { $ref: '#/components/responses/Conflict' }
  /quodom/{id}:
    get:
      tags: [quodom]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/QuodomId' }]
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/VQuodom' } } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
    put:
      tags: [quodom]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/QuodomId' }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                descripcion: { type: string }
                iddireccion: { type: integer, nullable: true }
      responses:
        '200': { description: 'OK (el cuerpo es true)', content: { application/json: { schema: { type: boolean } } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
    delete:
      tags: [quodom]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/QuodomId' }]
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/OkMessage' } } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }

  /quodom_lines/lines/{id}:
    get:
      tags: [quodom_lines]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/IntId' }]
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  idproducto: { type: integer }
                  detalleProducto: { type: string, nullable: true }
                  cantidad: { type: number }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /quodom_lines/atributos:
    get:
      tags: [quodom_lines]
      summary: Valores elegibles de un grupo de atributo de un producto
      parameters:
        - { name: idproducto, in: query, required: false, schema: { type: integer } }
        - { name: nombreatributo, in: query, required: false, schema: { type: string } }
      responses:
        '200': { description: OK, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/Atributo' } } } } }
  /quodom_lines/add:
    post:
      tags: [quodom_lines]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [idquodom, idproducto, cantidad]
              properties:
                idquodom: { type: string }
                idproducto: { type: integer }
                cantidad: { type: integer }
                nombreProducto: { type: string }
                atributo1: { type: string }
                atributo2: { type: string }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                required: [res, id]
                properties:
                  res: { type: boolean }
                  id: { type: integer }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '409': { $ref: '#/components/responses/Conflict' }
```


**Path-template collision.** Express declares `GET /quodom_lines/:idquodom` but `PUT`/`DELETE /quodom_lines/:id`. `listRoutes` turns them into `/quodom_lines/{idquodom}` and `/quodom_lines/{id}`, which OpenAPI treats as the same templated path and rejects as a duplicate. Fix it in the code, not the contract: rename the GET's param to `:id`. The contract then has a single key for all three operations:

```yaml
  /quodom_lines/{id}:
    get:
      tags: [quodom_lines]
      summary: Líneas de un Quodom (id = id del Quodom)
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      parameters:
        - { name: id, in: path, required: true, schema: { type: string } }
      responses:
        '200': { description: OK, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/VQuodomLine' } } } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
    put:
      tags: [quodom_lines]
      summary: Cambiar cantidad o atributo elegido (id = id de la línea)
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      parameters:
        - { name: id, in: path, required: true, schema: { type: string } }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                cantidad: { type: integer }
                atributo1: { type: string }
                atributo2: { type: string }
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/OkMessage' } } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
    delete:
      tags: [quodom_lines]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      parameters:
        - { name: id, in: path, required: true, schema: { type: string } }
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/OkMessage' } } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
```

And the route change:

```js
// src/routes/quodom_lines.route.js
router.get('/:id', auth.verifyToken(), getAllbyIdQuodom);
// ...
function getAllbyIdQuodom(req, res, next) {
  // :id is the Quodom id here (PUT/DELETE /:id take a line id); one name so
  // the path is a single template in openapi.yaml.
  Controler.getAll(req.params.id, req.user.id)
    .then(data => res.json(data))
    .catch(next);
}
```

Same collision check for `/users/{id}` (GET and DELETE both `:id` — fine), `/quodom/{id}` (all `:id` — fine), `/user_direcciones/{id}` (all `:id` — fine).

- [ ] **Step 3: Run the coverage test and the quodom suites**

Run: `npx jest tests/openapi.coverage.test.js tests/quodom.test.js tests/quodom_lines.merge.test.js tests/quodom.rubro.test.js`
Expected: PASS (the route rename must not break the line listing).

- [ ] **Step 4: Commit**

```bash
git add openapi.yaml tests/openapi.coverage.test.js src/routes/quodom_lines.route.js
git commit -m "feat(api): describe the quodom and quodom_lines routes

GET /quodom_lines/:idquodom becomes /:id so it shares one path template
with PUT/DELETE /:id; OpenAPI rejects two templates at the same position.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Describe the remaining routes and close the coverage list

**Files:**
- Modify: `quodom-web/api/openapi.yaml`
- Modify: `quodom-web/api/tests/openapi.coverage.test.js` (delete `PENDIENTES` and `pendiente`)

**Interfaces:**
- Consumes: `Direccion`, `DireccionInput`, `Notificacion`, `Ok`, `OkMessage` (Task 1).

- [ ] **Step 1: Delete `PENDIENTES` and the `pendiente(...)` filter; run the coverage test to see it fail**

The first test becomes:

```js
  it('describes every route the code answers', () => {
    const faltan = enCodigo.filter(k => !enSpec.includes(k));
    expect(faltan).toEqual([]);
  });
```

Run: `npx jest tests/openapi.coverage.test.js`
Expected: FAIL listing 13 routes (user_direcciones 6, oper_notificaciones 3, hist_busquedas 2, ia 2).

- [ ] **Step 2: Append the paths**

`/api/ia/chat` and `/api/ia/lista` bodies are deliberately loose: the handler owns the limits (turns, length, file size come from env vars and have their own error codes, pinned by `ia.endpoint.test.js` and `lista.endpoint.test.js`). The responses are free-form (`additionalProperties: true`) because their shape follows the model's output and is already tested field by field in `ia.controller.test.js` and `lista.controller.test.js`.

```yaml
  /user_direcciones/direcciondefault:
    get:
      tags: [user_direcciones]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      responses:
        '200': { description: 'OK (null si no tiene)', content: { application/json: { schema: { allOf: [{ $ref: '#/components/schemas/Direccion' }], nullable: true } } } }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /user_direcciones/create:
    post:
      tags: [user_direcciones]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/DireccionInput' } } }
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/OkMessage' } } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /user_direcciones/prin/{id}:
    put:
      tags: [user_direcciones]
      summary: Marca la dirección como principal
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/IntId' }]
      responses:
        '200': { description: 'OK; el cuerpo lo devuelve el controller tal cual (ver Task 6)', content: { application/json: { schema: {} } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /user_direcciones/{id}:
    get:
      tags: [user_direcciones]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/IntId' }]
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/Direccion' } } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
    put:
      tags: [user_direcciones]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/IntId' }]
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/DireccionInput' } } }
      responses:
        '200': { description: 'OK; el cuerpo lo devuelve el controller tal cual (ver Task 6)', content: { application/json: { schema: {} } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
    delete:
      tags: [user_direcciones]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/IntId' }]
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/OkMessage' } } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }

  /oper_notificaciones:
    get:
      tags: [oper_notificaciones]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      responses:
        '200': { description: OK, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/Notificacion' } } } } }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /oper_notificaciones/count:
    get:
      tags: [oper_notificaciones]
      summary: Cantidad de no leídas (el cuerpo es un número)
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      responses:
        '200': { description: OK, content: { application/json: { schema: { type: integer } } } }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /oper_notificaciones/{id}:
    put:
      tags: [oper_notificaciones]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      parameters: [{ $ref: '#/components/parameters/IntId' }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                leida: { type: integer }
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/Ok' } } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }

  /hist_busquedas:
    get:
      tags: [hist_busquedas]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      responses:
        '200':
          description: Últimas búsquedas del usuario
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    id: { type: integer }
                    valor: { type: string, nullable: true }
                    createdAt: { type: string, format: date-time }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /hist_busquedas/create:
    post:
      tags: [hist_busquedas]
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                valor: { type: string }
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/Ok' } } } }
        '401': { $ref: '#/components/responses/Unauthorized' }

  /api/ia/chat:
    post:
      tags: [ia]
      summary: Un turno del Modo IA. Los límites (turnos, largo, cuota) los aplica el handler.
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                messages:
                  type: array
                  items:
                    type: object
                    properties:
                      role: { type: string }
                      text: { type: string }
      responses:
        '200':
          description: 'type question (repregunta) o proposal (items + idrubro)'
          content:
            application/json:
              schema:
                type: object
                required: [type, text]
                properties:
                  type: { type: string, enum: [question, proposal] }
                  text: { type: string }
                  idrubro: { type: integer }
                  items: { type: array, items: { type: object, additionalProperties: true } }
                additionalProperties: true
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '429': { $ref: '#/components/responses/TooMany' }
        '502': { description: 'La IA falló', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
        '503': { description: 'La IA no está disponible', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
  /api/ia/lista:
    post:
      tags: [ia]
      summary: Matchea una lista subida contra el catálogo
      security: [{ cookieAuth: [] }, { bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                tipo: { type: string, description: 'archivo | texto' }
                texto: { type: string }
                archivo:
                  type: object
                  properties:
                    nombre: { type: string }
                    datosBase64: { type: string }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                required: [res]
                properties:
                  res: { type: boolean }
                  grupos: { type: array, items: { type: object, additionalProperties: true } }
                  ambiguas: { type: array, items: { type: object, additionalProperties: true } }
                  noEncontrados: { type: array, items: { type: object, additionalProperties: true } }
                  lineasIgnoradas: { type: integer }
                additionalProperties: true
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '429': { $ref: '#/components/responses/TooMany' }
        '502': { description: 'La IA falló', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
        '503': { description: 'La IA no está disponible', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
```

Before writing `/api/ia/lista`, open `src/helpers/listaEntrada.js` and confirm the text branch reads `e.texto` (the `archivo` branch reads `e.archivo.nombre` and `e.archivo.datosBase64`). Every field a handler reads **must** be declared: `removeAdditional: 'all'` (Task 5) deletes undeclared ones. Likewise check `iaErrores.js` for the status codes it uses and list each in the responses above (502/503 are the expected ones; add any other it returns).

- [ ] **Step 3: Run the coverage test**

Run: `npx jest tests/openapi.coverage.test.js`
Expected: PASS (3 tests, 57 routes, no `faltan`, no `sobran`).

- [ ] **Step 4: Validate the file as OpenAPI**

Run: `node -e "require('express-openapi-validator'); const YAML=require('yaml'); const s=YAML.parse(require('fs').readFileSync('openapi.yaml','utf8')); console.log(Object.keys(s.paths).length, 'paths')"`
Expected: prints the number of path keys (fewer than 57, since several operations share a path) without throwing. Full structural validation happens when the validator loads the file in Task 5.

- [ ] **Step 5: Commit**

```bash
git add openapi.yaml tests/openapi.coverage.test.js
git commit -m "feat(api): describe the remaining routes; openapi.yaml covers the whole API

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Mount the request validator, translate its errors, and delete the Joi schemas

**Files:**
- Create: `quodom-web/api/src/helpers/openapi.js`
- Create: `quodom-web/api/src/middleware/stripTrailingSlash.js`
- Create: `quodom-web/api/src/middleware/omitEmpty.js`
- Modify: `quodom-web/api/src/server.js`
- Modify: `quodom-web/api/src/middleware/error-handler.js`
- Modify: `quodom-web/api/src/routes/users.routes.js`, `quodom.route.js`, `quodom_lines.route.js`, `user_direcciones.route.js`, `oper_notificaciones.route.js`
- Delete: `quodom-web/api/src/middleware/validate-request.js`
- Test: `quodom-web/api/tests/openapi.validation.test.js`

**Interfaces:**
- Produces: `buildValidator() -> express middleware[]` and `SPEC_PATH: string` from `src/helpers/openapi.js`.
- Produces: `omitEmpty(fields: string[], values?: any[]) -> express middleware` — deletes `req.body[f]` when its value is in `values` (default `['']`).
- Produces: `stripTrailingSlash(req, res, next)`.

- [ ] **Step 1: Write the failing tests**

`tests/openapi.validation.test.js`:

```js
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');
const { sessionToken } = require('./helpers/session');

let token;
let idquodom;
let idline;

beforeAll(async () => {
  await db.ready;
  await db.series.create({ codigo: 'QUODOM', utilizado: 0, sigla: 'QD-' });
  await db.Category.bulkCreate([
    { id: 5, nombrecategoria: 'Pintura', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 35, nombrecategoria: 'Latex', idcategoriapadre: 5, activa: true, orden: 1 }
  ]);
  await db.Products.create({ id: 100, nombreproducto: 'Latex 20L', categoria: 35, categoriaPadre: 5, atributo1: 'LITROS' });
  await db.provincia.create({ id: 1, provincia: 'Buenos Aires' });
  await request(app).post('/users/signup').send({
    username: 'ana', email: 'ana@test.com', nombre: 'Ana', password: 'secreto123', codArea: '11', telefono: '5555'
  });
  token = sessionToken(await request(app).post('/users/signin').send({ username: 'ana', password: 'secreto123' }));
  await request(app).post('/user_direcciones/create').set('Authorization', 'Bearer ' + token)
    .send({ alias: 'Casa', calle: 'Falsa', numero: '123', cp: '1000', localidad: 'CABA', idprovincia: 1, default: true });
  idquodom = (await request(app).post('/quodom/create').set('Authorization', 'Bearer ' + token)
    .send({ descripcion: 'Pintura', idrubro: 5 })).body.idquodom;
  idline = (await request(app).post('/quodom_lines/add').set('Authorization', 'Bearer ' + token)
    .send({ idquodom, idproducto: 100, cantidad: 1, atributo1: '4 litros' })).body.id;
});

describe('request validation against openapi.yaml', () => {
  it('rejects a body missing a required field, in the usual shape and in Spanish', async () => {
    const res = await request(app).post('/users/signup')
      .send({ username: 'x', email: 'x@test.com', nombre: 'X', password: 'secreto123', codArea: '11' });
    expect(res.status).toBe(400);
    expect(res.body.res).toBe(false);
    expect(res.body.message).toBe('Faltan datos o hay datos inválidos: telefono');
  });

  it('names every bad field', async () => {
    const res = await request(app).post('/users/signup').send({ username: 'x', email: 'no-es-mail', nombre: 'X', password: '123', codArea: '11', telefono: '1' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email/);
    expect(res.body.message).toMatch(/password/);
  });

  it('keeps answering 404 Route-not-found for an unknown route', async () => {
    const res = await request(app).get('/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ res: false, message: 'Route-not-found' });
  });

  it('keeps answering 404 Route-not-found for a known path with an unknown method', async () => {
    const res = await request(app).patch('/categorias');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ res: false, message: 'Route-not-found' });
  });

  it('answers the same with or without a trailing slash', async () => {
    const a = await request(app).get('/users/dire').set('Authorization', 'Bearer ' + token);
    const b = await request(app).get('/users/dire/').set('Authorization', 'Bearer ' + token);
    expect(b.status).toBe(200);
    expect(b.body).toEqual(a.body);
    const put = await request(app).put('/users/').set('Authorization', 'Bearer ' + token).send({ nombre: 'Ana' });
    expect(put.status).toBe(200);
  });

  it('still answers 401 to a valid request without a session', async () => {
    const res = await request(app).post('/quodom/create').send({ descripcion: 'x', idrubro: 5 });
    expect(res.status).toBe(401);
  });

  it('an empty atributo on update leaves the chosen one untouched, as before', async () => {
    const res = await request(app).put('/quodom_lines/' + idline).set('Authorization', 'Bearer ' + token)
      .send({ cantidad: 2, atributo1: '' });
    expect(res.status).toBe(200);
    const linea = await db.Quodom_Lines.findByPk(idline);
    expect(linea.atributo1).toBe('4 litros');
    expect(Number(linea.cantidad)).toBe(2);
  });

  it('iddireccion null on create still falls back to the default address', async () => {
    await request(app).delete('/quodom/' + idquodom).set('Authorization', 'Bearer ' + token);
    const res = await request(app).post('/quodom/create').set('Authorization', 'Bearer ' + token)
      .send({ descripcion: 'Otra', idrubro: 5, iddireccion: null });
    expect(res.status).toBe(200);
    const q = await db.Quodom.findByPk(res.body.idquodom);
    expect(q.iddireccion).not.toBeNull();
  });
});
```

Before running, confirm the model keys against `src/helpers/db.js` (`db.Quodom`, `db.Quodom_Lines`, `db.provincia` are the ones registered there) and the address body against `tests/direcciones.test.js`.

- [ ] **Step 2: Run to verify which fail**

Run: `npx jest tests/openapi.validation.test.js`
Expected: FAIL on the Spanish-message tests and the `patch` test (no validator yet: the message is Joi's `Validation error: "telefono" is required`, and `PATCH /categorias` already 404s so that one may pass). The slash, 401, atributo and iddireccion tests pass today; they are the regression net for the steps below.

- [ ] **Step 3: Write `src/helpers/openapi.js`**

```js
const path = require('path');
const OpenApiValidator = require('express-openapi-validator');

const SPEC_PATH = path.join(__dirname, '..', '..', 'openapi.yaml');

// openapi.yaml is the contract; this is the one place that decides how it is
// enforced. Requests: always, dropping undeclared body fields (that is what
// stops `role: "admin"` on PUT /users). Responses: only under tests, so a
// field the contract forgot fails a test instead of a user's request.
function buildValidator() {
  return OpenApiValidator.middleware({
    apiSpec: SPEC_PATH,
    validateRequests: { removeAdditional: 'all' },
    validateResponses: process.env.NODE_ENV === 'test',
    validateSecurity: false, // auth stays in middleware/auth.js
    ignorePaths: /^\/img\//,
    serDes: [OpenApiValidator.serdes.dateTime]
  });
}

module.exports = { SPEC_PATH, buildValidator };
```

- [ ] **Step 4: Write `src/middleware/stripTrailingSlash.js`**

```js
// Express matches /users/dire/ and /users/dire alike and the app sends both;
// the validator matches paths literally. Normalize before it sees them.
module.exports = function stripTrailingSlash(req, res, next) {
  const [p, q] = req.url.split('?');
  if (p.length > 1 && p.endsWith('/')) {
    req.url = p.replace(/\/+$/, '') + (q !== undefined ? '?' + q : '');
  }
  next();
};
```

- [ ] **Step 5: Write `src/middleware/omitEmpty.js`**

```js
// Joi's .empty('') / .empty(null) removed the key, so "no value" meant "don't
// touch it". OpenAPI passes '' and null through; this keeps the old meaning for
// the fields that relied on it.
module.exports = function omitEmpty(fields, values = ['']) {
  return function (req, res, next) {
    if (req.body && typeof req.body === 'object') {
      for (const f of fields) {
        if (values.includes(req.body[f])) delete req.body[f];
      }
    }
    next();
  };
};
```

- [ ] **Step 6: Mount in `src/server.js`**

After `app.use(helmet(...))` and before the `app.get('/img/producto/:id', ...)` line, add:

```js
app.use(require('./middleware/stripTrailingSlash'));
app.use(require('./helpers/openapi').buildValidator());
```

- [ ] **Step 7: Translate validator errors in `src/middleware/error-handler.js`**

Add this case **first** inside `switch (true)`:

```js
        // express-openapi-validator: { status, errors: [{ path, message }] }
        case err !== null && typeof err === 'object' && Array.isArray(err.errors) && Number.isInteger(err.status): {
            if (err.status === 404 || err.status === 405) {
                return res.status(404).json({ res: false, message: 'Route-not-found' });
            }
            const campos = [...new Set(err.errors.map(campoDe).filter(Boolean))];
            return res.status(err.status).json({
                res: false,
                message: 'Faltan datos o hay datos inválidos' + (campos.length ? ': ' + campos.join(', ') : '.')
            });
        }
```

And at the bottom of the file:

```js
// '/body/telefono' -> 'telefono'; a missing required field may come as
// path '/body' with "must have required property 'telefono'".
function campoDe(e) {
    const m = /required property '([^']+)'/.exec(e.message || '');
    if (m) return m[1];
    const partes = String(e.path || '').split('/').filter(Boolean);
    return partes.length > 1 ? partes[partes.length - 1] : null;
}
```

- [ ] **Step 8: Delete the Joi schemas and add `omitEmpty` where Joi had `.empty(...)`**

For each route file, remove the `const Joi = require('joi');` and `validateRequest` requires, remove every `function xxxSchema(...)`, and drop the schema middleware from each `router.*` call. Replace the ones that had `.empty(...)`:

`users.routes.js`:
```js
const omitEmpty = require('../middleware/omitEmpty');
router.post('/signin', limitSignin, authenticate);
router.post('/signup', limitSignup, register);
router.post('/reset', limitMail, resetPass);
router.post('/reenviar', limitMail, reenviar);
router.post('/changePass', limitResetToken, cambiarPass);
router.put('/', auth.verifyToken(), omitEmpty(['dni']), update);
router.put('/cambiarFoto/:id', auth.verifyToken(), omitEmpty(['foto']), updateFoto);
```

`quodom.route.js`:
```js
const omitEmpty = require('../middleware/omitEmpty');
router.post('/create', auth.verifyToken(), omitEmpty(['iddireccion'], [null]), create);
router.put('/:id', auth.verifyToken(), omitEmpty(['iddireccion'], [null]), update);
```

`quodom_lines.route.js`:
```js
const omitEmpty = require('../middleware/omitEmpty');
router.post('/add', auth.verifyToken(), omitEmpty(['atributo1', 'atributo2']), add);
router.put('/:id', auth.verifyToken(), omitEmpty(['atributo1', 'atributo2']), update);
```

`user_direcciones.route.js`:
```js
const omitEmpty = require('../middleware/omitEmpty');
const EMPTY = omitEmpty(['piso', 'direccion', 'observaciones']);
router.post('/create', auth.verifyToken(), EMPTY, create);
router.put('/:id', auth.verifyToken(), EMPTY, update);
```

`oper_notificaciones.route.js`:
```js
router.put('/:id', auth.verifyToken(), update);
```

Then delete `src/middleware/validate-request.js` and run `grep -rn "validate-request\|require('joi')" src` — expected: no output. Remove `joi` from `package.json` dependencies with `npm uninstall joi` only if that grep is empty.

- [ ] **Step 9: Run the new tests**

Run: `npx jest tests/openapi.validation.test.js`
Expected: PASS (8 tests).

- [ ] **Step 10: Run the full suite**

Run: `npx jest`
Expected: all pass. If an existing test fails because the validator answered before the handler (typical symptom: a test expects `res.body.error` to be a code like `idrubro_invalido` or `no_last_user_message` and gets `undefined`), **loosen that field in `openapi.yaml`** (e.g. drop its `type` or `required`) — never edit the test. Re-run until green. Note each loosened field in the commit message.

- [ ] **Step 11: Commit**

```bash
git add -A src tests/openapi.validation.test.js package.json package-lock.json openapi.yaml
git commit -m "feat(api): validate requests against openapi.yaml and drop Joi

Validator errors keep the { res: false, message } shape with a Spanish
message naming the fields; unknown routes and methods keep answering
404 Route-not-found. omitEmpty keeps Joi's .empty() meaning for the
fields that relied on it, and trailing slashes are stripped first.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Validate responses in tests and fix every mismatch

**Files:**
- Modify: `quodom-web/api/openapi.yaml` (and, only where the code is wrong, the controller)
- Possibly modify: `quodom-web/api/src/helpers/openapi.js`

**Interfaces:**
- Consumes: `buildValidator()` (Task 5), which already turns on `validateResponses` under `NODE_ENV=test`.

- [ ] **Step 1: Probe how the validator treats Sequelize instances**

Add a temporary test at the end of `tests/openapi.validation.test.js`:

```js
it('PROBE: provincias passes response validation', async () => {
  const res = await request(app).get('/provincias'); // provincia 1 comes from beforeAll
  console.log(res.status, JSON.stringify(res.body).slice(0, 300));
  expect(res.status).toBe(200);
});
```

Run: `npx jest tests/openapi.validation.test.js -t PROBE`
- If PASS: instances are serialized before validation. Go to Step 3.
- If FAIL with a 500 whose message mentions `dataValues`, `_previousDataValues` or `must NOT have additional properties`: go to Step 2.

- [ ] **Step 2 (only if the probe failed): validate the serialized body**

In `src/helpers/openapi.js`, export a middleware that runs before the validator and makes `res.json` hand plain JSON to it:

```js
// The response validator inspects the object passed to res.json, before
// JSON.stringify runs toJSON() on Sequelize instances. Give it what the client
// actually receives.
function plainJson(req, res, next) {
  const json = res.json.bind(res);
  res.json = body => json(body === undefined ? body : JSON.parse(JSON.stringify(body)));
  next();
}
```

Export it as `plainJson`, and in `server.js` mount it immediately before `buildValidator()`, only in tests:

```js
if (process.env.NODE_ENV === 'test') app.use(require('./helpers/openapi').plainJson);
```

Re-run the probe; expected PASS.

- [ ] **Step 3: Delete the probe and run the full suite**

Run: `npx jest 2>&1 | grep -E "✕|●|Tests:"`
Expected: failures now come from real contract mismatches, each a 500 with the validator message naming the path and field (e.g. `.response.cantidad should be number` because SQLite returns `DECIMAL` as a string).

- [ ] **Step 4: Fix each mismatch**

For each failure decide which side is wrong and write it down in a scratch list:
- **The contract is wrong** (it guessed a type, e.g. `cantidad` comes back as `"2"` from SQLite `DECIMAL`): fix `openapi.yaml` to describe reality (`oneOf: [{ type: number }, { type: string }]`), **and** note it: the app types will now show `number | string`, which is honest.
- **The code leaks something it shouldn't** (e.g. a response includes `password`, `foto` blobs, or `createdBy` where the contract doesn't list it): fix the controller to stop sending it, if no app code reads it (`grep -rn "<field>" ../app/src`).
- **A controller-returned body declared `{}`** (`PUT /user_direcciones/:id`, `PUT /user_direcciones/prin/:id`): look at what it returns in the passing test output and replace `{}` with the real schema.

Re-run `npx jest` after each fix. Expected at the end: all pass.

- [ ] **Step 5: Prove response validation bites**

Temporarily change `SigninResponse.required` to include `nonexistent`, run `npx jest tests/users.test.js`, expect a FAIL mentioning `nonexistent`; revert. (Do not commit the change.)

- [ ] **Step 6: Commit**

```bash
git add openapi.yaml src tests
git commit -m "test(api): validate every response against openapi.yaml under tests

Lists each contract fix and each code fix the response validator forced.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

(Replace the second paragraph with the actual list from Step 4.)

---

### Task 7: Generate the app's types from the contract

**Files:**
- Modify: `quodom-web/app/package.json`
- Create: `quodom-web/app/src/api/schema.d.ts` (generated)
- Modify: `quodom-web/app/src/api/types.ts`
- Create: `quodom-web/app/tests/api-types.test.ts`

**Interfaces:**
- Consumes: `quodom-web/api/openapi.yaml` (Tasks 1–6).
- Produces: `components['schemas']` in `app/src/api/schema.d.ts`; `types.ts` keeps exporting `User`, `Category`, `Product`, `ProductWithExiste`, `Atributo`, `Quodom`, `QuodomLine`, `Direccion`, `Provincia`, `Localidad`, `Notificacion`, `BusquedaResult` so no import elsewhere changes.

- [ ] **Step 1: Install and add the script**

```bash
cd quodom-web/app
npm install -D openapi-typescript@7.13.0
```

In `package.json` `scripts` add:

```json
"api-types": "openapi-typescript ../api/openapi.yaml -o src/api/schema.d.ts"
```

- [ ] **Step 2: Write the freshness test (fails: no `schema.d.ts` yet)**

`tests/api-types.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import openapiTS, { astToString } from 'openapi-typescript';

// schema.d.ts is generated from api/openapi.yaml and committed. If someone
// edits the contract and forgets `npm run api-types`, the app keeps compiling
// against the old shapes and nothing complains, which is what this catches.
describe('generated API types', () => {
  it('match api/openapi.yaml', async () => {
    const spec = new URL('file:///' + resolve(__dirname, '../../api/openapi.yaml').replace(/\\/g, '/'));
    const fresh = astToString(await openapiTS(spec));
    const committed = readFileSync(resolve(__dirname, '../src/api/schema.d.ts'), 'utf8');
    const norm = (s: string) => s.replace(/\r\n/g, '\n').split('\n').filter(l => !l.startsWith('/**') || !l.includes('auto-generated')).join('\n').trim();
    expect(norm(committed)).toContain(norm(fresh));
  });
});
```

Run: `npx vitest run tests/api-types.test.ts`
Expected: FAIL (`ENOENT ... schema.d.ts`).

- [ ] **Step 3: Generate**

Run: `npm run api-types`
Expected: `src/api/schema.d.ts` created. Re-run the test: PASS. If it fails only on the generated header comment, adjust `norm` to drop the header lines the CLI adds (the CLI prepends a comment block the programmatic API does not); do not weaken the comparison beyond that.

- [ ] **Step 4: Turn `types.ts` into aliases**

Replace the hand-written shapes, keeping the export names and the one comment that explains a non-obvious field:

```ts
import type { components } from './schema';

type S = components['schemas'];

export type User = S['CurrentUser'] & Partial<Pick<S['SigninResponse'], 'role'>>;
export type Category = S['Category'];
// atributo1/atributo2 son el NOMBRE del grupo ("MEDIDAS"); los valores
// elegibles de cada uno vienen en valoresAtributoN.
export type Product = S['Product'];
export type ProductWithExiste = S['ProductWithExiste'];
export type Atributo = S['Atributo'];
export type Quodom = S['VQuodom'];
export type QuodomLine = S['VQuodomLine'];
export type Direccion = S['Direccion'];
export type Provincia = S['Provincia'];
export type Localidad = S['Localidad'];
export type Notificacion = S['Notificacion'];
export type BusquedaResult = S['BusquedaResult'];
```

- [ ] **Step 5: Typecheck and fix what the real contract reveals**

Run: `npm run typecheck`
Expected: errors where the hand-written types were wrong (e.g. `Localidad` had `localidad` but the API sends `nombre`; `cantidad` may now be `number | string`; `Product.valoresAtributo1` optional). For each error fix the **consumer** to handle what the API really sends (e.g. `Number(linea.cantidad)`), unless Task 6 showed the contract itself should change — in that case change `openapi.yaml`, re-run `npm run api-types`, and re-run the API suite. Repeat until `npm run typecheck` is clean.

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/api/schema.d.ts src/api/types.ts tests/api-types.test.ts
git commit -m "feat(app): generate API types from openapi.yaml

types.ts keeps its export names as aliases over the generated schema, so
no import changes; a Vitest test fails when schema.d.ts is stale.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

(Add the consumer fixes from Step 5 to the file list and message.)

---

### Task 8: Dev-only docs page

**Files:**
- Modify: `quodom-web/api/src/server.js`
- Create: `quodom-web/api/nodemon.json`
- Test: `quodom-web/api/tests/openapi.docs.test.js`

**Interfaces:**
- Consumes: `SPEC_PATH` (Task 5).

- [ ] **Step 1: Write the failing test**

`tests/openapi.docs.test.js`:

```js
const request = require('supertest');

describe('/docs', () => {
  afterEach(() => { delete process.env.API_DOCS; jest.resetModules(); });

  it('does not exist unless API_DOCS=true', async () => {
    const app = require('../src/server');
    const res = await request(app).get('/docs/');
    expect(res.status).toBe(404);
  });

  it('serves the docs page when API_DOCS=true', async () => {
    process.env.API_DOCS = 'true';
    const app = require('../src/server');
    const res = await request(app).get('/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/swagger-ui/i);
  });
});
```

Run: `npx jest tests/openapi.docs.test.js`
Expected: the second test FAILS (404).

- [ ] **Step 2: Mount the page before the validator**

In `src/server.js`, **before** `app.use(require('./middleware/stripTrailingSlash'))`:

```js
// The API map, for local development only. Render does not set API_DOCS, so
// production answers /docs with the usual 404 and publishes no route list.
if (process.env.API_DOCS === 'true') {
  const swaggerUi = require('swagger-ui-express');
  const YAML = require('yaml');
  const { SPEC_PATH } = require('./helpers/openapi');
  const spec = YAML.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
}
```

It must sit before `stripTrailingSlash` because swagger-ui serves `/docs/` and its assets under that exact prefix, and before the validator because `/docs` is not in the contract. Also add `/^\/docs/` to `ignorePaths` in `buildValidator()`: `ignorePaths: /^\/(img|docs)(\/|$)/`.

`/docs` is not an API route, so `listRoutes` must skip it: in `src/helpers/listRoutes.js` change the final filter to `.filter(r => r.path !== '*' && !r.path.startsWith('/img') && !r.path.startsWith('/docs'))`. (With `API_DOCS` unset in tests, it doesn't appear anyway; this keeps the coverage test right if someone runs tests with it set.)

- [ ] **Step 3: Set the variable for `npm run dev`**

`nodemon.json`:

```json
{
  "env": { "API_DOCS": "true" }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest tests/openapi.docs.test.js tests/openapi.coverage.test.js`
Expected: PASS.

- [ ] **Step 5: Check it by hand**

Run `npm run dev` in `quodom-web/api`, open `http://localhost:3999/docs/`. Expected: the page lists the eight tags; "Try it out" on `GET /categorias` returns the rubros. Then `curl -s -o /dev/null -w "%{http_code}" https://quodom-api.onrender.com/docs/` after deploy → `404`.

- [ ] **Step 6: Commit**

```bash
git add src/server.js src/helpers/openapi.js src/helpers/listRoutes.js nodemon.json tests/openapi.docs.test.js
git commit -m "feat(api): serve the OpenAPI docs page at /docs in development only

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Project notes and the list of unused routes

**Files:**
- Modify: `CLAUDE.md` (repo root), `quodom-web/api/CLAUDE.md`, `quodom-web/app/CLAUDE.md`

- [ ] **Step 1: Root `CLAUDE.md`, §2 Arquitectura** — add a bullet:

```markdown
- **OpenAPI first:** `quodom-web/api/openapi.yaml` es el contrato entre la app y el API, y **manda**. Todo cambio de API empieza ahí y después va el código. El API rechaza pedidos que no lo cumplen (y descarta campos de más), los tests validan cada respuesta contra él, y la app genera sus tipos con `npm run api-types`. Tres tests fallan si se desalinean: cobertura de rutas, respuestas, y tipos al día. Spec: `docs/superpowers/specs/2026-09-23-openapi-first-design.md`.
```

- [ ] **Step 2: `quodom-web/api/CLAUDE.md`** — under `## Comandos` add:

```markdown
- `http://localhost:3999/docs/` — la documentación navegable del API, sólo con `npm run dev` (`nodemon.json` pone `API_DOCS=true`). En Render no existe.
```

Under `## Convenciones` replace nothing, add:

```markdown
- **Una ruta nueva o cambiada empieza por `openapi.yaml`.** Sin eso falla `tests/openapi.coverage.test.js` (ruta sin describir) o la validación de respuestas. Ya no hay esquemas Joi: la validación de pedidos sale del contrato. Si un campo vacío tiene que significar "no tocar", va `omitEmpty([...])` en la ruta, porque el contrato deja pasar `''` y `null`.
- Todo campo que un handler lea del body tiene que estar declarado en el contrato: el validador borra los que no lo están.
```

- [ ] **Step 3: `quodom-web/app/CLAUDE.md`** — under `## Comandos` add:

```markdown
- `npm run api-types` — regenera `src/api/schema.d.ts` desde `../api/openapi.yaml`. Correrlo cada vez que cambia el contrato; `tests/api-types.test.ts` falla si quedó viejo.
```

and change the `src/api/` bullet under `## Estructura` to:

```markdown
- `src/api/` — cliente `apiFetch` + un módulo por recurso. Todas las llamadas al backend pasan por acá. Los tipos de datos **no se escriben a mano**: `types.ts` son alias de `schema.d.ts`, generado desde `openapi.yaml`.
```

- [ ] **Step 4: Build the unused-routes list**

Run from `quodom-web/`:

```bash
node -e "
const app=require('./api/src/server');
const {listRoutes}=require('./api/src/helpers/listRoutes');
const fs=require('fs'),path=require('path');
const src=[];(function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);if(f==='__tests__')continue;fs.statSync(p).isDirectory()?walk(p):/\.tsx?$/.test(f)&&src.push(fs.readFileSync(p,'utf8'))}})('app/src');
const all=src.join('\n');
for(const r of listRoutes(app)){const lit=r.path.split('{')[0].replace(/\/$/,'');if(lit&&lit!=='/'&&!all.includes(\"'\"+lit)&&!all.includes('\"'+lit))console.log(r.method.toUpperCase(),r.path)}
process.exit(0)"
```

Expected: a list of routes whose literal prefix never appears in `app/src`. Check each by hand with `grep -rn "<segment>" app/src` (a route built with template strings may be a false positive).

- [ ] **Step 5: Commit the notes**

```bash
git add ../CLAUDE.md api/CLAUDE.md app/CLAUDE.md
git commit -m "docs: record the OpenAPI-first rule and the new commands

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Hand the list to the user**

Report the unused routes in plain Spanish, one line each with what it did in the original app, and ask which to delete. Do not delete any as part of this plan.
