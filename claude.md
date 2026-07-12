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
