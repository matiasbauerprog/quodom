# Varios Quodoms por rubro y el árbol — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir varios Quodoms abiertos por rubro y reemplazar el "Quodom activo" implícito por un árbol donde el Quodom abierto de cada rubro es el que recibe lo que se agrega.

**Architecture:** El backend deja de imponer el tope (se borra un índice único parcial y las validaciones que lo acompañaban). El cliente gana un mapa `{ idrubro: idquodom }` en `localStorage` que dice cuál está abierto en cada rubro; ese mapa es la única fuente de la decisión "a dónde va el `+`". El panel derecho y la barra inferior pasan a renderizar un mismo componente de árbol, que además es la zona de soltado del arrastre.

**Tech Stack:** Express + Sequelize 6 + SQLite (CommonJS) · React 18 + Vite + TypeScript + CSS plano · Jest + Supertest · Vitest + Testing Library · OpenAPI 3

**Spec:** `docs/superpowers/specs/2026-10-14-multi-quodom-y-arbol-design.md`

## Global Constraints

- **OpenAPI primero.** Toda ruta nueva o cambiada empieza por `quodom-web/api/openapi.yaml`. Sin eso falla `tests/openapi.coverage.test.js`. Después de tocarlo, correr `npm run api-types` en `app/`, si no falla `tests/api-types.test.ts`.
- **Todo campo que un handler lea del body tiene que estar declarado en el contrato**: el validador borra los que no lo están.
- **TDD estricto**: test primero, verlo fallar, implementación mínima, verlo pasar, commit.
- **UI en español, código y commits en inglés.** Comentarios sólo donde el "por qué" no sea evidente.
- **Un Quodom pertenece a un solo rubro y ese rubro es inmutable.** `rubro_mismatch` (409) se queda tal cual.
- **El rubro de un producto se calcula**, nunca se lee de `productos.categoriaPadre` (`api/src/helpers/catalogoActivo.js`).
- **`api/quodom.sqlite` está trackeada y corre en WAL.** Después de cualquier cambio de schema, verificar el blob commiteado: `git show HEAD:quodom-web/api/quodom.sqlite > /tmp/check.sqlite`.
- **Mobile-first.** Breakpoints: tablet `(min-width: 601px) and (max-width: 1024px)`, desktop `(min-width: 1025px)`. `.mq-sidebar` sólo existe desde 1025px; `.barra-quodom` sólo hasta 1024px.
- **Paleta:** fondo `#F1F1F1`, acento `#E63946`, éxito `#2DAB66`, texto `#1A1A1A`, tarjeta `#FFFFFF`, panel oscuro `#1E1E2A`. Forma de hoja: `border-top-left-radius: 8px; border-bottom-right-radius: 8px`.
- **Nunca commitear `.env`.**

## Review Focus

Cinco cosas que el spec implica y que ningún test de tarea ejercita por sí solo. Cada una tiene su test asignado a la tarea dueña del código.

1. **El mapa de abiertos apunta a un Quodom que ya no existe** (borrado en otra pestaña, o enviado). Tiene que leerse como "ninguno abierto", no romper. → Task 4.
2. **`localStorage` tira excepción o vuelve vacío** (ventana privada, datos bloqueados). La app tiene que funcionar igual, preguntando el destino cada vez. → Task 4.
3. **Soltar fuera de cualquier destino válido** (en el vacío, en el catálogo, sobre el encabezado de un rubro). No pasa nada y no aparece ningún error. → Task 10.
4. **Un rubro desactivado que todavía tiene un Quodom abierto.** No puede ofrecerse como destino ni en el árbol ni en la pregunta. → Task 5.
5. **Dos agregados seguidos sin esperar al primero.** El segundo no puede mandar la línea al Quodom equivocado por leer un mapa a medio actualizar. → Task 8.

---

## Estructura de archivos

**API**

| Archivo | Responsabilidad |
|---|---|
| `api/src/seed/migrar-multi-quodom.js` | **nuevo** — borra el índice único en una base existente |
| `api/src/models/quodom.model.js` | saca el índice de la definición |
| `api/src/controllers/quodom.controller.js` | `create` y `repetir` sin tope; `getActivosPorRubro` en plural |
| `api/src/routes/quodom.route.js` | `GET /quodom/activos/:idrubro` |
| `api/openapi.yaml` | la ruta nueva, y la vieja fuera |

**App**

| Archivo | Responsabilidad |
|---|---|
| `app/src/quodom/quodomAbierto.ts` | **nuevo** — el mapa `{idrubro: idquodom}`, con saneo |
| `app/src/quodom/ramas.ts` | **nuevo** — agrupa la lista plana de Quodoms en ramas por rubro |
| `app/src/components/layout/ArbolQuodoms.tsx` | **nuevo** — el árbol, usado por el panel y por la barra |
| `app/src/quodom/arrastre.ts` | **nuevo** — arrastre con eventos de puntero |
| `app/src/quodom/DialogoDestino.tsx` | **nuevo** — la única pregunta de destino de los tres caminos |
| `app/src/quodom/agregarProducto.ts` | el `+` resuelve contra el mapa |
| `app/src/components/layout/MisQuodomsSidebar.tsx` | usa el árbol; pierde "Repetí un pedido" |
| `app/src/components/layout/BarraQuodomInferior.tsx` | usa el árbol |
| `app/src/screens/MisQuodoms/ListaMisQuodoms.tsx` | recibe "Repetí un pedido" |
| `app/src/screens/Home/ListaProductos.tsx` | tarjeta con `+`, `···` y agarre |
| `app/src/guest/DialogoConflictoRubro.tsx` | **se borra** |
| `app/src/quodom/DialogoNuevoRubro.tsx` | **se borra** |

---

## Task 1: Borrar el índice que impone el tope

**Files:**
- Create: `quodom-web/api/src/seed/migrar-multi-quodom.js`
- Modify: `quodom-web/api/src/models/quodom.model.js:30-44`
- Modify: `quodom-web/api/package.json` (scripts)
- Test: `quodom-web/api/tests/quodom.rubro.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: la base acepta dos Quodoms `CREADO` del mismo rubro y usuario.

- [ ] **Step 1: Escribir el test que falla**

En `quodom-web/api/tests/quodom.rubro.test.js`, reemplazar el test
`rejects a second quodom of the same rubro` por:

```js
it('permite varios Quodoms abiertos del mismo rubro', async () => {
  const primero = await request(app).post('/quodom/create')
    .set('Authorization', 'Bearer ' + token)
    .send({ descripcion: 'Casa', idrubro: 7 });
  expect(primero.status).toBe(200);

  const segundo = await request(app).post('/quodom/create')
    .set('Authorization', 'Bearer ' + token)
    .send({ descripcion: 'Depto', idrubro: 7 });

  expect(segundo.status).toBe(200);
  expect(segundo.body.idquodom).not.toBe(primero.body.idquodom);

  const abiertos = await db.Quodom.count({
    where: { createdBy: userId, idrubro: 7, estado: 'CREADO' }
  });
  expect(abiertos).toBe(2);
});
```

- [ ] **Step 2: Correrlo y verlo fallar**

Run: `cd quodom-web/api && npx jest tests/quodom.rubro.test.js -t "permite varios" --runInBand`
Expected: FAIL — el segundo `create` contesta 409 `rubro_duplicado`.

- [ ] **Step 3: Sacar el índice del modelo**

En `quodom-web/api/src/models/quodom.model.js`, borrar entero el bloque `indexes: [...]`
dentro de `options`, dejando:

```js
    const options = {
        defaultScope: {
        },
        scopes: {
        }
    };
```

- [ ] **Step 4: Escribir la migración**

Create `quodom-web/api/src/seed/migrar-multi-quodom.js`:

```js
/**
 * Borra el índice único parcial que impedía dos Quodoms abiertos del mismo
 * rubro. Sacarlo del modelo no alcanza: `model.sync()` crea una tabla que falta
 * pero NUNCA hace ALTER sobre una que ya existe, así que en cualquier base ya
 * creada el índice sigue vivo y SQLite rechaza el segundo Quodom con un error
 * de constraint que nadie espera. Es idempotente.
 */
require('dotenv').config();
const db = require('../helpers/db');

