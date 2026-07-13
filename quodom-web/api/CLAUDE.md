# Quodom Web API (quodom-web/api/CLAUDE.md)

Express + Sequelize 6 + SQLite, JavaScript (CommonJS). Port 1:1 de la API original sin vendedores ni pagos.

## Comandos
- `npm install` — instalar dependencias
- `npm run seed` — poblar `quodom.sqlite` desde `Documentacion 2.0/Categorias/Migracion.xlsx` (verifica 50 subcategorías / 644 productos)
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
