# Quodom Web App (quodom-web/app/CLAUDE.md)

React 18 + Vite + TypeScript + plain CSS. 1:1 visual clone of the original React Native APP at `F:\backup\Command Soluciones\Quodom\APP` (read-only reference).

## Comandos
- `npm install`
- `npm run dev` — dev server en `http://localhost:5173` (requiere API en `http://localhost:3999`)
- `npm run build` — build de producción a `dist/`
- `npm run preview` — servir el build
- `npm run typecheck` — `tsc -b --noEmit`
- `npm run api-types` — regenera `src/api/schema.d.ts` desde `../api/openapi.yaml`. Correrlo cada vez que cambia el contrato; `tests/api-types.test.ts` falla si quedó viejo.
- `npm test` — Vitest (lógica no trivial y componentes con reglas que se rompen en silencio)

## Estructura
- `src/api/` — cliente `apiFetch` + un módulo por recurso. Todas las llamadas al backend pasan por acá. Los tipos de datos **no se escriben a mano**: `types.ts` son alias de `schema.d.ts`, generado desde `openapi.yaml`.
- `src/auth/` — `AuthContext` y `ProtectedRoute`. La sesión es una cookie httpOnly que pone el API; la app no ve el token, así que al cargar siempre pregunta `GET /users/current`.
- `src/guest/` — Quodom de invitado en `localStorage.quodom.guest`; `migrateGuestQuodom` lo transfiere al backend al iniciar sesión.
- `src/utils/telefono.ts` — `COD_AREA` ('011', fijo y deshabilitado en el formulario) y el teléfono de 8 dígitos, que se limpia mientras se escribe. Lo mismo lo valida el servidor (patrón en `openapi.yaml`); acá está para que el usuario se entere antes de guardar. Lo usan `SignUp` y `DetalleUsuario`, que son los dos únicos lugares donde se pide un teléfono.
- `src/quodom/bloqueosEnvio.ts` — qué impide enviar un Quodom, para no ofrecer un botón que el servidor va a rechazar con 409. Dos entradas porque los dos lugares tienen datos distintos: el sidebar sólo tiene el resumen (`bloqueoDeEnvio`, mira `porccompletado`) y el detalle tiene las líneas (`bloqueoDeEnvioPorLineas`, mira cada atributo). **No es la validación**, que vive en el backend; acá se replica el mismo orden de prioridad para que el aviso coincida con la respuesta. `useTieneDireccion` arranca en `true` y se queda en `true` si la consulta falla, porque un `false` optimista trabaría el envío con un motivo que puede ser falso; se reconsulta con el evento `direcciones:changed`, que dispara `AgregarDireccion` — el sidebar vive en el `Layout` y no se desmonta al ir a cargarla.
- `src/quodom/quodomAbierto.ts` — el mapa `{idrubro: idquodom}` en `localStorage.quodom.abierto`: qué Quodom de cada rubro recibe lo que se agrega y a la vez cuál está desplegado en el árbol. Es estado del cliente y no del servidor a propósito (dos pestañas pueden diferir y al backend no le importa), así que **se sanea contra la lista viva**: `sanearAbiertos` descarta lo que ya no está en armado. Sin eso, un Quodom borrado o enviado en otra pestaña seguiría figurando como abierto y el próximo `+` iría a un id muerto; con el saneo se trata como "ninguno abierto" y se pregunta de nuevo. Un valor corrupto en el storage se lee como mapa vacío.
- `src/quodom/ramas.ts` — agrupa la lista plana en ramas por rubro para el árbol, y **es el único lugar donde se filtran los rubros retirados**. El filtro no vive en el componente porque `rubroDisponible` es asíncrono: filtrar adentro del árbol comparaba contra una promesa y no filtraba nada, sin error. Por eso `ramasDeQuodoms` recibe `disponibles` ya resuelto y sigue siendo síncrona y testeable. Un rubro retirado que se cuela se ofrece como destino y el servidor lo rechaza con 400 recién al soltar.
- `src/quodom/useQuodomsEnArmado.ts` — el cargador compartido por el panel derecho y la barra inferior. Tres reglas, cada una salió de una revisión y cada una tiene su síntoma:
  - **`Promise.allSettled`, no `all`**: Quodoms y rubros son preguntas distintas. Con `all`, que falle la lista de rubros tira abajo también los Quodoms y el usuario ve el árbol vacío con trabajo en curso.
  - **Si falla sólo la lista de rubros, el árbol sale sin filtrar** (`disponibles = null`), no vacío. Mostrar todo es seguro porque el backend rechaza un rubro retirado; mostrar nada parece pérdida de datos.
  - **`sanearAbiertos` sólo tras una carga de Quodoms que de verdad salió bien.** Con una lista vacía por error de red, el saneo creería que no queda nada en armado y cerraría todo lo que el usuario tenía abierto: vuelve a preguntar destino en todos los rubros.
  Además sólo se aplica la respuesta del pedido más reciente, y un refresco fallido no pisa lo último bueno.
