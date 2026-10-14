# Quodom Web API (quodom-web/api/CLAUDE.md)

Express + Sequelize 6 + SQLite, JavaScript (CommonJS). Port 1:1 de la API original sin vendedores ni pagos.

## Comandos
- `npm install` — instalar dependencias
- `npm run seed` — poblar `quodom.sqlite` desde `Documentacion 2.0/Categorias/Migracion.xlsx` (verifica 50 subcategorías / 644 productos)
- `npm run guias` — regenera `src/config/guias/<idrubro>.txt` desde `informacion para la ia/<Rubro>/Listado_*.xlsx`. **Correrlo cada vez que se toca una planilla**: sin eso la API sigue mandándole al asistente las instrucciones viejas y no falla nada visible. Ver §8 de `claude.md` en la raíz.
- `npm run migrar-empresa` — agrega a `users` las columnas `empresa`, `cuit` y `facturaA` y deja el `codArea` en `011`. **Correrlo una vez sobre cualquier base que ya exista**: `model.sync()` crea una tabla que falta pero nunca hace `ALTER` sobre una creada, así que sin esto el modelo declara columnas que la base no tiene y guardar el perfil falla. Es idempotente y no borra ninguna cuenta (`ADD COLUMN` no toca las filas).
- `npm run dev` — servidor en `http://localhost:3999` (nodemon)
- `npm test` — Jest + Supertest contra SQLite en memoria (`--runInBand`; cada archivo de test tiene su propia DB)
- `http://localhost:3999/docs/` — la documentación navegable del API, sólo con `npm run dev` (`nodemon.json` pone `API_DOCS=true`). En Render no existe.

## Estructura
- `src/server.js` — app Express; exporta `app` (los tests la importan sin levantar el puerto)
- `src/routes/` → `src/controllers/` → `src/models/` + `src/helpers/db.js`
- `src/helpers/views.js` — vistas SQL (`v_Busquedas`, `v_Quodoms`, `v_Quodoms_Lines`, `v_InfoCompradors`). Los modelos `v_*` NO se sincronizan (son vistas); NUNCA usar `sequelize.sync()` global.
- `src/middleware/auth.js` — `verifyToken()` / `isAdmin()`. Leen el JWT de la cookie `quodom_session` (`helpers/session.js`) o, si no está, del header Bearer, que queda para tests y herramientas. Un token con `action` (link de blanqueo o de validar email) **nunca** abre sesión.
- `/users/signin`, `/signup`, `/reset`, `/reenviar`, `/changePass` y `/validateReset` tienen límite de intentos por IP (y por casilla, los que mandan mail). Los topes se ajustan con `AUTH_LIMIT_*` y la IP del cliente se obtiene salteando los proxies conocidos (`src/config/proxies.js`), no contando saltos: la cantidad cambia según se entre por la app o directo.
- `src/config/guias/` — guías por rubro **generadas**; no editarlas a mano, se pisan con `npm run guias`. La fuente son las planillas en `informacion para la ia/`.
- `src/helpers/gemini.js` — cadena de modelos con respaldo, reparto del presupuesto de tiempo y tope de salida. El modelo por defecto está elegido por medición, no por ser el más nuevo.
- Config por `.env` (ver `.env.example`). Nunca commitear `.env` ni `quodom.sqlite`.

## Convenciones
- Errores tipo string lanzados desde controllers → el error-handler responde `{ res: false, message }` (400/404).
- Rutas públicas (guest): `/categorias`, `/productos/categoria/:id`, `/productos/:id`, `/busqueda`, `/provincias`, `/localidades/prov`. Todo lo demás requiere token.
- Estados de Quodom: `CREADO` → `ENVIADO` (vía `GET /quodom/whatsapp/:id`). No existen estados de cotización. Ese endpoint es el único que cambia el estado, así que **las condiciones para enviar se validan ahí**: sin productos (400), con alguna línea sin el atributo que su producto declara (409 `falta_atributo`) o sin ninguna dirección cargada (409 `falta_direccion`). Un bloqueo deja el Quodom en `CREADO` y no genera notificación. La dirección se resuelve al enviar y se guarda, porque `iddireccion` se copió al crear y puede estar en `null` aunque el usuario ya tenga una. Ver §3 de `claude.md` en la raíz.
- Tests: integración con la DB real en memoria, sin mocks. Cada feature nueva agrega su archivo en `tests/`.
- **Una ruta nueva o cambiada empieza por `openapi.yaml`.** Sin eso falla `tests/openapi.coverage.test.js` (ruta sin describir) o la validación de respuestas. Ya no hay esquemas Joi: la validación de pedidos sale del contrato. Si un campo vacío tiene que significar "no tocar", va `omitEmpty([...])` en la ruta, porque el contrato deja pasar `''` y `null`.
- Todo campo que un handler lea del body tiene que estar declarado en el contrato: el validador borra los que no lo están.