async function main() {
  await db.ready;
  await db.sequelize.query('DROP INDEX IF EXISTS quodom_abierto_por_rubro');
  console.log('  índice quodom_abierto_por_rubro: borrado si existía');

  const [indices] = await db.sequelize.query("PRAGMA index_list('quodom_headers')");
  console.log('  índices que quedan:', indices.map(i => i.name).join(', ') || '(ninguno)');

  // La base corre en WAL y sólo quodom.sqlite se commitea: sin el checkpoint,
  // el archivo que se sube puede no tener este cambio adentro.
  const [[wal]] = await db.sequelize.query('PRAGMA wal_checkpoint(TRUNCATE)');
  console.log('WAL checkpointed into quodom.sqlite:', JSON.stringify(wal));

  await db.sequelize.close();
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('Migrar-multi-quodom failed:', err); process.exit(1); });
```

En `quodom-web/api/package.json`, agregar en `scripts`, debajo de `migrar-empresa`:

```json
    "migrar-multi-quodom": "node src/seed/migrar-multi-quodom.js",
```

- [ ] **Step 5: Correr el test y verlo pasar**

Run: `cd quodom-web/api && npx jest tests/quodom.rubro.test.js --runInBand`
Expected: PASS. Los tests usan SQLite en memoria creada desde el modelo, así que no
necesitan la migración; la migración es para bases que ya existen.

- [ ] **Step 6: Correr la migración sobre la base real y verificar**

```bash
cd quodom-web/api && npm run migrar-multi-quodom
```
Expected: dice que lo borró y lista los índices que quedan sin `quodom_abierto_por_rubro`.

- [ ] **Step 7: Commit**

```bash
git add quodom-web/api/src/models/quodom.model.js quodom-web/api/src/seed/migrar-multi-quodom.js quodom-web/api/package.json quodom-web/api/tests/quodom.rubro.test.js quodom-web/api/quodom.sqlite
git commit -m "feat(api): allow several open quodoms per rubro"
```

---

## Task 2: `create` y `repetir` dejan de rechazar

**Files:**
- Modify: `quodom-web/api/src/controllers/quodom.controller.js:42-110` (`create`, `rubroDuplicado`), `:196-230` (`repetir`)
- Test: `quodom-web/api/tests/quodom.rubro.test.js`

**Interfaces:**
- Consumes: Task 1 (el índice ya no existe).
- Produces: `create(params, userId)` nunca tira `rubro_duplicado`. `rubroDuplicado()` deja de existir.

- [ ] **Step 1: Escribir el test que falla**

```js
it('repetir no choca con un Quodom abierto del mismo rubro', async () => {
  const origen = await request(app).post('/quodom/create')
    .set('Authorization', 'Bearer ' + token)
    .send({ descripcion: 'Original', idrubro: 7 });
  await request(app).post('/quodom_lines/add')
    .set('Authorization', 'Bearer ' + token)
    .send({ idquodom: origen.body.idquodom, idproducto: 700, cantidad: 1, nombreProducto: 'Gaseosa' });

  const res = await request(app).post('/quodom/repetir/' + origen.body.idquodom)
    .set('Authorization', 'Bearer ' + token);

  expect(res.status).toBe(200);
  expect(res.body.idquodom).not.toBe(origen.body.idquodom);
});
```

- [ ] **Step 2: Correrlo y verlo fallar**

Run: `cd quodom-web/api && npx jest tests/quodom.rubro.test.js -t "repetir no choca" --runInBand`
Expected: FAIL con 409 `rubro_duplicado`.

- [ ] **Step 3: Sacar el tope del controller**

En `quodom-web/api/src/controllers/quodom.controller.js`, dentro de `create`, borrar:

```js
    const abierto = await db.Quodom.findOne({
        where: { createdBy: userId, idrubro: params.idrubro, estado: 'CREADO' }
    });
    if (abierto) {
        throw rubroDuplicado(rubro, abierto);
    }
```

y reemplazar el `try/catch` del insert por el insert pelado:

```js
    const { id } = await db.Quodom.create(params);
    return (id);
