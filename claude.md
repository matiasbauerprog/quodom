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
- **Qué tiene que devolver el chat, más allá de los productos** (2026-09-20/22): la propuesta trae **cantidad y atributo elegido** (`atributo1`/`atributo2` con su `nombreAtributoN` y `opcionesAtributoN`), y la tarjeta los muestra como desplegables editables antes de confirmar. El asistente completa el atributo **sólo cuando se desprende de la conversación** — el formato que sale de su propio cálculo, o lo que el usuario dijo — y deja vacío lo que es preferencia (marca, color): una línea sin atributo es válida. La misma regla vale cuando el gusto está en **productos distintos** y no en atributos (`137 Latex Interior Blanco Mate` contra `138 ... Satinado`): ahí también pregunta en vez de elegir. Y si el catálogo **no tiene** lo que el usuario pidió, lo dice; nunca entrega otra cosa parecida en silencio (ver §8).
- **Confirmar una propuesta nunca mezcla Quodoms sin avisar**: si el rubro ya tiene un Quodom abierto, `PanelConversacion` abre `DialogoConflictoRubro` con integrar / reemplazar / cancelar. Sigue habiendo **un solo Quodom abierto por rubro**, así que "uno nuevo" significa reemplazar. Si no hay ninguno abierto, pide confirmación con `DialogoNuevoRubro`, como siempre.
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

## 8. De qué se alimenta el asistente (y qué no hay que tocar)

El pedido que se le manda a Gemini en cada turno se arma con tres piezas, y **se paga por token en cada conversación**. Un turno de Pintura mide ~3.500 tokens de entrada. Las tres piezas tienen cada una su trampa.

**a) El conocimiento del rubro sale de planillas, y hay que convertirlo a mano.**
`quodom-web/informacion para la ia/<Rubro>/Listado_*.xlsx` es la fuente que se edita; `npm run guias` (en `api/`) la convierte en `api/src/config/guias/<idrubro>.txt`, que es lo que lee la API. Se manda **sólo la guía del rubro detectado**.

El paso intermedio existe para que un cambio en las instrucciones del asistente **se vea en el diff**: un `.xlsx` es binario y una instrucción que cambia sin dejar rastro es una instrucción que nadie revisa.

> **Editar una planilla y no correr `npm run guias` no rompe nada visible.** La API sigue contestando con las instrucciones viejas y nadie se entera. El test `guías por rubro` avisa si a un rubro activo le **falta** el archivo, pero no puede saber que la planilla cambió.

Cómo escribir una planilla (qué va en los ejemplos y qué en los supuestos) está en `quodom-web/informacion para la ia/COMO ESCRIBIR LAS PLANILLAS.md`. De cada planilla se toman las hojas `Supuestos` (reglas de cálculo, qué preguntar, y los huecos del catálogo) y los **ejemplos resueltos**; se ignoran `Pendientes` y los archivos `<Rubro>.xlsx`, que replican el catálogo que ya sale de la base y traen datos de vendedores, que acá no existen.

**Los ejemplos no son decoración, y tienen que ser dos de distinto tamaño.** Medido sobre un caso que no coincidía con ninguna referencia: sin ejemplos el asistente proponía 7 productos y se olvidaba el esmalte de las aberturas; con **uno** solo copiaba su escala (pedía 2 bandejas y 2 cintas para un departamento que lleva 1 de cada una); con **dos** de distinto tamaño interpola y llega a 17 productos correctos. Papelera, Limpieza y Librería todavía tienen uno solo; `npm run guias` lo avisa al correr.

**b) El catálogo va comprimido, y el separador es `|` por una razón.**
Los valores de atributo se declaran **una vez** bajo un código (`A1=LITROS: 1 litro|4 litros|...`) que los productos referencian, en texto plano y no en JSON. Así la lista pasó de 1.317 a 377 tokens, y por eso alcanza para mandar el **rubro entero** en vez de las subcategorías que adivina el clasificador — que era lo que dejaba los pinceles afuera, porque viven en *Accesorios*.

> No cambiar `|` por `/` ni por `,`, ni "ordenar" esto a JSON: el catálogo tiene **49 valores con barra** (`1 1/2"`) y **137 con coma decimal** (`3,8 mts`), y JSON además escapa las comillas de las pulgadas. Cualquiera de las tres cosas parte valores al medio y el modelo elige algo que el servidor después descarta en silencio.

**c) El modelo por defecto no es el más nuevo, y está elegido por medición.**
`GEMINI_MODEL` y `DEFAULT_FALLBACKS` (en `api/src/helpers/gemini.js`) apuntan a la cadena que **efectivamente contesta**, no a la última versión. Los modelos más nuevos son los más congestionados y devuelven 503; el 2026-09-20 la cadena entera (3.7 → 3.6 → 3.5) contestaba 503 a la vez. Actualizar "al último modelo" reintroduce el fallo, y el síntoma es *"La IA está sobrecargada"*.

La cadena es larga a propósito: la cuota del free tier es **por modelo**, y un 429, un 404 o un 503 fallan en menos de un segundo. Lo caro es el timeout, y por eso el presupuesto total se reparte entre los modelos que faltan (`tiempoParaEsteIntento`) en vez de dejar que el primero se lo coma: con 30s por intento y 55s de presupuesto, dos timeouts agotaban todo y **la cadena de respaldo no se ejecutaba nunca**.

**Dos cosas más del lado del servidor, que son garantías y no pedidos al modelo:**
- `motivo` se corta a **200 caracteres** (`motivoAcotado`). El prompt pide una sola oración y el esquema declara el largo, pero el modelo ya usó ese campo para deliberar en voz alta hasta agotar su presupuesto de salida, y la propuesta llegó con un producto en vez de once.
- Un atributo que el producto no ofrece se **descarta**, igual que un `idproducto` inventado.

Si una respuesta se corta por el tope de salida, el error lo dice con esas palabras (`finishReason MAX_TOKENS`), no "JSON inválido".
