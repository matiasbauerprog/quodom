# Quodom Web — Design Spec

**Fecha:** 2026-07-12
**Estado:** Aprobado en diseño, pendiente de plan de implementación
**Reemplaza a:** la reescritura `quodom-new/` (spec 2026-07-10), que queda deprecada.

## 1. Objetivo

Crear una webapp de Quodom partiendo de la estructura del proyecto original (`API` + `APP`, en `F:\backup\Command Soluciones\Quodom\`), eliminando por completo:

1. **Toda la lógica de usuarios vendedores** (registro de vendedor, cotizaciones, ofertas, zonas, rubros, calificaciones, liquidaciones).
2. **La pasarela de pago** (Mobbex y todo el circuito de pagos).

El flujo del comprador termina en la **exportación del Quodom por WhatsApp**.

Además del armado manual, la webapp suma un **Modo IA**: un chat junto al buscador que arma el presupuesto a partir de una conversación (ver sección 7).

## 2. Arquitectura y estructura de carpetas

Nueva carpeta `quodom-web/` en la raíz del repo, espejando la estructura original:

```
quodom-web/
├── api/                          ← espejo de API (Express + Sequelize)
│   ├── src/
│   │   ├── config/               (db.config → dialecto SQLite)
│   │   ├── controllers/          (los del original, menos vendedores/pagos)
│   │   ├── helpers/              (db, dbquery, email, series)
│   │   ├── lib/email/templates/  (validar-email.ejs, reset-password.ejs)
│   │   ├── middleware/           (auth JWT, error-handler, validate-request)
│   │   ├── models/
│   │   ├── routes/
│   │   ├── seed/                 (script que lee Migracion.xlsx y puebla SQLite)
│   │   └── server.js
│   ├── quodom.sqlite             (la base, un archivo)
│   └── package.json              (JavaScript, igual al original)
│
└── app/                          ← espejo de APP (React + Vite + TypeScript)
    ├── src/
    │   ├── screens/              (Home/, MisQuodoms/, Profile/, Settings/)
    │   ├── components/           (AppBar, Banners, BarraQuodomInferior, etc.)
    │   ├── navigation/           (react-router, espejo de Navigation.js)
    │   ├── styles/               (CSS plano, paleta original)
    │   ├── constants/
    │   ├── api.ts                (equivalente tipado de api.js)
    │   └── main.tsx
    └── package.json
```

Decisiones:

- **La API queda en JavaScript** como el original: controllers/models se portan casi tal cual; solo cambia el dialecto de Sequelize de MySQL a SQLite.
- **El frontend se reescribe en TypeScript** (React + Vite + CSS plano, sin framework de UI), replicando pantalla a pantalla las screens, navegación y estilos de APP.
- Los nombres de archivos y carpetas replican los originales para que la correspondencia 1:1 sea evidente (`busqueda.controller.js`, `screens/Home/SitioInicial`, etc.).
- `API` y `APP` originales no se modifican: son referencia de solo lectura.

## 3. Backend

### 3.1 Se elimina

| Área | Archivos originales |
|---|---|
| Pagos (Mobbex) | `payments.controller/route`, `mov_pagos.model`, `v_mov_liquidaciones.*`, dependencia `mobbex`, template `detalle-compra.ejs` |
| Cotizaciones de vendedores | `cotizacionesheaders.*`, `cotizacioneslines.*`, `v_cotizacioneslines`, `v_listaCotizaciones.*`, `v_QLines_Cotizado`, `v_ofertasparavendedors.*` |
| Perfil vendedor | `user_categorias.*`, `user_zonas.*`, `zonas.*`, `calificaciones.*`, `ignorar_quodom_vendedor.*`, `v_InfoVendedors`, `v_ResumenPorVendedor`, `v_venderoresSeleccionados` |
| Geolocalización de zonas | dependencia `@googlemaps/google-maps-services-js` |

En `users` se eliminan los campos propios del vendedor (datos bancarios, tipo de cuenta vendedor). El registro crea siempre compradores.

### 3.2 Se mantiene (adaptado a SQLite)

- `users` + auth JWT + bcrypt, verificación de email y reset de password (nodemailer)
- `user_direcciones`, `provincias`, `localidades`
- `categorias`, `productos` (+ atributos), `busqueda`, `hist_busquedas`
- `quodom`, `quodom_lines` (crear, editar, agregar/quitar productos, cerrar)
- `oper_notificaciones` / `planif_notificaciones` → notificaciones internas (campanita), sin push de Expo
- `users_logs`, `series`

### 3.3 Adaptaciones técnicas

1. **Vistas SQL:** las vistas que sobreviven (`v_Busqueda`, `v_Quodoms`, `v_Quodoms_Lines`, `v_InfoCompradors`, `v_ResumenCompras`) se recrean con sintaxis compatible SQLite o se convierten en queries de Sequelize dentro del controller. Se decide vista por vista al portarlas.
2. **Seeding:** script Node en `seed/` que lee `Documentacion 2.0/Categorias/Migracion.xlsx` (8 rubros + 50 subcategorías, 644 productos con sus IDs reales) y puebla la base. Se corre con `npm run seed`. (Corrección durante ejecución: el spec decía 62 subcategorías, pero el Excel real contiene 50.)
3. **Exportación WhatsApp:** `GET /api/quodom/:id/whatsapp` genera el texto del mensaje (listado de productos con cantidades + datos de contacto del comprador) y devuelve el link `https://wa.me/?text={mensaje_codificado}` para que el frontend redirija.

## 4. Frontend

### 4.1 Pantallas que se replican

| Original (APP) | Web |
|---|---|
| `SplashScreen` / `SitioInicial` | Landing con banners de categorías |
| `SignInScreen`, `SignUpScreen`, `CuentaCreada`, `ForgotPassword` | Login, registro (solo comprador), confirmación, recuperar contraseña |
| `Home/BusquedaScreen` | Buscador de productos con historial de búsquedas |
| Catálogo (Banners de categorías/subcategorías) | Grilla de categorías → subcategorías → productos |
| `MisQuodoms/ListaMisQuodoms` | Lista de Quodoms del usuario + detalle/edición de líneas |
| `Profile/*` (DetalleUsuario, CambiarPass, Seguridad, avatar) | Perfil de usuario |
| `components/Direcciones` | ABM de direcciones con provincias/localidades |
| `components/Notificaciones` | Campanita con notificaciones internas |
| `DrawerContent` | Menú lateral (drawer) adaptado a web |

### 4.2 Pantallas que NO se portan

`SignUpScreenVendor`, `ElegirCuenta`, carpeta `ofertas/` completa, `Settings/WizardVendedor*`, `Settings/ZonasScreen`, `Settings/CategoriasScreen`, `Profile/BancosScreen`, `Profile/SelectBancos`.

### 4.3 Navegación guest (sin login)

- **Público:** landing, catálogo, búsqueda, y **armar un Quodom** (crear, agregar/quitar productos, cantidades) con la barra flotante (`BarraQuodomInferior`) visible.
- **Requiere login:** cerrar/enviar el Quodom por WhatsApp, Mis Quodoms, perfil, direcciones, notificaciones, historial de búsquedas y el **Modo IA**.
- El Quodom de invitado vive en `localStorage` (nombre + líneas con `productId` y cantidad). No toca el backend.
- Al tocar "Enviar por WhatsApp" sin sesión → redirección a login/registro con mensaje "Creá tu cuenta para enviar tu Quodom".
- Tras login/registro exitoso, el Quodom de `localStorage` se **migra automáticamente al backend** (se crea con sus líneas a nombre del usuario) y el flujo de envío continúa donde quedó. Si el usuario ya tenía Quodoms, el de invitado se agrega como uno más.

### 4.4 Flujo final

En el detalle del Quodom, el botón que antes iniciaba la cotización pasa a ser **"Enviar por WhatsApp"** → llama al endpoint de exportación y abre `wa.me` en pestaña nueva.

### 4.5 Rutas y sesión

`react-router` espejando `Navigation.js`: rutas públicas y rutas protegidas por token JWT guardado en `localStorage` (equivalente a AsyncStorage del original).

### 4.6 Estilos

- CSS plano, **mobile-first** con breakpoints: tablet `@media (min-width: 601px) and (max-width: 1024px)`, desktop `@media (min-width: 1025px)`.
- Paleta original: fondo `#F6EE5D`, acento `#706F9A`, éxito `#2DAB66`, texto `#45444C`, tarjetas blancas.
- Forma de hoja en tarjetas e imágenes: `border-top-left-radius: 8px; border-bottom-right-radius: 8px`.
- Fuentes Google Fonts: Prompt, Jaldi, Work Sans, Montserrat.
- HTML semántico estricto: `header`, `nav`, `main`, `section`, `article`, `button`, `input`/`label`.

## 5. Manejo de errores

- La API mantiene el middleware `error-handler` del original: respuestas JSON consistentes (`{ message }` + status HTTP correcto).
- El frontend verifica `response.ok` y parsea JSON dentro de try/catch; nunca asume respuesta válida.
- Estados de carga y error visibles en cada pantalla (spinner + mensaje amigable con reintento). Con el backend caído, el Quodom de invitado en `localStorage` sigue funcionando.
- Token JWT vencido → redirección a login conservando el Quodom activo.

## 6. Testing

- **API:** tests de integración contra una base SQLite real de test (sin mocks de base), cubriendo auth, catálogo, quodoms y el endpoint de WhatsApp.
- **Seeding:** verificación automática post-seed (50 subcategorías, 644 productos).
- **IA:** tests del endpoint de chat con el proveedor Gemini simulado (sin llamadas reales), cubriendo validación de `productId` contra el catálogo, límites de uso y formato de respuesta.
- **Frontend:** verificación manual en navegador de los flujos clave (guest arma Quodom → registro → migración → envío WhatsApp; chat IA → propuesta → confirmación). Tests unitarios solo para lógica no trivial (migración del Quodom de invitado, armado del mensaje de WhatsApp).

## 7. Modo IA — chat para armar el presupuesto

### 7.1 UI

- Junto al buscador hay un botón **"Modo IA"** con la identidad visual de Quodom. Al activarlo, la barra de búsqueda se transforma en un chat.
- Requiere login: si no hay sesión, el botón redirige a login/registro con mensaje contextual ("Ingresá para usar el asistente").
- Chat **multi-turno**: la IA puede repreguntar (ej. "¿paredes y techo?", "¿la superficie está pintada?") antes de proponer.
- Cuando tiene suficiente información, la IA muestra una **propuesta editable dentro del chat**: lista de productos reales del catálogo con cantidades; el usuario puede quitar items o ajustar cantidades. Al confirmar, se agregan al Quodom activo (o se crea uno si no hay).

### 7.2 Backend

- Nuevos `ia.controller.js` + `ia.route.js`, protegidos por JWT.
- `POST /api/ia/chat`: recibe el historial de la conversación y llama a **Gemini** (clave en variable de entorno; el frontend nunca la ve) con salida JSON estructurada.
- La respuesta es siempre uno de dos tipos:
  - `{ type: "question", text }` — repregunta de la IA.
  - `{ type: "proposal", items: [{ productId, quantity, reason }] }` — propuesta de presupuesto.
- El system prompt incluye el catálogo relevante (subcategorías + productos filtrados por la intención detectada) para que la IA solo proponga **IDs reales**. El backend valida cada `productId` contra la base antes de responder y descarta alucinaciones.

### 7.3 Límites anti-abuso

Configurables por variables de entorno; valores iniciales generosos:

| Límite | Valor inicial |
|---|---|
| Mensajes de IA por usuario por día | 50 |
| Turnos máximos por conversación | 20 |
| Largo máximo del mensaje del usuario | 500 caracteres |
| Rate limit por usuario | 10 mensajes/minuto |

- El consumo se registra en una tabla `ia_usage` (userId, fecha, contador).
- Al superar el límite diario, el chat responde amablemente que se alcanzó el límite del día y sugiere seguir con el buscador manual.
- Todos los límites se aplican en el backend (no se pueden saltear desde el cliente).

## 8. Harness de Claude Code

1. **Nuevo `CLAUDE.md` raíz** (reemplaza al actual, que describe la deprecada `quodom-new/`):
   - Proyecto activo: `quodom-web/`. `API`/`APP` (carpeta padre) son referencia de solo lectura. `quodom-new/` deprecada.
   - Reglas de arquitectura: api en JS espejo del original con SQLite; app en React+Vite+TS; correspondencia 1:1 de nombres.
   - Reglas de producto: sin vendedores ni pagos; navegación guest con Quodom en `localStorage`; cierre requiere registro; export por WhatsApp.
   - Reglas visuales (paleta, forma de hoja, fuentes, breakpoints, HTML semántico).
   - Convenciones: UI en español, código/commits en inglés.
2. **`CLAUDE.md` por subproyecto:** `quodom-web/api/CLAUDE.md` (patrones de controllers/models, cómo correr seed y tests) y `quodom-web/app/CLAUDE.md` (estructura de screens, dev server).
3. **`.claude/settings.json` commiteado** con allowlist de permisos: `npm run dev/test/seed/build` dentro de `quodom-web`, `node`, `npx tsc --noEmit`, lecturas del proyecto y carpetas de referencia. Se configura con la skill `update-config`.
4. **Flujo de trabajo:** specs en `docs/superpowers/specs/` → plan (writing-plans) → ejecución por tareas con commits chicos y verificación antes de marcar completado.

## 9. Fuera de alcance

- Lógica de vendedores en cualquier forma (incluido backoffice de cotización manual).
- Pasarelas de pago.
- Push notifications nativas.
- Modo IA para invitados (requiere login).
- Modificaciones a las carpetas originales `API` y `APP`.
