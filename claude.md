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
- **OpenAPI first:** `quodom-web/api/openapi.yaml` es el contrato entre la app y el API, y **manda**. Todo cambio de API empieza ahí y después va el código. El API rechaza pedidos que no lo cumplen (y descarta campos de más), los tests validan cada respuesta contra él, y la app genera sus tipos con `npm run api-types`. Tres tests fallan si se desalinean: cobertura de rutas, respuestas, y tipos al día. Spec: `docs/superpowers/specs/2026-09-23-openapi-first-design.md`.
- La base se puebla con `npm run seed` leyendo `Documentacion 2.0/Categorias/Migracion.xlsx` (en la raíz del repo; 8 rubros + 50 subcategorías, 644 productos, IDs reales).

## 3. Reglas de producto
- No existe lógica de vendedores (cotizaciones, ofertas, zonas, rubros, calificaciones, bancos) ni de pagos.
- **Un Quodom pertenece a un solo rubro** (categoría de primer nivel, `idcategoriapadre = 0`; son 8) y ese rubro es inmutable: una línea de otro rubro se rechaza con 409 `rubro_mismatch`, es la red de seguridad del servidor: la UI rechaza el soltado en el árbol por su cuenta, comparando rubros en el cliente (`arrastre.ts`). **Un rubro puede tener todos los Quodoms en `CREADO` que el usuario quiera** (2026-10-14); ya no existe el tope de uno ni el 409 `rubro_duplicado`. Cada rubro recuerda cuál de los suyos está **abierto**, y ese es el que recibe lo que se agrega de ese rubro. Spec: `docs/superpowers/specs/2026-10-14-multi-quodom-y-arbol-design.md`, que **reemplaza** a `2026-08-18-quodom-por-rubro-design.md` (no la tomes como vigente: describe el tope de uno).
- **"Abierto" es estado del navegador, no del servidor**: `localStorage.quodom.abierto`, un mapa `{idrubro: idquodom}` (`app/src/quodom/quodomAbierto.ts`). Dos pestañas pueden tener abiertos distintos y al backend no le importa; no lo agregues al contrato ni a la base. "Abierto" y "desplegado en el árbol" son **lo mismo a propósito**: un clic, un significado. No introduzcas un "seleccionado" aparte, porque el usuario vería un Quodom a la vista y otro recibiendo, y mandaría la compra al equivocado sin enterarse.
- **Tres caminos para agregar un producto, todos por `agregarProducto.ts`**: `+` va al abierto del **rubro del producto** sin diálogo (tocar `+` en una lavandina mirando pinturería va al abierto de Limpieza); si ese rubro no tiene ninguno abierto aparece **una vez** `DialogoDestino` (los activos del rubro más "un Quodom nuevo") y lo elegido queda abierto; el **clic en el producto** y arrastrar la tarjeta sobre el árbol (sólo escritorio) mandan a **otro** Quodom del mismo rubro y también lo dejan abierto. El clic en el producto es lo que antes hacía el `···`, que ya no existe: un control de 26px y críptico para una decisión deliberada. Como ese clic dejó de abrir la ficha del producto, **la ficha vive adentro de `DialogoDestino`** (imagen, descripción y los atributos con lo que el usuario ya eligió en la tarjeta); un invitado, que tiene un carrito por rubro y ningún destino que elegir, sigue viendo `DetalleProducto`. Arrastrar nunca es obligatorio: todo lo que hace se puede hacer con `+` y con el clic, y en celular no existe. Una marca **por rubro** y no una global: con una global, cruzar de rubro la invalida y vuelve a preguntar cada vez.
- Todo camino de "agregar producto" pasa por `app/src/quodom/agregarProducto.ts` (o el hook `useAgregarProducto`); nunca llamar a `addGuestLine` directo.
  > **Dos excepciones que hoy no pasan por ahí.** `migrarRubro` (`guest/migrateGuestQuodom.ts`) arma su propio Quodom y llama a `quodomLines.add` línea por línea: es la migración de invitado, con su propio manejo de errores (elimina el Quodom a medio crear). `GrupoRubro` (lista subida, hoy apagada en la entrada) también llama a `quodomLines.add` directo, y **ese camino pierde los atributos elegidos**: sólo manda producto, cantidad y nombre, sin `atributo1`/`atributo2`, así que la línea llega sin formato y hay que elegirlo después en el detalle. Es una brecha conocida; el arreglo es usar `agregarAlServidor`, como hace `PanelConversacion`.
