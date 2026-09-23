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
- `src/styles/` — `tokens.css` (paleta, tipografías, espacios, radios), `reset.css`, `typography.css`, `utilities.css` (`.container`, `.card`, `.btn`, `.hoja`, `.pantalla-header`, `.pantalla-contenido`), `global.css` que las importa todas.
- `src/components/layout/` — `AppBar`, `Drawer`, `Layout`, `BarraQuodomInferior`, `AppBarBack`.
  - `AppBar` es la única barra: lleva la hamburguesa y, salvo en el home pelado, el logo QUODOM, que es el camino de vuelta al inicio.
  - `AppBarBack` **no es una barra**: es el título de la pantalla con su flecha. Va sólo en las pantallas anidadas —Mis datos, Cambiar contraseña, Nueva y Editar dirección, detalle del Quodom—, donde la flecha es la salida real. Las que se llegan desde el menú escriben su propio `h1` (ver abajo).
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

### Cómo se arma una pantalla de sección

Mis Quodoms, Perfil, Direcciones y Notificaciones se llegan desde el menú y tienen que arrancar todas igual. Antes cada una traía su propia regla de encabezado, idénticas entre sí y ya separándose en los márgenes, así que la forma vive en `utilities.css` y no repetida en cada CSS:

```
<section className="container mq">
  <div className="pantalla-header">        h1 a la izquierda, acción al otro extremo
  <div className="pantalla-contenido">     el cuerpo, agrupado en un solo bloque
```

El envoltorio del contenido **no es decorativo**: sin él, el reparto de la sección sería entre cada pieza suelta —el error, el loader, la lista— y quedaría desparejo según qué esté visible en cada momento. Con él, la sección reparte entre dos bloques con `space-evenly`.

Tres medidas compartidas, en `tokens.css`, para que ninguna pantalla se despegue distinto que las demás:

| | |
|---|---|
| `--pantalla-top` | dónde empieza el contenido bajo el header: `clamp(48px, 8vh, 120px)`, proporcional con piso y techo |
| `--pantalla-ancho` | 720px. `.container` llega a 1120px, que necesita una grilla de productos y le sobra a una lista |
| `--pantalla-alto` | la ventana menos el header, contra el cual se reparte la sección |

El `h1` de una pantalla es `--fs-h1` (32px). Los 44px de antes eran tamaño de wordmark; el del home es aparte (`.home-wordmark`).

### El home tiene dos perillas, no una

`--home-inicio` decide dónde arranca el wordmark y `--home-aire` cuánto se separan los elementos. Estaban fundidas en un `space-evenly`, que reparte el sobrante en partes iguales —una arriba del wordmark y una entre cada par—, así que juntar los elementos subía el wordmark y no había forma de tener una cosa sin la otra.

## Convenciones
- **UI:** español (mensajes, labels, estados).
- **Código:** inglés (nombres de identifiers, comentarios). Sin comentarios salvo cuando el "por qué" no sea evidente.
- **HTML semántico:** `header`, `nav`, `main`, `section`, `article`, `button`, `label`+`input`.
- **Errores del API:** los controllers backend responden `{ res: false, message }` con status 4xx; el cliente lanza `ApiError` con el `message` — mostrarlo tal cual.
- **Persistencia local:** solo dos claves — `quodom.token` (JWT) y `quodom.guest` (Quodom de invitado). Ninguna otra información sensible en `localStorage`.
- **Testing:** el recorrido visual se hace siempre en el navegador (dev server + API real) — es lo que valida layout, contraste y sensación de uso, y ningún test lo reemplaza. Además se escriben tests de Vitest sobre el comportamiento: tanto lógica pura (api client, guest quodom, migración) como componentes con Testing Library, cuando hay una regla que se puede romper en silencio — qué se llama y con qué argumentos, qué se muestra en cada estado, qué pasa cuando el servidor falla. No se testea el aspecto.
