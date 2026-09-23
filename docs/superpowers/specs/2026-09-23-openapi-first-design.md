# OpenAPI first — Design Spec

**Fecha:** 2026-09-23
**Estado:** Aprobado en conversación; pendiente revisión del documento

## 1. Objetivo

Hoy las 56 direcciones del API no están descritas en ningún lado: qué recibe
y qué devuelve cada una vive sólo en el código, y la app tiene escrita a mano
una copia (`app/src/api/types.ts`) que nadie obliga a mantener igual.

Este diseño pone un archivo, `api/openapi.yaml`, como **única fuente de
verdad** del contrato entre la app y el API, y lo usa para dos cosas a la vez:

- **Documentación:** una página navegable donde se ven y se prueban todas las
  direcciones. **Sólo en desarrollo**, nunca desplegada: no se publica el mapa
  del servidor.
- **Control:** el API rechaza lo que no cumple el archivo, los tests fallan si
  el código y el archivo dicen cosas distintas, y la app no compila si usa una
  forma de dato que el archivo no declara.

**Regla de trabajo desde que esto se implementa:** todo cambio de API empieza
por `openapi.yaml`, y después va el código.

## 2. Enfoque elegido

El archivo se escribe a mano y el servidor lo usa como guardia, sin cambiar la
estructura de `routes/ → controllers/` (que por regla del proyecto espeja a la
API original).

Descartados:
- **Generar el archivo desde el código** (swagger-jsdoc, anotaciones): es lo
  contrario de lo pedido; el archivo sería una foto del código y no la regla.
- **Generar el esqueleto del servidor desde el archivo** (openapi-backend y
  similares): obliga a reorganizar todo el API.

La primera versión del archivo se escribe **describiendo lo que el código hace
hoy**, porque las 56 direcciones ya existen. "Primero el archivo" rige desde
ahí en adelante.

## 3. Piezas

| Pieza | Dónde | Herramienta |
|---|---|---|
| El contrato | `api/openapi.yaml` (OpenAPI 3.1) | escrito a mano |
| Guardia del API | middleware en `api/src/server.js` | `express-openapi-validator` |
| Página de docs | `/docs`, sólo en dev | `swagger-ui-express` |
| Tipos de la app | `app/src/api/schema.d.ts` (generado, commiteado) | `openapi-typescript` |

### 3.1 El contrato

- Un solo archivo, agrupado por `tags` que siguen a los archivos de `routes/`
  (`users`, `quodom`, `quodom_lines`, …). Los esquemas reutilizables (Quodom,
  Línea, Producto, Dirección, el error `{ res: false, message }`) van en
  `components/schemas`.
- Seguridad documentada con dos esquemas: `cookieAuth` (cookie
  `quodom_session`, lo que usa la app) y `bearerAuth` (tests y herramientas).
  El validador **no** hace la autenticación (`validateSecurity: false`): eso
  sigue en `middleware/auth.js`, que es donde están las reglas finas (token
  con `action`, usuario activo, email validado, admin).
- Las rutas de imágenes (`/img/...`) quedan fuera del contrato: devuelven
  archivos, no JSON, y el validador las ignora (`ignorePaths`).

### 3.2 La guardia del API

Se monta **antes** de las rutas. Comportamiento exigido:

1. **Pedidos:** valida parámetros, query y body. Un pedido inválido responde
   `400` con el formato de siempre, `{ res: false, message }`, con un mensaje en
   español que nombra el campo (`Faltan datos o hay datos inválidos: telefono`).
   La app muestra `message` tal cual, así que el formato no puede cambiar.
2. **Campos de más se descartan en silencio** (`removeAdditional: 'all'`).
   Esto **no es opcional**: hoy Joi hace lo mismo (`stripUnknown`) y es lo que
   impide que alguien mande `role: "admin"` al editar su perfil. El test
   `PUT /users strips mass-assignment fields` tiene que seguir pasando sin
   tocarlo.
3. **Respuestas:** se validan **sólo en tests** (`NODE_ENV === 'test'`). En
   producción no, para no convertir un campo inesperado en un 500 para el
   usuario.
4. Una dirección que no está en el archivo responde el mismo `404` de hoy
   (`Route-not-found`).