- Navegación guest: catálogo, búsqueda y armado del Quodom sin login (**un carrito por rubro** en `localStorage`). El login se exige para enviar por WhatsApp, Mis Quodoms, perfil, direcciones, notificaciones y Modo IA.
- Al loguearse, los carritos de invitado migran rubro por rubro, **siempre a un Quodom nuevo**: ya no hay conflicto de rubro duplicado ni diálogo de integrar / reemplazar / cancelar. Si el usuario quiere unirlo a otro, lo hace después arrastrando. **Nunca se borra un carrito antes de que sus líneas estén confirmadas en el servidor.**
- El flujo termina generando un link `https://wa.me/?text=...` con el detalle y datos de contacto, más un bloque **Datos de empresa** (nombre, CUIT y "Factura A") cuando el usuario los cargó. El bloque aparece con que haya **uno** de los dos, nombre o CUIT: esconderlo entero porque falta el CUIT le saca al proveedor el dato que sí está.
- **El perfil es sólo lo que el proveedor necesita** (2026-10-13): nombre, apellido, mail, teléfono y los datos de facturación. No hay DNI ni usuario, el código de área es fijo en `011` y el teléfono son 8 dígitos. **Se entra con el mail**: la columna `username` sigue existiendo y sigue siendo `NOT NULL` porque las cuentas viejas entran con el suyo, pero el alta la completa con el mail y ni el alta ni el perfil la piden. Las tres reglas las garantiza el servidor, no el formulario — `username`, `dni` y `codArea` **no están declarados** en el cuerpo de `/users/signup` ni de `PUT /users`, y el validador borra todo campo que el contrato no declare.
- **Tres cosas frenan el envío**, y las tres las decide el backend en `GET /quodom/whatsapp/:id`, que es el endpoint que pasa el Quodom a `ENVIADO`: que no tenga productos (400), que **alguna línea no haya elegido el atributo que su producto declara** (409 `falta_atributo`) y que el usuario **no tenga ninguna dirección cargada** (409 `falta_direccion`). La dirección define a qué proveedores les llega el WhatsApp y el atributo es la medida que el proveedor necesita para cotizar; sin eso el pedido no se puede responder. La app deshabilita el botón y muestra el motivo con cómo resolverlo (`app/src/quodom/bloqueosEnvio.ts`, mismo orden de prioridad que el backend), pero **la validación de verdad es la del servidor**: una que viva sólo en el botón se saltea y deja el estado mal.

  > La dirección **no se puede leer de `quodom_headers.iddireccion`**: se copia al crear el Quodom, así que quien no tenía ninguna en ese momento quedaba con `null` para siempre, incluso después de cargarla. `whatsappLink` la resuelve al enviar y la guarda. Y el armado del mensaje tiene un `if (info.Direccion && ...)` que omite el renglón cuando falta: por eso el agujero era invisible — el proveedor recibía el pedido sin domicilio y nadie se enteraba.