- `src/components/layout/ArbolQuodoms.tsx` — **un solo árbol** que dibujan las dos superficies: `.mq-sidebar` (desde 1025px) y `.barra-quodom` (debajo), que nunca conviven. No lo copies para una de ellas. Cada botón de Quodom lleva `data-destino` (su id) y `data-rubro`, y cada rubro un `data-nuevo` para "+ un Quodom nuevo": el arrastre hace hit-test buscando exactamente esos atributos, así que si se renombran o se pierden el arrastre sigue andando sin error y simplemente no encuentra destino.
- `src/quodom/arrastre.ts` — arrastrar una tarjeta sobre el árbol, con **eventos de puntero y no con el drag-and-drop de HTML**: `dragstart` congela una imagen de la tarjeta y no deja animarla, y el efecto de achicarse al entrar en el destino es imposible con esa API. Toda salida pasa por **un solo `abortar()`**, que se dispara con `buttons === 0`, `blur`, Escape, `pointercancel` y al desmontar. Sin eso, un `pointerup` perdido (soltar fuera de la ventana, cambiar de pestaña) dejaba el arrastre vivo y el siguiente clic en cualquier lado ejecutaba un soltado. Si agregás un oyente, sacalo también ahí.
- `src/quodom/DialogoDestino.tsx`, `useDestinoLote.ts` y `conAbierto` (en `agregarProducto.ts`) — **una sola regla de destino** para una línea suelta y para un lote (propuesta del asistente, lista subida): ir al abierto del rubro sin preguntar, y si no hay (o resultó muerto: `conAbierto` lo olvida ante un `ApiError`, no ante un error de red), preguntar una vez. Tanto la cola de `useAgregarProducto` como `useDestinoLote` **retoman, no reinician**: sacan cada ítem del lote apenas llega, y reutilizan el Quodom ya creado. Si reiniciaran, tras un fallo a medias lo que ya entró entraría otra vez y el usuario vería líneas duplicadas.
- `src/styles/` — `tokens.css` (paleta, tipografías, espacios, radios), `reset.css`, `typography.css`, `utilities.css` (`.container`, `.card`, `.btn`, `.hoja`, `.pantalla-header`, `.pantalla-contenido`), `global.css` que las importa todas.
- `src/components/layout/` — `AppBar`, `Drawer`, `Layout`, `BarraQuodomInferior`, `AppBarBack`, `ArbolQuodoms` (ver `src/quodom/` abajo).
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
- **Persistencia local:** el Quodom de invitado y el mapa de Quodoms abiertos (`quodom.abierto`); nada más. **El token de sesión nunca va a `localStorage`**: vive en una cookie httpOnly que ningún script puede leer.
- **El API se llama siempre por `/api`, en el mismo dominio que la app** (proxy de Vite en dev, regla de rewrite en Render). No apuntar `VITE_API_URL` a `quodom-api.onrender.com`: para el navegador sería otro sitio, Safari descarta la cookie y nadie con iPhone puede iniciar sesión.
- **Testing:** el recorrido visual se hace siempre en el navegador (dev server + API real) — es lo que valida layout, contraste y sensación de uso, y ningún test lo reemplaza. Además se escriben tests de Vitest sobre el comportamiento: tanto lógica pura (api client, guest quodom, migración) como componentes con Testing Library, cuando hay una regla que se puede romper en silencio — qué se llama y con qué argumentos, qué se muestra en cada estado, qué pasa cuando el servidor falla. No se testea el aspecto.
