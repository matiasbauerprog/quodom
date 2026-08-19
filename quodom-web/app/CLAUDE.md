# Quodom Web App (quodom-web/app/CLAUDE.md)

React 18 + Vite + TypeScript + plain CSS. 1:1 visual clone of the original React Native APP at `F:\backup\Command Soluciones\Quodom\APP` (read-only reference).

## Comandos
- `npm install`
- `npm run dev` — dev server en `http://localhost:5173` (requiere API en `http://localhost:3999`)
- `npm run build` — build de producción a `dist/`
- `npm run preview` — servir el build
- `npm run typecheck` — `tsc -b --noEmit`
- `npm test` — Vitest (solo lógica no trivial: api client, guest quodom, migración)

## Estructura
- `src/api/` — cliente `apiFetch` con JWT + un módulo por recurso. Todas las llamadas al backend pasan por acá.
- `src/auth/` — `AuthContext` (token+user en `localStorage.quodom.token`) y `ProtectedRoute`.
- `src/guest/` — Quodom de invitado en `localStorage.quodom.guest`; `migrateGuestQuodom` lo transfiere al backend al iniciar sesión.
- `src/styles/` — `tokens.css` (paleta, tipografías, espacios, radios), `reset.css`, `typography.css`, `utilities.css` (`.container`, `.card`, `.btn`, `.hoja`), `global.css` que las importa todas.
- `src/components/layout/` — `AppBar`, `Drawer`, `Layout`, `BarraQuodomInferior`, `AppBarBack`.
- `src/components/` — `Loader`, `EmptyState`, `ErrorState`, `Notificaciones/CampanitaNotificaciones`.
- `src/screens/` — una carpeta por área (Auth, Home, Quodom, MisQuodoms, Profile, Direcciones, Notificaciones); cada screen tiene su `.tsx` + `.css` al lado.
- `src/router/routes.tsx` — árbol de rutas con `createBrowserRouter`; rutas públicas fuera del `<Layout>` y rutas de app dentro.
- `tests/` — Vitest + happy-dom + Testing Library. Tests solo para: `api-client`, `guestQuodom`, `migrateGuestQuodom`.

## Reglas visuales (mobile-first, en este orden)
1. **Base mobile (< 601px):** escribí siempre primero para pantalla chica; grillas de 1–2 columnas, layout apilado, drawer que abre/cierra.
2. **Tablet: `@media (min-width: 601px) and (max-width: 1024px)`** — ampliá grillas a 3–4 columnas, aumentá padding lateral (`.container` va a 720px máx).
3. **Desktop: `@media (min-width: 1025px)`** — el drawer se vuelve persistente (grid `260px 1fr` en `.layout`), `.container` a 1120px máx, más columnas en grillas de productos/categorías.

Reglas duras: nunca fijes anchos en píxeles a nivel de página; usá `.container` + porcentajes/grid. La forma de hoja (`border-top-left-radius: 8px; border-bottom-right-radius: 8px`) va en tarjetas, imágenes y botones grandes (clase `.hoja`, ya aplicada por `.card` y `.btn`). Paleta: `--color-fondo #F1F1F1`, `--color-acento #E63946`, `--color-exito #2DAB66`, `--color-texto #1A1A1A`, `--color-tarjeta #FFFFFF`, `--color-panel-oscuro #1E1E2A` (para sidebars, drawer header y barra inferior).

Fuentes: Prompt para títulos y botones (`--font-prompt`), Work Sans para texto (`--font-work`), Jaldi/Montserrat disponibles por si algún componente puntual lo necesita.

## Convenciones
- **UI:** español (mensajes, labels, estados).
- **Código:** inglés (nombres de identifiers, comentarios). Sin comentarios salvo cuando el "por qué" no sea evidente.
- **HTML semántico:** `header`, `nav`, `main`, `section`, `article`, `button`, `label`+`input`.
- **Errores del API:** los controllers backend responden `{ res: false, message }` con status 4xx; el cliente lanza `ApiError` con el `message` — mostrarlo tal cual.
- **Persistencia local:** solo dos claves — `quodom.token` (JWT) y `quodom.guest` (Quodom de invitado). Ninguna otra información sensible en `localStorage`.
- **Testing:** el recorrido visual se hace siempre en el navegador (dev server + API real) — es lo que valida layout, contraste y sensación de uso, y ningún test lo reemplaza. Además se escriben tests de Vitest sobre el comportamiento: tanto lógica pura (api client, guest quodom, migración) como componentes con Testing Library, cuando hay una regla que se puede romper en silencio — qué se llama y con qué argumentos, qué se muestra en cada estado, qué pasa cuando el servidor falla. No se testea el aspecto.