```

Borrar la función `rubroDuplicado` entera.

- [ ] **Step 4: Correr toda la suite de la API**

Run: `cd quodom-web/api && npx jest --runInBand`
Expected: PASS. Los tests de `quodom.rubro.test.js` que esperaban 409 `rubro_duplicado`
en `create` y en `repetir` hay que actualizarlos acá: ya no es un error, es el
comportamiento nuevo. Los de `rubro_mismatch` **no se tocan**.

- [ ] **Step 5: Commit**

```bash
git add quodom-web/api/src/controllers/quodom.controller.js quodom-web/api/tests/quodom.rubro.test.js
git commit -m "feat(api): drop the one-open-quodom-per-rubro rule from create and repetir"
```

---

## Task 3: `GET /quodom/activos/:idrubro` en plural

**Files:**
- Modify: `quodom-web/api/openapi.yaml` (la ruta `/quodom/activo/{idrubro}`)
- Modify: `quodom-web/api/src/controllers/quodom.controller.js` (`getActivoPorRubro`)
- Modify: `quodom-web/api/src/routes/quodom.route.js:16`
- Modify: `quodom-web/app/src/api/quodom.ts`
- Test: `quodom-web/api/tests/quodom.rubro.test.js`

**Interfaces:**
- Consumes: Task 2.
- Produces: `GET /quodom/activos/:idrubro` → `{ res: true, data: Quodom[] }`, ordenados por `createdAt` descendente. En la app: `quodom.activosPorRubro(idrubro): Promise<Quodom[]>`.

- [ ] **Step 1: Cambiar el contrato primero**

En `quodom-web/api/openapi.yaml`, renombrar la ruta `/quodom/activo/{idrubro}` a
`/quodom/activos/{idrubro}` y cambiar el `data` de objeto nullable a array:

```yaml
  /quodom/activos/{idrubro}:
    get:
      tags: [quodom]
      summary: Los Quodoms en armado (CREADO) del usuario en ese rubro
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
                required: [res, data]
                properties:
                  res: { type: boolean }
                  data: { type: array, items: { $ref: '#/components/schemas/VQuodom' } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
```

- [ ] **Step 2: Escribir el test que falla**

```js
it('devuelve todos los Quodoms en armado de un rubro, del más nuevo al más viejo', async () => {
  await request(app).post('/quodom/create').set('Authorization', 'Bearer ' + token)
    .send({ descripcion: 'Viejo', idrubro: 7 });
  await request(app).post('/quodom/create').set('Authorization', 'Bearer ' + token)
    .send({ descripcion: 'Nuevo', idrubro: 7 });

  const res = await request(app).get('/quodom/activos/7')
    .set('Authorization', 'Bearer ' + token);

  expect(res.status).toBe(200);
  expect(res.body.data).toHaveLength(2);
  expect(res.body.data[0].descripcion).toBe('Nuevo');
});

it('no incluye los enviados ni los de otros rubros', async () => {
  const q = await request(app).post('/quodom/create').set('Authorization', 'Bearer ' + token)
    .send({ descripcion: 'Se envía', idrubro: 7 });
  await db.Quodom.update({ estado: 'ENVIADO' }, { where: { id: q.body.idquodom } });

  const res = await request(app).get('/quodom/activos/7')
    .set('Authorization', 'Bearer ' + token);

  expect(res.body.data.every(x => x.estado === 'CREADO')).toBe(true);
  expect(res.body.data.every(x => x.idrubro === 7)).toBe(true);
});
```

- [ ] **Step 3: Correrlo y verlo fallar**

Run: `cd quodom-web/api && npx jest tests/quodom.rubro.test.js -t "del más nuevo" --runInBand`
Expected: FAIL 404 — la ruta no existe.

- [ ] **Step 4: Implementar**

En `quodom-web/api/src/controllers/quodom.controller.js`, reemplazar `getActivoPorRubro`
por:

```js
// Los Quodoms en armado de un rubro. Deliberadamente NO crea: crear un Quodom
// necesita que el usuario confirme, así que no puede ser efecto de una lectura.
async function getActivosPorRubro(userId, idrubro) {
    return await db.v_Quodoms.findAll({
        where: { createdBy: userId, estado: 'CREADO', idrubro: idrubro },
        attributes: { exclude: ['createdBy', 'updatedAt'] },
        order: [['createdAt', 'DESC']]
    });
}
```

Actualizar el `module.exports` (`getActivoPorRubro` → `getActivosPorRubro`).

En `quodom-web/api/src/routes/quodom.route.js`, cambiar la ruta y su handler a
`/activos/:idrubro` → `Controler.getActivosPorRubro(...)` devolviendo `{ res: true, data }`,
conservando la validación de `idrubro` que ya tiene.

En `quodom-web/app/src/api/quodom.ts`, reemplazar:

```ts
  // Los Quodoms en armado de un rubro. Nunca crea.
  activosPorRubro: (idrubro: number) =>
    apiFetch<{ res: boolean; data: Quodom[] }>('/quodom/activos/' + idrubro).then(r => r.data),
```

- [ ] **Step 5: Regenerar tipos y correr todo**

```bash
cd quodom-web/app && npm run api-types
cd ../api && npx jest --runInBand
```
Expected: PASS. Los llamadores de `activoPorRubro` en la app quedan rotos a propósito;
se arreglan en Task 8.

- [ ] **Step 6: Commit**

```bash
git add quodom-web/api/openapi.yaml quodom-web/api/src quodom-web/api/tests quodom-web/app/src/api
git commit -m "feat(api): list the open quodoms of a rubro instead of the single active one"
```

---

## Task 4: El mapa de Quodoms abiertos

**Files:**
- Create: `quodom-web/app/src/quodom/quodomAbierto.ts`
- Test: `quodom-web/app/src/quodom/__tests__/quodomAbierto.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `leerAbiertos(): Record<number, string>`
  - `abiertoDe(idrubro: number): string | null`
  - `abrirQuodom(idrubro: number, idquodom: string): void`
  - `cerrarQuodom(idrubro: number): void`
  - `sanearAbiertos(vivos: string[]): void` — descarta las entradas que no estén en `vivos`
  - Todas disparan `window.dispatchEvent(new Event('quodom:abierto'))` cuando cambian.

- [ ] **Step 1: Escribir los tests que fallan**

Create `quodom-web/app/src/quodom/__tests__/quodomAbierto.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { leerAbiertos, abiertoDe, abrirQuodom, cerrarQuodom, sanearAbiertos } from '../quodomAbierto';

beforeEach(() => { localStorage.clear(); });

describe('quodomAbierto', () => {
  it('arranca sin nada abierto', () => {
    expect(leerAbiertos()).toEqual({});
    expect(abiertoDe(5)).toBeNull();
  });

  it('cada rubro se acuerda del suyo', () => {
    abrirQuodom(5, 'q-pintura');
    abrirQuodom(1, 'q-limpieza');

    expect(abiertoDe(5)).toBe('q-pintura');
    expect(abiertoDe(1)).toBe('q-limpieza');
  });

  it('abrir otro del mismo rubro reemplaza al anterior', () => {
    abrirQuodom(5, 'q-casa');
    abrirQuodom(5, 'q-depto');

    expect(abiertoDe(5)).toBe('q-depto');
  });

  it('cerrar deja el rubro sin ninguno', () => {
    abrirQuodom(5, 'q-casa');
    cerrarQuodom(5);

    expect(abiertoDe(5)).toBeNull();
  });

  it('avisa con quodom:abierto cuando algo cambia', () => {
    const escuchado = vi.fn();
    window.addEventListener('quodom:abierto', escuchado);

    abrirQuodom(5, 'q-casa');

    expect(escuchado).toHaveBeenCalled();
    window.removeEventListener('quodom:abierto', escuchado);
  });

  // Review Focus 1: el Quodom se borró o se envió en otra pestaña.
  it('sanear descarta el que ya no está vivo', () => {
    abrirQuodom(5, 'q-borrado');
    abrirQuodom(1, 'q-vivo');

    sanearAbiertos(['q-vivo']);

    expect(abiertoDe(5)).toBeNull();
    expect(abiertoDe(1)).toBe('q-vivo');
  });

  // Review Focus 2: ventana privada, datos bloqueados.
  it('no explota si localStorage falla', () => {
    const roto = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });

    expect(() => leerAbiertos()).not.toThrow();
    expect(abiertoDe(5)).toBeNull();

    roto.mockRestore();
  });

  it('descarta un payload con forma inesperada', () => {
    localStorage.setItem('quodom.abierto', '["no", "es", "un", "mapa"]');

    expect(leerAbiertos()).toEqual({});
  });
});
```

- [ ] **Step 2: Correrlos y verlos fallar**

Run: `cd quodom-web/app && npx vitest run src/quodom/__tests__/quodomAbierto.test.ts`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar**

Create `quodom-web/app/src/quodom/quodomAbierto.ts`:

```ts
const CLAVE = 'quodom.abierto';

/**
 * Qué Quodom está abierto en cada rubro: `{ 5: 'id-del-de-pintura' }`.
 *
 * Es estado del cliente, no del Quodom: dos pestañas pueden tener abiertos
 * distintos y al servidor no le importa. Por eso vive acá y no viaja en el
 * contrato.
 */
export type Abiertos = Record<number, string>;

function esMapa(x: unknown): x is Abiertos {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  return Object.entries(x as Record<string, unknown>)
    .every(([k, v]) => /^(0|[1-9]\d*)$/.test(k) && typeof v === 'string' && v !== '');
}

export function leerAbiertos(): Abiertos {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return {};
    const parseado = JSON.parse(crudo);
    return esMapa(parseado) ? parseado : {};
  } catch {
    return {};
  }
}

function guardar(mapa: Abiertos): void {
  try { localStorage.setItem(CLAVE, JSON.stringify(mapa)); } catch {}
  window.dispatchEvent(new Event('quodom:abierto'));
}

export function abiertoDe(idrubro: number): string | null {
  return leerAbiertos()[idrubro] ?? null;
}

export function abrirQuodom(idrubro: number, idquodom: string): void {
  const mapa = leerAbiertos();
  mapa[idrubro] = idquodom;
  guardar(mapa);
}

export function cerrarQuodom(idrubro: number): void {
  const mapa = leerAbiertos();
  delete mapa[idrubro];
  guardar(mapa);
}

/**
 * Descarta los que ya no existen. Un Quodom borrado en otra pestaña, o enviado,
 * dejaría el mapa apuntando a la nada; "ninguno abierto" es un estado válido que
 * el resto ya sabe resolver, así que eso es lo que queda.
 */
export function sanearAbiertos(vivos: string[]): void {
  const mapa = leerAbiertos();
  let cambio = false;
  for (const clave of Object.keys(mapa)) {
    if (!vivos.includes(mapa[Number(clave)])) { delete mapa[Number(clave)]; cambio = true; }
  }
  if (cambio) guardar(mapa);
}
```

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `cd quodom-web/app && npx vitest run src/quodom/__tests__/quodomAbierto.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add quodom-web/app/src/quodom/quodomAbierto.ts quodom-web/app/src/quodom/__tests__/quodomAbierto.test.ts
git commit -m "feat(app): remember which quodom is open per rubro"
```

---

## Task 5: El árbol

**Files:**
- Create: `quodom-web/app/src/components/layout/ArbolQuodoms.tsx`
- Create: `quodom-web/app/src/components/layout/ArbolQuodoms.css`
- Test: `quodom-web/app/src/components/layout/__tests__/ArbolQuodoms.test.tsx`

**Interfaces:**
- Consumes: `abiertoDe`, `abrirQuodom`, `cerrarQuodom` (Task 4); `rubrosDisponibles` de `app/src/quodom/rubrosDisponibles.ts`.
- Produces:
```ts
export type RamaRubro = { idrubro: number; nombre: string; quodoms: Quodom[] };
export function ArbolQuodoms(props: {
  ramas: RamaRubro[];
  onCambio: () => void;
  renderAbierto?: (q: Quodom) => React.ReactNode;
}): JSX.Element;
```

- [ ] **Step 1: Escribir los tests que fallan**

Create `quodom-web/app/src/components/layout/__tests__/ArbolQuodoms.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ArbolQuodoms, type RamaRubro } from '../ArbolQuodoms';
import { abiertoDe, abrirQuodom } from '../../../quodom/quodomAbierto';
import type { Quodom } from '../../../api/types';

function q(id: string, descripcion: string, idrubro: number, estado = 'CREADO'): Quodom {
  return { id, descripcion, estado, nro: 'QD-' + id, idrubro, cantproductos: 2, porccompletado: 100 } as unknown as Quodom;
}

const RAMAS: RamaRubro[] = [
  { idrubro: 5, nombre: 'PINTURERÍA', quodoms: [q('p1', 'Casa', 5), q('p2', 'Depto', 5)] },
  { idrubro: 1, nombre: 'LIMPIEZA', quodoms: [q('l1', 'Oficina', 1)] },
  { idrubro: 7, nombre: 'BEBIDAS', quodoms: [] }
];

function montar(ramas = RAMAS, onCambio = vi.fn()) {
  render(<MemoryRouter><ArbolQuodoms ramas={ramas} onCambio={onCambio} /></MemoryRouter>);
  return onCambio;
}

beforeEach(() => { localStorage.clear(); });

describe('ArbolQuodoms', () => {
  it('muestra un rubro por rama con su cantidad', () => {
    montar();

    expect(screen.getByRole('button', { name: /PINTURERÍA/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /LIMPIEZA/ })).toBeInTheDocument();
  });

  it('muestra los Quodoms de un rubro desplegado', () => {
    montar();

    expect(screen.getByRole('button', { name: /Casa/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Depto/ })).toBeInTheDocument();
  });

  it('plegar un rubro esconde sus Quodoms', () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: /PINTURERÍA/ }));

    expect(screen.queryByRole('button', { name: /Casa/ })).toBeNull();
  });

  it('tocar un Quodom lo abre y lo deja marcado', () => {
    const onCambio = montar();

    fireEvent.click(screen.getByRole('button', { name: /Casa/ }));

    expect(abiertoDe(5)).toBe('p1');
    expect(screen.getByRole('button', { name: /Casa/ })).toHaveAttribute('aria-expanded', 'true');
    expect(onCambio).toHaveBeenCalled();
  });

  it('abrir otro del mismo rubro cierra el anterior', () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: /Casa/ }));
    fireEvent.click(screen.getByRole('button', { name: /Depto/ }));

    expect(screen.getByRole('button', { name: /Casa/ })).toHaveAttribute('aria-expanded', 'false');
    expect(abiertoDe(5)).toBe('p2');
  });

  it('cada rubro conserva el suyo', () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: /Casa/ }));
    fireEvent.click(screen.getByRole('button', { name: /Oficina/ }));

    expect(abiertoDe(5)).toBe('p1');
    expect(abiertoDe(1)).toBe('l1');
  });

  it('volver a tocar el abierto lo cierra', () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: /Casa/ }));
    fireEvent.click(screen.getByRole('button', { name: /Casa/ }));

    expect(abiertoDe(5)).toBeNull();
  });

  it('un rubro sin Quodoms lo dice, y sigue estando', () => {
    montar();

    expect(screen.getByText(/ningún quodom en armado/i)).toBeInTheDocument();
  });

  // Review Focus 4: un rubro dado de baja que todavía tiene un Quodom abierto.
  it('no muestra un rubro que no está disponible', () => {
    montar([...RAMAS, { idrubro: 4, nombre: 'CONSTRUCCIÓN', quodoms: [q('c1', 'Obra', 4)] }]);

    expect(screen.queryByRole('button', { name: /CONSTRUCCIÓN/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Obra/ })).toBeNull();
  });

  it('el rubro del Quodom abierto arranca desplegado', () => {
    abrirQuodom(1, 'l1');
    montar();

    expect(screen.getByRole('button', { name: /Oficina/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correrlos y verlos fallar**

Run: `cd quodom-web/app && npx vitest run src/components/layout/__tests__/ArbolQuodoms.test.tsx`
Expected: FAIL — el componente no existe.

- [ ] **Step 3: Implementar**

Create `quodom-web/app/src/components/layout/ArbolQuodoms.tsx`:

```tsx
import { useState, type ReactNode } from 'react';
import type { Quodom } from '../../api/types';
import { abiertoDe, abrirQuodom, cerrarQuodom } from '../../quodom/quodomAbierto';
import { rubroDisponible } from '../../quodom/rubrosDisponibles';
import './ArbolQuodoms.css';

export type RamaRubro = { idrubro: number; nombre: string; quodoms: Quodom[] };

/**
 * Rubro padre, Quodoms en armado como hijos. El hijo abierto es el que recibe
 * lo que se agrega de ese rubro: desplegado y destino son la misma cosa, por eso
 * un solo clic hace las dos.
 *
 * Lo usan el panel derecho (escritorio) y la barra inferior (celular); nunca
 * están los dos en pantalla.
 */
export function ArbolQuodoms({ ramas, onCambio, renderAbierto }: {
  ramas: RamaRubro[];
  onCambio: () => void;
  renderAbierto?: (q: Quodom) => ReactNode;
}) {
  const visibles = ramas.filter(r => rubroDisponible(r.idrubro));
  // Un rubro arranca desplegado si tiene algo abierto: es donde el usuario estaba.
  const [plegados, setPlegados] = useState<Record<number, boolean>>(() => {
    const inicial: Record<number, boolean> = {};
    for (const r of visibles) inicial[r.idrubro] = !abiertoDe(r.idrubro);
    return inicial;
  });

  function alternarRubro(idrubro: number) {
    setPlegados(p => ({ ...p, [idrubro]: !p[idrubro] }));
  }

  function alternarQuodom(idrubro: number, idquodom: string) {
    if (abiertoDe(idrubro) === idquodom) cerrarQuodom(idrubro);
    else abrirQuodom(idrubro, idquodom);
    onCambio();
  }

  return (
    <div className="arbol">
      {visibles.map(rama => {
        const desplegado = !plegados[rama.idrubro];
        const abierto = abiertoDe(rama.idrubro);
        return (
          <section key={rama.idrubro} className={'arbol-rama' + (desplegado ? ' arbol-rama-abierta' : '')}>
            <button
              type="button"
              className="arbol-rubro"
              aria-expanded={desplegado}
              onClick={() => alternarRubro(rama.idrubro)}
            >
              <span className="arbol-flecha" aria-hidden="true">▶</span>
              <span>{rama.nombre}</span>
              <span className="arbol-cuenta">{rama.quodoms.length || '—'}</span>
            </button>

            {desplegado && rama.quodoms.length === 0 && (
              <p className="arbol-vacio">Ningún Quodom en armado.</p>
            )}

            {desplegado && rama.quodoms.length > 0 && (
              <ul className="arbol-hijos">
                {rama.quodoms.map(q => (
                  <li key={q.id} className="arbol-hijo">
                    <button
                      type="button"
                      className="arbol-quodom"
                      data-destino={q.id}
                      data-rubro={rama.idrubro}
                      aria-expanded={abierto === q.id}
                      onClick={() => alternarQuodom(rama.idrubro, q.id)}
                    >
                      <span className="arbol-punto" aria-hidden="true" />
                      <span className="arbol-nombre">{q.descripcion || q.nro}</span>
                      <span className="arbol-n">{q.cantproductos ?? 0} prod.</span>
                    </button>
                    {abierto === q.id && renderAbierto && renderAbierto(q)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
```

Create `quodom-web/app/src/components/layout/ArbolQuodoms.css` siguiendo la paleta de panel
oscuro (`--color-panel-oscuro`) y la forma de hoja, con `.arbol-quodom[aria-expanded="true"]`
marcado en `--color-exito`.

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `cd quodom-web/app && npx vitest run src/components/layout/__tests__/ArbolQuodoms.test.tsx`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add quodom-web/app/src/components/layout/ArbolQuodoms.tsx quodom-web/app/src/components/layout/ArbolQuodoms.css quodom-web/app/src/components/layout/__tests__/ArbolQuodoms.test.tsx
git commit -m "feat(app): add the rubro/quodom tree"
```

---

## Task 6: El panel derecho usa el árbol

**Files:**
- Modify: `quodom-web/app/src/components/layout/MisQuodomsSidebar.tsx`
- Modify: `quodom-web/app/src/components/layout/MisQuodomsSidebar.css`
- Modify: `quodom-web/app/src/screens/MisQuodoms/ListaMisQuodoms.tsx`
- Test: `quodom-web/app/src/components/layout/__tests__/MisQuodomsSidebar.test.tsx`, `src/screens/MisQuodoms/__tests__/ListaMisQuodoms.test.tsx`

**Interfaces:**
- Consumes: `ArbolQuodoms`, `RamaRubro` (Task 5); `sanearAbiertos` (Task 4).
- Produces: el panel agrupa `misQuodom()` en ramas y las pasa al árbol. "Repetí un pedido" ya no vive acá.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `MisQuodomsSidebar.test.tsx`:

```tsx
describe('sidebar: el árbol', () => {
  it('agrupa los Quodoms por rubro', async () => {
    misQuodom.mockResolvedValue([
      { id: 'p1', descripcion: 'Casa', estado: 'CREADO', nro: 'QD-1', idrubro: 5, nombrerubro: 'Pinturería', cantproductos: 2, porccompletado: 100 },
      { id: 'p2', descripcion: 'Depto', estado: 'CREADO', nro: 'QD-2', idrubro: 5, nombrerubro: 'Pinturería', cantproductos: 1, porccompletado: 100 },
      { id: 'l1', descripcion: 'Oficina', estado: 'CREADO', nro: 'QD-3', idrubro: 1, nombrerubro: 'Limpieza', cantproductos: 3, porccompletado: 100 }
    ]);

    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    expect(await screen.findByRole('button', { name: /Casa/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Depto/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Oficina/ })).toBeInTheDocument();
  });

  it('no muestra los enviados: ésos viven en Mis Quodoms', async () => {
    misQuodom.mockResolvedValue([
      { id: 'p1', descripcion: 'Casa', estado: 'CREADO', nro: 'QD-1', idrubro: 5, cantproductos: 2, porccompletado: 100 },
      { id: 'p9', descripcion: 'Frente', estado: 'ENVIADO', nro: 'QD-9', idrubro: 5, cantproductos: 2, porccompletado: 100, fechaenvio: new Date().toISOString() }
    ]);

    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByRole('button', { name: /Casa/ });

    expect(screen.queryByText(/Frente/)).toBeNull();
  });

  it('ofrece el botón Mis Quodoms', async () => {
    misQuodom.mockResolvedValue([]);

    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    expect(await screen.findByRole('link', { name: /mis quodoms/i })).toHaveAttribute('href', '/mis-quodoms');
  });

  it('ya no muestra Repetí un pedido', async () => {
    misQuodom.mockResolvedValue([
      { id: 'p9', descripcion: 'Frente', estado: 'ENVIADO', nro: 'QD-9', idrubro: 5, cantproductos: 2, porccompletado: 100, fechaenvio: new Date().toISOString() }
    ]);

    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByRole('link', { name: /mis quodoms/i });

    expect(screen.queryByText(/repetí un pedido/i)).toBeNull();
  });
});
```

Agregar a `ListaMisQuodoms.test.tsx`:

```tsx
it('muestra Repetí un pedido con los últimos enviados', async () => {
  misQuodom.mockResolvedValue([
    { id: 'p9', descripcion: 'Frente', estado: 'ENVIADO', nro: 'QD-9', idrubro: 5, cantproductos: 2, porccompletado: 100, fechaenvio: new Date(Date.now() - 60 * 60 * 1000).toISOString() }
  ]);

  render(<MemoryRouter><ListaMisQuodoms /></MemoryRouter>);

  expect(await screen.findByText(/repetí un pedido/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Correrlos y verlos fallar**

Run: `cd quodom-web/app && npx vitest run src/components/layout/__tests__/MisQuodomsSidebar.test.tsx src/screens/MisQuodoms/__tests__/ListaMisQuodoms.test.tsx`
Expected: FAIL — el sidebar sigue con la lista plana y con "Repetí un pedido".

- [ ] **Step 3: Implementar**

En `MisQuodomsSidebar.tsx`:
- Agrupar la respuesta de `quodomApi.misQuodom()` en `RamaRubro[]`, filtrando `estado === 'CREADO'`,
  usando `nombreRubro(idrubro)` cuando `nombrerubro` venga nulo, y ordenando las ramas por `idrubro`.
- Llamar `sanearAbiertos(creados.map(q => q.id))` después de cada carga.
- Renderizar `<ArbolQuodoms ramas={ramas} onCambio={refresh} renderAbierto={q => <LineasQuodomSidebar modo="servidor" idquodom={q.id} onChange={refresh} />} />`.
- Borrar la sección "Repetí un pedido", `repetirQuodom`, `conflictoRepetir` y el "Ver todos",
  y poner en su lugar `<Link to="/mis-quodoms" className="btn btn-block">Mis Quodoms</Link>`.

En `ListaMisQuodoms.tsx`, agregar la sección "Repetí un pedido" con los últimos 5 `ENVIADO`
y su botón, movida tal cual desde el sidebar.

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `cd quodom-web/app && npx vitest run src/components/layout src/screens/MisQuodoms`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add quodom-web/app/src/components/layout quodom-web/app/src/screens/MisQuodoms
git commit -m "feat(app): show the quodom tree in the sidebar and move repeat to Mis Quodoms"
```

---

## Task 7: La barra inferior usa el mismo árbol

**Files:**
- Modify: `quodom-web/app/src/components/layout/BarraQuodomInferior.tsx`
- Modify: `quodom-web/app/src/components/layout/BarraQuodomInferior.css`
- Test: `quodom-web/app/src/components/layout/__tests__/BarraQuodomInferior.test.tsx`

**Interfaces:**
- Consumes: `ArbolQuodoms` (Task 5), `leerAbiertos` (Task 4).
- Produces: nada nuevo.

- [ ] **Step 1: Escribir los tests que fallan**

```tsx
it('dice a qué Quodom está sumando cada rubro', async () => {
  abrirQuodom(5, 'p1');
  misQuodom.mockResolvedValue([
    { id: 'p1', descripcion: 'Casa', estado: 'CREADO', nro: 'QD-1', idrubro: 5, nombrerubro: 'Pinturería', cantproductos: 2, porccompletado: 100 }
  ]);

  render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);

  expect(await screen.findByText(/sumando a/i)).toBeInTheDocument();
  expect(screen.getByText(/Casa/)).toBeInTheDocument();
});

it('al desplegarla aparece el mismo árbol', async () => {
  misQuodom.mockResolvedValue([
    { id: 'p1', descripcion: 'Casa', estado: 'CREADO', nro: 'QD-1', idrubro: 5, nombrerubro: 'Pinturería', cantproductos: 2, porccompletado: 100 }
  ]);

  render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: /sumando a/i }));

  expect(screen.getByRole('button', { name: /Casa/ })).toBeInTheDocument();
});

it('sin nada abierto lo dice en vez de mentir', async () => {
  misQuodom.mockResolvedValue([
    { id: 'p1', descripcion: 'Casa', estado: 'CREADO', nro: 'QD-1', idrubro: 5, cantproductos: 2, porccompletado: 100 }
  ]);

  render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);

  expect(await screen.findByText(/ningún quodom abierto/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Correrlos y verlos fallar**

Run: `cd quodom-web/app && npx vitest run src/components/layout/__tests__/BarraQuodomInferior.test.tsx`
Expected: FAIL — la barra sigue listando con `PanelQuodomsActivos`.

- [ ] **Step 3: Implementar**

Primero extraer el agrupador, para que el panel y la barra no repitan la regla.
Create `quodom-web/app/src/quodom/ramas.ts`:

```ts
import type { Quodom } from '../api/types';
import { nombreRubro } from './rubros';
import type { RamaRubro } from '../components/layout/ArbolQuodoms';

/**
 * De la lista plana de `GET /quodom/misQuodom` a las ramas del árbol: un rubro
 * por rama, y adentro sólo los que están en armado. Los ENVIADO viven en Mis
 * Quodoms, no acá.
 *
 * `nombrerubro` puede venir nulo (la vista lo resuelve por subconsulta), así que
 * el nombre se completa con la tabla local de rubros.
 */
export function ramasDeQuodoms(lista: Quodom[]): RamaRubro[] {
  const porRubro = new Map<number, RamaRubro>();
  for (const q of lista) {
    if (q.estado !== 'CREADO') continue;
    let rama = porRubro.get(q.idrubro);
    if (!rama) {
      rama = { idrubro: q.idrubro, nombre: q.nombrerubro || nombreRubro(q.idrubro), quodoms: [] };
      porRubro.set(q.idrubro, rama);
    }
    rama.quodoms.push(q);
  }
  return [...porRubro.values()].sort((a, b) => a.idrubro - b.idrubro);
}
```

Su test, en `quodom-web/app/src/quodom/__tests__/ramas.test.ts`:

```ts
it('agrupa por rubro y deja afuera los enviados', () => {
  const ramas = ramasDeQuodoms([
    { id: 'p1', idrubro: 5, estado: 'CREADO', descripcion: 'Casa', nombrerubro: 'Pinturería' },
    { id: 'p9', idrubro: 5, estado: 'ENVIADO', descripcion: 'Frente', nombrerubro: 'Pinturería' },
    { id: 'l1', idrubro: 1, estado: 'CREADO', descripcion: 'Oficina', nombrerubro: null }
  ] as unknown as Quodom[]);

  expect(ramas).toHaveLength(2);
  expect(ramas[0].idrubro).toBe(1);
  expect(ramas[0].nombre).toBe('Limpieza');
  expect(ramas[1].quodoms.map(q => q.id)).toEqual(['p1']);
});
```

Después, en `BarraQuodomInferior.tsx` y en `MisQuodomsSidebar.tsx`, usar `ramasDeQuodoms`
en lugar del agrupado a mano. En la barra, reemplazar el contenido desplegable por
`<ArbolQuodoms ramas={ramas} onCambio={refresh} />` y la línea cerrada por
`Sumando a: <RUBRO> · <descripción>` por cada rubro con algo abierto, o
`Ningún Quodom abierto` cuando el mapa está vacío.

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `cd quodom-web/app && npx vitest run src/components/layout`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add quodom-web/app/src/components/layout quodom-web/app/src/quodom/ramas.ts
git commit -m "feat(app): show the same tree in the bottom bar"
```

---

## Task 8: El `+` va al Quodom abierto

**Files:**
- Modify: `quodom-web/app/src/quodom/agregarProducto.ts`
- Modify: `quodom-web/app/src/quodom/useAgregarProducto.ts`
- Create: `quodom-web/app/src/quodom/DialogoDestino.tsx`
- Create: `quodom-web/app/src/quodom/DialogoDestino.css`
- Test: `quodom-web/app/src/quodom/__tests__/agregarProducto.test.ts`, `__tests__/DialogoDestino.test.tsx`

**Interfaces:**
- Consumes: `abiertoDe`, `abrirQuodom` (Task 4); `quodom.activosPorRubro` (Task 3).
- Produces:
```ts
export type AgregarResult =
  | { estado: 'agregado'; idquodom: string | null }
  | { estado: 'elegir_destino'; idrubro: number; candidatos: Quodom[] };
export async function agregarProducto(line: GuestLine, opts: { logueado: boolean; idrubro: number }): Promise<AgregarResult>;
export async function agregarADestino(line: GuestLine, idrubro: number, idquodom: string): Promise<void>;
export async function crearYAgregar(line: GuestLine, idrubro: number, descripcion: string): Promise<string>;
```

- [ ] **Step 1: Escribir los tests que fallan**

```ts
describe('agregarProducto con un Quodom abierto', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

  it('agrega al abierto del rubro, sin preguntar', async () => {
    abrirQuodom(5, 'q-casa');
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 1 });

    const res = await agregarProducto(LINEA, { logueado: true, idrubro: 5 });

    expect(res.estado).toBe('agregado');
    expect(quodomLines.add).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'q-casa' }));
    expect(quodomApi.activosPorRubro).not.toHaveBeenCalled();
  });

  it('pide elegir cuando el rubro no tiene ninguno abierto', async () => {
    vi.mocked(quodomApi.activosPorRubro).mockResolvedValue([QUODOM_CASA, QUODOM_DEPTO]);

    const res = await agregarProducto(LINEA, { logueado: true, idrubro: 5 });

    expect(res).toEqual({ estado: 'elegir_destino', idrubro: 5, candidatos: [QUODOM_CASA, QUODOM_DEPTO] });
    expect(quodomLines.add).not.toHaveBeenCalled();
  });

  // Review Focus 1: el abierto apunta a un Quodom que ya no existe.
  it('pide elegir si el abierto ya no está entre los activos', async () => {
    abrirQuodom(5, 'q-borrado');
    vi.mocked(quodomApi.activosPorRubro).mockResolvedValue([QUODOM_CASA]);
    vi.mocked(quodomLines.add).mockRejectedValue(new ApiError('Err. Quodom no encontrado.', 400));

    const res = await agregarProducto(LINEA, { logueado: true, idrubro: 5 });

    expect(res.estado).toBe('elegir_destino');
  });

  it('agregar a un destino lo deja abierto', async () => {
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 1 });

    await agregarADestino(LINEA, 5, 'q-depto');

    expect(abiertoDe(5)).toBe('q-depto');
  });

  it('crear y agregar deja abierto el nuevo', async () => {
    vi.mocked(quodomApi.create).mockResolvedValue({ res: true, idquodom: 'q-nuevo' });
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 1 });

    const id = await crearYAgregar(LINEA, 5, 'Mi Quodom');

    expect(id).toBe('q-nuevo');
    expect(abiertoDe(5)).toBe('q-nuevo');
  });

  // Review Focus 5: dos `+` seguidos sin esperar al primero.
  it('dos agregados seguidos van los dos al mismo abierto', async () => {
    abrirQuodom(5, 'q-casa');
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 1 });

    await Promise.all([
      agregarProducto(LINEA, { logueado: true, idrubro: 5 }),
      agregarProducto(LINEA, { logueado: true, idrubro: 5 })
    ]);

    const destinos = vi.mocked(quodomLines.add).mock.calls.map(c => c[0].idquodom);
    expect(destinos).toEqual(['q-casa', 'q-casa']);
  });

  it('el invitado sigue teniendo un carrito por rubro y no elige nada', async () => {
    const res = await agregarProducto(LINEA, { logueado: false, idrubro: 5 });

    expect(res).toEqual({ estado: 'agregado', idquodom: null });
    expect(guestLineCount(5)).toBe(1);
  });
});
```

- [ ] **Step 2: Correrlos y verlos fallar**

Run: `cd quodom-web/app && npx vitest run src/quodom/__tests__/agregarProducto.test.ts`
Expected: FAIL — hoy `agregarProducto` llama a `activoPorRubro` y devuelve `necesita_confirmacion`.

- [ ] **Step 3: Implementar**

Reescribir `agregarProducto.ts`:

```ts
export async function agregarProducto(line: GuestLine, opts: Opts): Promise<AgregarResult> {
  if (!opts.logueado) {
    addGuestLine(opts.idrubro, line);
    notificarCambio();
    return { estado: 'agregado', idquodom: null };
  }

  const abierto = abiertoDe(opts.idrubro);
  if (abierto) {
    try {
      await agregarAlServidor(abierto, line);
      notificarCambio();
      return { estado: 'agregado', idquodom: abierto };
    } catch {
      // El abierto ya no existe (borrado o enviado en otra pestaña). Se cae al
      // camino de elegir, que es el mismo que si nunca hubiera habido uno.
      cerrarQuodom(opts.idrubro);
    }
  }

  const candidatos = await quodomApi.activosPorRubro(opts.idrubro);
  return { estado: 'elegir_destino', idrubro: opts.idrubro, candidatos };
}

export async function agregarADestino(line: GuestLine, idrubro: number, idquodom: string): Promise<void> {
  await agregarAlServidor(idquodom, line);
  abrirQuodom(idrubro, idquodom);
  notificarCambio();
}

export async function crearYAgregar(line: GuestLine, idrubro: number, descripcion: string): Promise<string> {
  const creado = await quodomApi.create({ descripcion, idrubro });
  await agregarAlServidor(creado.idquodom, line);
  abrirQuodom(idrubro, creado.idquodom);
  notificarCambio();
  return creado.idquodom;
}
```

`DialogoDestino.tsx` muestra `candidatos` (nombre + cantidad) más "Un Quodom nuevo de
&lt;rubro&gt;", y llama a `agregarADestino` o `crearYAgregar`. `useAgregarProducto` expone
`destino: { line, idrubro, candidatos } | null` en lugar de `pendiente`.

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `cd quodom-web/app && npx vitest run src/quodom`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add quodom-web/app/src/quodom
git commit -m "feat(app): route the plus button to the open quodom of the rubro"
```

---

## Task 9: El `···` de cada producto

**Files:**
- Modify: `quodom-web/app/src/screens/Home/ListaProductos.tsx`
- Modify: `quodom-web/app/src/screens/Home/ListaProductos.css`
- Test: `quodom-web/app/src/screens/Home/__tests__/ListaProductos.test.tsx`

**Interfaces:**
- Consumes: `useAgregarProducto` con `destino` (Task 8).
- Produces: nada nuevo.

- [ ] **Step 1: Escribir los tests que fallan**

```tsx
it('cada producto ofrece mandarlo a otro Quodom', async () => {
  montar();

  expect(await screen.findAllByRole('button', { name: /a otro quodom/i })).not.toHaveLength(0);
});

it('el ··· abre la lista de destinos del rubro sin agregar nada', async () => {
  vi.mocked(quodomApi.activosPorRubro).mockResolvedValue([QUODOM_CASA, QUODOM_DEPTO]);
  montar();

  fireEvent.click((await screen.findAllByRole('button', { name: /a otro quodom/i }))[0]);

  expect(await screen.findByRole('dialog')).toHaveTextContent(/Casa/);
  expect(quodomLines.add).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Correrlos y verlos fallar**

Run: `cd quodom-web/app && npx vitest run src/screens/Home/__tests__/ListaProductos.test.tsx`
Expected: FAIL — el botón no existe.

- [ ] **Step 3: Implementar**

Agregar a la tarjeta, al lado del `+`, un botón `···` con
`aria-label={'Agregar ' + nombre + ' a otro Quodom'}` que llame a un `elegirDestino(line, idrubro)`
nuevo del hook: hace `quodomApi.activosPorRubro(idrubro)` y abre `DialogoDestino` sin agregar nada.

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `cd quodom-web/app && npx vitest run src/screens/Home`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add quodom-web/app/src/screens/Home quodom-web/app/src/quodom
git commit -m "feat(app): let a product go to a quodom other than the open one"
```

---

## Task 10: Arrastrar y soltar

**Files:**
- Create: `quodom-web/app/src/quodom/arrastre.ts`
- Modify: `quodom-web/app/src/components/layout/ArbolQuodoms.tsx` (zonas de soltado)
- Modify: `quodom-web/app/src/screens/Home/ListaProductos.tsx` (agarre)
- Test: `quodom-web/app/src/quodom/__tests__/arrastre.test.ts`

**Interfaces:**
- Consumes: `agregarADestino`, `crearYAgregar` (Task 8).
- Produces:
```ts
export type Blanco = { tipo: 'quodom'; idquodom: string; idrubro: number } | { tipo: 'nuevo'; idrubro: number };
export function blancoBajo(x: number, y: number): Blanco | null;
export function iniciarArrastre(ev: PointerEvent, opts: {
  idrubro: number; nombre: string; nombreRubro: string;
  onSoltar: (blanco: Blanco) => void;
}): void;
```

- [ ] **Step 1: Escribir los tests que fallan**

```ts
describe('blancoBajo', () => {
  it('reconoce un Quodom del árbol', () => {
    document.body.innerHTML = '<button data-destino="q-1" data-rubro="5"></button>';
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.querySelector('button'));

    expect(blancoBajo(10, 10)).toEqual({ tipo: 'quodom', idquodom: 'q-1', idrubro: 5 });
  });

  it('reconoce la zona de Quodom nuevo', () => {
    document.body.innerHTML = '<button data-nuevo="5" data-rubro="5"></button>';
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.querySelector('button'));

    expect(blancoBajo(10, 10)).toEqual({ tipo: 'nuevo', idrubro: 5 });
  });

  // Review Focus 3: soltar en el vacío.
  it('devuelve null fuera de cualquier destino', () => {
    document.body.innerHTML = '<div id="nada"></div>';
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.getElementById('nada'));

    expect(blancoBajo(10, 10)).toBeNull();
  });

  it('devuelve null cuando no hay nada bajo el puntero', () => {
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(null);

    expect(blancoBajo(10, 10)).toBeNull();
  });
});

describe('iniciarArrastre', () => {
  it('no hace nada si el puntero no se movió lo suficiente', () => {
    const onSoltar = vi.fn();
    iniciarArrastre(evento(100, 100), { idrubro: 5, nombre: 'Látex', nombreRubro: 'PINTURERÍA', onSoltar });

    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 102, clientY: 101 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 102, clientY: 101 }));

    expect(onSoltar).not.toHaveBeenCalled();
    expect(document.querySelector('.arrastre-fantasma')).toBeNull();
  });

  it('levanta el fantasma al pasar el umbral y lo saca al soltar', () => {
    iniciarArrastre(evento(100, 100), { idrubro: 5, nombre: 'Látex', nombreRubro: 'PINTURERÍA', onSoltar: vi.fn() });

    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 140, clientY: 160 }));
    expect(document.querySelector('.arrastre-fantasma')).not.toBeNull();

    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 140, clientY: 160 }));
    expect(document.querySelector('.arrastre-fantasma')).toBeNull();
  });
});
```

- [ ] **Step 2: Correrlos y verlos fallar**

Run: `cd quodom-web/app && npx vitest run src/quodom/__tests__/arrastre.test.ts`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar**

Create `quodom-web/app/src/quodom/arrastre.ts`:

```ts
export type Blanco =
  | { tipo: 'quodom'; idquodom: string; idrubro: number }
  | { tipo: 'nuevo'; idrubro: number };

const UMBRAL = 6;

/**
 * Qué destino del árbol hay bajo el puntero, si hay alguno.
 *
 * Se resuelve por hit-test y no por eventos de los destinos, porque el elemento
 * que sigue al cursor tiene `pointer-events: none` y nunca los recibiría.
 */
export function blancoBajo(x: number, y: number): Blanco | null {
  const el = document.elementFromPoint(x, y);
  const destino = el?.closest<HTMLElement>('[data-destino], [data-nuevo]');
  if (!destino) return null;
  const idrubro = Number(destino.getAttribute('data-rubro'));
  if (!Number.isInteger(idrubro)) return null;
  const nuevo = destino.getAttribute('data-nuevo');
  if (nuevo !== null) return { tipo: 'nuevo', idrubro };
  return { tipo: 'quodom', idquodom: destino.getAttribute('data-destino')!, idrubro };
}

/**
 * Arrastre con eventos de puntero, no con el de HTML: `dragstart` congela una
 * imagen de la tarjeta al empezar y no deja animarla después, así que el efecto
 * de achicarse al entrar en el destino es imposible con esa API.
 */
export function iniciarArrastre(ev: PointerEvent, opts: {
  idrubro: number;
  nombre: string;
  nombreRubro: string;
  onSoltar: (blanco: Blanco) => void;
}): void {
  if (ev.button !== 0) return;
  const x0 = ev.clientX;
  const y0 = ev.clientY;
  let vivo = false;
  let fantasma: HTMLDivElement | null = null;
  let interior: HTMLDivElement | null = null;

  function limpiarResaltados() {
    document.querySelectorAll('.arrastre-encima, .arrastre-rechaza')
      .forEach(e => e.classList.remove('arrastre-encima', 'arrastre-rechaza'));
  }

  function levantar() {
    vivo = true;
    document.body.classList.add('arrastrando');
    fantasma = document.createElement('div');
    fantasma.className = 'arrastre-fantasma';
    interior = document.createElement('div');
    interior.className = 'arrastre-interior';
    const rubro = document.createElement('span');
    rubro.className = 'arrastre-rubro';
    rubro.textContent = opts.nombreRubro;
    const nombre = document.createElement('span');
    nombre.textContent = opts.nombre;
    interior.append(rubro, nombre);
    fantasma.appendChild(interior);
    document.body.appendChild(fantasma);
  }

  function mover(e: PointerEvent) {
    if (!vivo) {
      if (Math.abs(e.clientX - x0) < UMBRAL && Math.abs(e.clientY - y0) < UMBRAL) return;
      levantar();
    }
    fantasma!.style.left = e.clientX + 'px';
    fantasma!.style.top = e.clientY + 'px';

    limpiarResaltados();
    interior!.classList.remove('entrando');
    const blanco = blancoBajo(e.clientX, e.clientY);
    if (!blanco) return;
    const destino = document.elementFromPoint(e.clientX, e.clientY)!
      .closest<HTMLElement>('[data-destino], [data-nuevo]')!;
    if (blanco.idrubro === opts.idrubro) {
      destino.classList.add('arrastre-encima');
      interior!.classList.add('entrando');
    } else {
      destino.classList.add('arrastre-rechaza');
    }
  }

  function terminar(e: PointerEvent) {
    window.removeEventListener('pointermove', mover);
    window.removeEventListener('pointerup', terminar);
    window.removeEventListener('pointercancel', terminar);
    if (!vivo) return;
    document.body.classList.remove('arrastrando');
    fantasma?.remove();
    limpiarResaltados();
    const blanco = blancoBajo(e.clientX, e.clientY);
    // Soltar en el vacío, o sobre un Quodom de otro rubro, no hace nada y no es
    // un error: el usuario ya vio el borde rojo mientras arrastraba.
    if (blanco && blanco.idrubro === opts.idrubro) opts.onSoltar(blanco);
  }

  window.addEventListener('pointermove', mover);
  window.addEventListener('pointerup', terminar);
  window.addEventListener('pointercancel', terminar);
}
```

El CSS va en `ArbolQuodoms.css` (los resaltados) y en `ListaProductos.css` (el fantasma).
El contenedor `.arrastre-fantasma` se mueve con `left`/`top` **sin** transición, para no
quedar atrás del cursor; el `.arrastre-interior` es el que lleva
`transition: transform .14s` y baja a `transform: translate(-50%, -50%) scale(.52)` con la
clase `entrando`. `.arrastre-fantasma` va con `position: fixed; pointer-events: none; z-index: 60`.

En `ArbolQuodoms.tsx`, cada `.arbol-quodom` ya lleva `data-destino` y `data-rubro`. Agregar,
mientras hay algo en la mano, un hijo más por rubro con `data-nuevo={idrubro}` y
`data-rubro={idrubro}`, rotulado "Soltar en un Quodom nuevo".

En `ListaProductos.tsx`, enganchar `pointerdown` en la tarjeta —ignorando los clics que
nacen dentro de un `<button>`— y resolver el soltado con `agregarADestino` o `crearYAgregar`.

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `cd quodom-web/app && npx vitest run src/quodom src/screens/Home`
Expected: PASS.

- [ ] **Step 5: Recorrido visual en el navegador**

Levantar `npm run dev` en `api/` y en `app/`, y comprobar a mano, que es lo único que valida
esto: arrastrar sobre un Quodom del mismo rubro entra y lo abre; sobre uno de otro rubro se
marca en rojo y no entra; sobre "Quodom nuevo" lo crea; soltar en el vacío no hace nada.

- [ ] **Step 6: Commit**

```bash
git add quodom-web/app/src/quodom quodom-web/app/src/components/layout quodom-web/app/src/screens/Home
git commit -m "feat(app): drag a product onto any quodom in the tree"
```

---

## Task 11: Borrar lo que quedó sin razón de existir

**Files:**
- Delete: `quodom-web/app/src/guest/DialogoConflictoRubro.tsx`, `.css`, `__tests__/DialogoConflictoRubro.test.tsx`
- Delete: `quodom-web/app/src/quodom/DialogoNuevoRubro.tsx`, `.css`, `__tests__/DialogoNuevoRubro.test.tsx`
- Modify: `quodom-web/app/src/guest/migrateGuestQuodom.ts`
- Modify: `quodom-web/app/src/screens/Auth/SignIn.tsx`, `screens/Home/SitioInicial.tsx`, `screens/Home/BusquedaScreen.tsx`, `screens/ListaIA/GrupoRubro.tsx`, `screens/ModoIA/PanelConversacion.tsx`, `screens/Quodom/DetalleQuodom.tsx`
- Test: `quodom-web/app/tests/migrateGuestQuodom.test.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `migrarRubro(idrubro)` sin el parámetro `accion`; `ConflictoRubro` deja de existir.

- [ ] **Step 1: Escribir el test que falla**

```ts
it('migra el carrito a un Quodom nuevo aunque el rubro ya tenga uno abierto', async () => {
  addGuestLine(7, { idproducto: 700, nombreProducto: 'Gaseosa', cantidad: 1 });
  vi.mocked(quodom.create).mockResolvedValue({ res: true, idquodom: 'q-nuevo' });
  vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 1 });

  const id = await migrarRubro(7);

  expect(id).toBe('q-nuevo');
  expect(quodom.activosPorRubro).not.toHaveBeenCalled();
  expect(getGuestCart(7).lines).toHaveLength(0);
});
```

- [ ] **Step 2: Correrlo y verlo fallar**

Run: `cd quodom-web/app && npx vitest run tests/migrateGuestQuodom.test.ts`
Expected: FAIL — `migrarRubro` todavía pide una `accion`.

- [ ] **Step 3: Borrar e implementar**

```bash
cd quodom-web/app
rm src/guest/DialogoConflictoRubro.tsx src/guest/DialogoConflictoRubro.css src/guest/__tests__/DialogoConflictoRubro.test.tsx
rm src/quodom/DialogoNuevoRubro.tsx src/quodom/DialogoNuevoRubro.css src/quodom/__tests__/DialogoNuevoRubro.test.tsx
```

Simplificar `migrateGuestQuodom.ts`: sacar `AccionRubro`, `ConflictoRubro` y la consulta
previa; `migrarRubro(idrubro)` crea siempre un Quodom nuevo y vuelca las líneas, limpiando
el carrito **sólo después** de que todas estén confirmadas en el servidor.

En los seis archivos que los importaban, borrar el import y el render del diálogo, y el
estado que lo manejaba.

- [ ] **Step 4: Correr toda la suite de la app y el typecheck**

```bash
cd quodom-web/app && npx vitest run && npm run typecheck
```
Expected: PASS y typecheck limpio.

- [ ] **Step 5: Commit**

```bash
git add -A quodom-web/app/src quodom-web/app/tests
git commit -m "refactor(app): drop the rubro-conflict dialogs the one-per-rubro rule needed"
```

---

## Task 12: Documentación

**Files:**
- Modify: `CLAUDE.md` (§3)
- Modify: `quodom-web/api/CLAUDE.md`
- Modify: `quodom-web/app/CLAUDE.md`

**Interfaces:**
- Consumes: todo.
- Produces: nada de código.

- [ ] **Step 1: Actualizar la raíz**

En `CLAUDE.md` §3, reemplazar la regla "**Como máximo un Quodom abierto por usuario y rubro**"
por la nueva: varios por rubro; el abierto de cada rubro es el que recibe; vive en
`localStorage` y no en el contrato; `rubro_mismatch` se queda y `rubro_duplicado` ya no existe.
Actualizar la viñeta del sidebar: árbol de rubros, sólo `CREADO`, y "Repetí un pedido" en
Mis Quodoms. Apuntar al spec nuevo y marcar el de 2026-08-18 como reemplazado.

- [ ] **Step 2: Actualizar los dos de abajo**

En `api/CLAUDE.md`: el comando `npm run migrar-multi-quodom` con su porqué (el `ALTER` que
`sync()` no hace), y `/quodom/activos/:idrubro` en la lista de rutas.

En `app/CLAUDE.md`: `src/quodom/quodomAbierto.ts`, `ArbolQuodoms` compartido entre panel y
barra, y `src/quodom/arrastre.ts` con la nota de por qué no se usa el arrastre nativo.

- [ ] **Step 3: Verificar que no quedó nada viejo**

```bash
cd "F:/backup/Command Soluciones/Quodom/Quodom"
grep -rn "rubro_duplicado\|un Quodom abierto por\|activoPorRubro" CLAUDE.md quodom-web/*/CLAUDE.md docs/superpowers/specs/2026-10-14-*.md
```
Expected: sólo las menciones que explican que la regla **ya no existe**.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md quodom-web/api/CLAUDE.md quodom-web/app/CLAUDE.md
git commit -m "docs: record the multi-quodom rule and the tree"
```