5. El `error-handler` gana un caso para los errores del validador (traen
   `status` y un array `errors`) que los traduce al formato de arriba.

Los esquemas Joi de `routes/*.js` (`signupSchema`, `updateSchema`, …) y
`middleware/validate-request.js` **se borran** a medida que cada dirección
queda cubierta por el archivo: dos lugares que validan lo mismo son dos
fuentes de verdad.

### 3.3 La página de docs

Se monta sólo si `API_DOCS=true`. Lo pone `nodemon.json` (que es lo que corre
`npm run dev`), así funciona igual en Windows sin herramientas extra. Render no
define la variable, así que en producción `/docs` no existe (cae en el 404).

### 3.4 Los tipos de la app

- `npm run api-types` (en `app/`) lee `../api/openapi.yaml` y escribe
  `app/src/api/schema.d.ts`. El archivo generado se commitea, como las guías
  del asistente, para que un cambio de contrato se vea en el diff.
- `types.ts` deja de declarar formas a mano: sus tipos (`User`, `Quodom`,
  `QuodomLine`, …) pasan a ser alias de `components['schemas'][...]`, así el
  resto de la app no cambia sus imports.
- Los módulos de `app/src/api/*.ts` siguen usando `apiFetch` como hoy; no se
  introduce un cliente generado.

## 4. Controles contra la desalineación

Tres tests, cada uno cierra una forma distinta de que el archivo y el código
se separen:

1. **Cobertura de rutas** (API, Jest): recorre las rutas registradas en Express
   y las compara con los `paths` del archivo, en las dos direcciones. Falla si
   hay una ruta sin describir o una descrita que no existe.
2. **Respuestas válidas** (API, Jest): la validación de respuestas encendida en
   tests hace que la suite actual (236 tests) ejercite el contrato sin tests
   nuevos. Una respuesta que no coincide es un test rojo.
3. **Tipos al día** (app, Vitest): genera los tipos en memoria desde
   `openapi.yaml` y los compara con `schema.d.ts`. Falla si alguien cambió el
   contrato y no corrió `npm run api-types` — la misma trampa silenciosa que
   ya tienen las planillas del asistente con `npm run guias` (§8 de
   `CLAUDE.md`), esta vez con un test que la atrapa.

## 5. Direcciones que la app no usa

Al describir las 56 se arma la lista de las que la app no llama nunca
(candidatas: `/users/currentFoto`, `/users/cambiarFoto/:id`,
`/users/infoComprador/:idquodom`, `/quodom/getQuodomCreados`,
`/quodom/porccompletado/:id`, `/productos/categoriaQ/...`, las de admin).
**No se borran como parte de este trabajo.** Se describen igual en el archivo
y la lista se le presenta al usuario para que decida.

## 6. Orden de implementación

1. Dependencias, `openapi.yaml` vacío con los componentes comunes, y el test
   de cobertura (arranca rojo, con las 56 rutas faltantes).
2. Describir las direcciones grupo por grupo (un `tag` por vez), hasta que el
   test de cobertura pase.
3. Encender la guardia de pedidos y borrar los Joi de cada grupo, con la suite
   verde en cada paso.
4. Encender la validación de respuestas en tests y corregir el archivo (o el
   código) donde discrepen.
5. Tipos de la app, alias en `types.ts` y test de frescura.
6. Página de docs en dev.
7. Notas del proyecto (`CLAUDE.md` raíz, `api/`, `app/`) con la regla "primero
   el archivo" y los comandos nuevos; lista de direcciones sin uso al usuario.

## 7. Riesgos conocidos

- **Fechas en respuestas:** Sequelize devuelve objetos `Date` y el validador
  mira el body antes de serializarlo. Se declara `format: date-time` y se
  configura la serialización de fechas del validador (`serDes`); si no alcanza,
  se valida el body ya serializado.
- **Respuestas con forma variable** (por ejemplo `/users/reset`, que devuelve
  `res: true` o `res: false` según el caso, siempre con `200`): se describen
  como tal (`res: boolean`), sin forzarlas a un solo caso.
- **Mensajes del validador en inglés:** se reescriben en el `error-handler`;
  no se exponen crudos.
