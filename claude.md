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
- La base se puebla con `npm run seed` leyendo `Documentacion 2.0/Categorias/Migracion.xlsx` (en la raíz del repo; 8 rubros + 50 subcategorías, 644 productos, IDs reales).

## 3. Reglas de producto
- No existe lógica de vendedores (cotizaciones, ofertas, zonas, rubros, calificaciones, bancos) ni de pagos.
- **Un Quodom pertenece a un solo rubro** (categoría de primer nivel, `idcategoriapadre = 0`; son 8) y ese rubro es inmutable. **Como máximo un Quodom abierto (`estado = 'CREADO'`) por usuario y rubro**; los `ENVIADO` no bloquean. Agregar un producto resuelve el Quodom abierto de su rubro y, si no hay, pide confirmación antes de crearlo — nunca crea como efecto secundario. Backend: 409 `rubro_duplicado` y 409 `rubro_mismatch`. Spec: `docs/superpowers/specs/2026-08-18-quodom-por-rubro-design.md`.
- Todo camino de "agregar producto" pasa por `app/src/quodom/agregarProducto.ts` (o el hook `useAgregarProducto`); nunca llamar a `addGuestLine` directo.
- Navegación guest: catálogo, búsqueda y armado del Quodom sin login (**un carrito por rubro** en `localStorage`). El login se exige para enviar por WhatsApp, Mis Quodoms, perfil, direcciones, notificaciones y Modo IA.
- Al loguearse, los carritos de invitado migran rubro por rubro. Un rubro sin conflicto se crea solo; si ya hay un Quodom abierto de ese rubro, el usuario elige integrar / reemplazar (descarta el Quodom entero) / cancelar. **Nunca se borra un carrito antes de que sus líneas estén confirmadas en el servidor.**
- El flujo termina generando un link `https://wa.me/?text=...` con el detalle y datos de contacto.
- **Atributos de producto:** en `productos`, `atributo1`/`atributo2` guardan el **nombre del grupo** (`"MEDIDAS"`), no un valor; los valores elegibles viven en `productos_atributos.valoratributo`. En `quodom_lines` es al revés: `nombreAtributoN` es el nombre y `atributoN` es **lo que eligió el usuario**. Agrupar por `nombreatributo` y nunca por `idatributo` (el id `3` es `MEDIDAS` en unos productos y `PESO` en otros). Elegir es **opcional**: una línea sin atributo es válida y se completa después en el detalle del Quodom. Spec: `docs/superpowers/specs/2026-08-20-atributos-en-tarjeta-design.md`.
- **El asistente tiene dos personalidades**, y las dos viven dentro del home, no en pantallas propias: el **chat** que repregunta antes de proponer, y la **lista subida** (Excel, CSV, foto, PDF o texto pegado) que matchea cada renglón contra el catálogo, agrupa por rubro y ofrece candidatos cuando un renglón admite varios productos. Confirmar no navega: marca "Agregado ✓" y deja al usuario donde estaba. Specs: `2026-08-20-quodom-web-lista-ia-design.md`, `2026-08-20-ia-en-el-home-design.md`, `2026-08-20-lista-alternativas-design.md`.
- **Subir una lista está apagado en la entrada, no borrado** (2026-08-23): el home muestra sólo el botón "Modo IA". El render de `PanelLista` y su test están comentados con la nota que explica cómo revivirlos. `PanelLista`, `LineasAmbiguas`, `CargarLista`, `GrupoRubro`, `NoEncontrados`, `api/lista.ts`, `PestanasIA` y todo el backend siguen vivos y con sus tests corriendo — **no borrarlos por "código sin usar"**.
- **El rubro de un producto se calcula, nunca se lee de `productos.categoriaPadre`**: es el `idcategoriapadre` de su categoría, salvo que esa categoría sea ella misma un rubro, en cuyo caso es su propio `id`. Los dos campos discrepan en 24 productos y en cinco de ellos el campo apunta a un rubro activo cuando la categoría real es de uno desactivado. Vive en `api/src/helpers/catalogoActivo.js`; misma regla para filtrar y para agrupar.

## 4. Reglas visuales (frontend)
- Mobile-first estricto. Breakpoints: tablet `@media (min-width: 601px) and (max-width: 1024px)`, desktop `@media (min-width: 1025px)`.
- Paleta: fondo `#F1F1F1`, acento `#E63946`, éxito `#2DAB66`, texto `#1A1A1A`, tarjetas `#FFFFFF`, panel oscuro `#1E1E2A` (sidebars, drawer header, barra inferior). Referencia visual en `Documentacion 2.0/CAMBIO ESTETICO.jpeg`.
- Forma de hoja: `border-top-left-radius: 8px; border-bottom-right-radius: 8px;`
- Fuentes Google Fonts: Prompt, Jaldi, Work Sans, Montserrat.
- HTML semántico estricto (`header`, `nav`, `main`, `section`, `article`, `button`, `label`/`input`).

## 5. Idioma y convenciones
- **UI:** Español (textos del Quodom original).
- **Código técnico y commits:** Inglés.
- Tests de API: integración con SQLite real (en memoria), sin mocks de base de datos. Lo único que se mockea es `callGemini`, que es HTTP externo.
- **Fechas en fixtures: relativas, nunca absolutas.** `QuodomCard` marca VENCIDO a las 72hs de enviado comparando contra `Date.now()`; un fixture con fecha fija pasa tres días y después falla solo, con el código intacto. Usar `new Date(Date.now() - 60 * 60 * 1000).toISOString()`. Ya pasó una vez, y el síntoma es el peor posible: una suite verde aparece rota en una sesión que no tocó nada de eso.

## 6. Base de datos: trampa al commitear
`quodom-web/api/quodom.sqlite` está **trackeada en git** y es la que se despliega; `seed.js` sólo puebla el catálogo y `model.sync()` nunca hace `ALTER` sobre una tabla existente. Además la base corre en **modo WAL** y los archivos `-wal`/`-shm` están gitignoreados, así que las escrituras recientes pueden no estar dentro del archivo que git sube.

Consecuencia: **mirar el archivo local no prueba nada sobre lo que se despliega.** Después de cambiar el schema, correr `npm run reset-quodoms` (que dropea, recrea y hace `wal_checkpoint(TRUNCATE)`), commitear `quodom.sqlite`, y verificar el blob commiteado, no el working tree:

```bash
git show HEAD:quodom-web/api/quodom.sqlite > /tmp/check.sqlite   # y consultar ese archivo
```

Saltear esta verificación ya rompió el deploy una vez: el server arranca limpio y falla toda lectura de Quodoms.

## 7. Vite sirve un módulo vacío tras reescribir un archivo
Reescribir un archivo entero (`cat > file`, o cualquier cosa que trunque antes de escribir) puede hacer que el watcher de Vite lo lea en el instante en que mide cero bytes y **cachee una transformación vacía**. El dev server responde `200` con `Content-Length: 0` de forma consistente y la pantalla queda en blanco.

Los tests y el build **no lo detectan**: leen del disco, donde el archivo está bien. Verificar contra el servidor:

```bash
curl -s http://localhost:5173/src/ruta/Componente.tsx | wc -c   # comparar con el archivo
```

Se arregla reescribiendo el archivo otra vez (invalida la cache) o reiniciando Vite. Preferir ediciones in-place a truncar y reescribir.