- **Atributos de producto:** en `productos`, `atributo1`/`atributo2` guardan el **nombre del grupo** (`"MEDIDAS"`), no un valor; los valores elegibles viven en `productos_atributos.valoratributo`. En `quodom_lines` es al revés: `nombreAtributoN` es el nombre y `atributoN` es **lo que eligió el usuario**. Agrupar por `nombreatributo` y nunca por `idatributo` (el id `3` es `MEDIDAS` en unos productos y `PESO` en otros). Elegir es **opcional**: una línea sin atributo es válida y se completa después en el detalle del Quodom. Spec: `docs/superpowers/specs/2026-08-20-atributos-en-tarjeta-design.md`.
- **El asistente tiene dos personalidades**, y las dos viven dentro del home, no en pantallas propias: el **chat** que repregunta antes de proponer, y la **lista subida** (Excel, CSV, foto, PDF o texto pegado) que matchea cada renglón contra el catálogo, agrupa por rubro y ofrece candidatos cuando un renglón admite varios productos. Confirmar no navega: marca "Agregado ✓" y deja al usuario donde estaba. Specs: `2026-08-20-quodom-web-lista-ia-design.md`, `2026-08-20-ia-en-el-home-design.md`, `2026-08-20-lista-alternativas-design.md`.
- **El Modo IA vive en la URL**, como `/?ia=chat`, y no en estado del componente. Si vive en memoria, el header no puede saber que está abierto, y como el wordmark grande se esconde al abrirlo el usuario queda sin logo y sin forma de volver al inicio. De paso el botón Atrás lo cierra, igual que sale de un rubro. `?ia` y `?rubro` son excluyentes: abrir el chat saca el rubro.
- **"Buscar" está apagado en el menú, no borrado** (2026-09-22): el buscador del home muestra resultados mientras se escribe y llega al mismo lugar. La entrada del `Drawer` está comentada con la nota de cómo revivirla; la pantalla `BusquedaScreen`, la ruta `/busqueda` y `api/busqueda.ts` siguen vivos y **los usa el home** — no borrarlos por "código sin usar".
- **Subir una lista está apagado en la entrada, no borrado** (2026-08-23): el home muestra sólo el botón "Modo IA". El render de `PanelLista` y su test están comentados con la nota que explica cómo revivirlos. `PanelLista`, `LineasAmbiguas`, `CargarLista`, `GrupoRubro`, `NoEncontrados`, `api/lista.ts`, `PestanasIA` y todo el backend siguen vivos y con sus tests corriendo — **no borrarlos por "código sin usar"**.
- **Qué tiene que devolver el chat, más allá de los productos** (2026-09-20/22): la propuesta trae **cantidad y atributo elegido** (`atributo1`/`atributo2` con su `nombreAtributoN` y `opcionesAtributoN`), y la tarjeta los muestra como desplegables editables antes de confirmar. El asistente completa el atributo **sólo cuando se desprende de la conversación** — el formato que sale de su propio cálculo, o lo que el usuario dijo — y deja vacío lo que es preferencia (marca, color): una línea sin atributo es válida. La misma regla vale cuando el gusto está en **productos distintos** y no en atributos (`137 Latex Interior Blanco Mate` contra `138 ... Satinado`): ahí también pregunta en vez de elegir. Y si el catálogo **no tiene** lo que el usuario pidió, lo dice; nunca entrega otra cosa parecida en silencio (ver §8).
- **El panel derecho es un árbol de rubros** (2026-10-14): el padre es el rubro con la cantidad de Quodoms en armado, los hijos son **sólo los `CREADO`** (los `ENVIADO` no están acá), y el abierto de cada rubro muestra sus líneas con `LineasQuodomSidebar` — cantidad, quitar y el `SelectorAtributo` para lo que falta (`Elegir litros`). El abierto es **el destino**, y eso se ve antes de leer nada: es una **tarjeta blanca** con el chip "Recibe lo que agregás" sobre el panel oscuro, y los demás Quodoms del rubro quedan oscuros y compactos. El rubro es un rótulo con línea y su cuenta en gris, no un bloque con un círculo rojo que se leía como alerta. **Entrar a un rubro acomoda el panel para ese rubro**: sube al tope, se resalta, los demás se pliegan, y si tiene **un solo** Quodom se abre ese (ahí "cuál es el destino" no tiene alternativa); con varios no se elige por el usuario, se muestran y decide él. Eso corre **en el cambio de rubro y no en cada render**: si corriera siempre, cerrar a mano el único Quodom lo volvería a abrir en el acto. **"Ver historial"** va en la cabecera y lleva a la pantalla de lo ya enviado, que en el menú es **"Historial de pedidos"**. El botón dice **"Cotizar por WhatsApp"**, lleva el verde de WhatsApp (`--color-whatsapp`), y cuando está bloqueado el motivo **nombra el producto** ("elegí litros en Latex Interior Blanco Mate"). **"Repetí un pedido" ya no vive en el panel sino en la pantalla Mis Quodoms**: en el panel llenaba de cosas que no son el trabajo en curso. Un Quodom no se muda de sección por código: al enviarlo el backend lo pasa a `ENVIADO` y `quodom:changed` recarga, así que sale solo del árbol. Repetir usa `POST /quodom/repetir/:id`, que crea siempre un Quodom nuevo (ya no falla por rubro duplicado). En celular el mismo árbol lo despliega la barra inferior.
- **Confirmar una propuesta no pregunta si el rubro ya tiene un abierto**: aplica la misma regla que `+`, volcando el lote entero con `useDestinoLote`. Con un Quodom abierto en el rubro lo recibe sin diálogo; sin ninguno, `DialogoDestino` ofrece los activos o uno nuevo. `DialogoConflictoRubro` y `DialogoNuevoRubro` ya no existen; si ves referencias, son restos de la regla de uno por rubro.
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
