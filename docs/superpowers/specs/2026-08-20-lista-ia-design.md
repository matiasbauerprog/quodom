# Lista IA — cargar una lista y cruzarla contra el catálogo

Fecha: 2026-08-20

## Problema

El asistente de Quodom tiene hoy una sola personalidad: el **Modo IA**
(`app/src/screens/ModoIA/`, `api/src/controllers/ia.controller.js`), un asesor
conversacional que repregunta al menos dos veces antes de proponer productos.
Sirve para "tengo que pintar la casa", donde el usuario no sabe qué necesita.

No sirve para el caso opuesto: el usuario **ya sabe qué necesita** y lo tiene
escrito — una planilla de Excel, una foto de una lista a mano, un remito en PDF.
Ahí no hay nada que repreguntar; hay que leer la lista y encontrar esos
productos en el catálogo.

Esta es la segunda personalidad: un **matcher**, no un asesor.

## Alcance

Una pantalla nueva, con su propia entrada, que recibe una lista en cualquiera de
cuatro formas y devuelve productos del catálogo listos para agregar a Quodoms.

Fuera de alcance: repreguntar, calcular rendimientos, sugerir productos que el
usuario no pidió, elegir atributos. Todo eso es el Modo IA de al lado.

## Decisiones de diseño

### Dos entradas separadas, no un chat con adjuntos

El Modo IA queda intacto. La Lista IA es una pantalla propia (`/lista`), con su
propio prompt y su propio controller. Un solo chat que cambiara de
comportamiento según haya adjunto o no dejaría un prompt y un controller
haciendo dos cosas distintas.

Ambas convergen en la misma pantalla de propuesta editable
(`PropuestaEditable.tsx`) y en el mismo flujo de confirmación al Quodom.

### Un solo llamado al modelo con el catálogo entero

Los rubros activos tienen **441 productos**, que serializados como
`{id, nombre, rubro}` pesan ~22 KB (~5,6k tokens). Eso entra cómodo en un
prompt, así que el matching es **un solo llamado**: el modelo ve la lista del
usuario y todos los productos a la vez, que es exactamente lo que hace bien el
matching difuso ("lavandina 5L" → `Lavandina concetrada 5 litros`, con el typo
del catálogo incluido).

Las alternativas descartadas:

- **Extracción + candidatos SQL + resolución** (tres pasos, prompts chicos):
  escala a cualquier catálogo, pero el `LIKE '%texto%'` de
  `busqueda.controller.js` no encuentra "Resma de papel A4 75g" buscando
  "resma A4". Habría que construir matching por tokens primero. Es la
  migración natural **si el catálogo crece mucho**; hoy no hace falta.
- **Clasificar rubros primero y mandar sólo esos productos**: ahorra tokens,
  pero si el clasificador se come un rubro, esos ítems caen en "no encontrados"
  sin que nadie sepa por qué. Un fallo silencioso a cambio de unos pocos miles
  de tokens.

Activar los tres rubros pendientes llevaría el catálogo a 644 productos
(~8k tokens): todavía holgado.

### Multi-rubro: agrupar, no elegir

Una lista real cruza rubros ("100 resmas, 20 lavandinas, 6 packs de agua"), pero
un Quodom pertenece a un solo rubro y es inmutable. La respuesta se **agrupa por
rubro** y el usuario confirma cada grupo por separado, cada uno respetando la
regla de un Quodom abierto por rubro.

El Modo IA conversacional resuelve lo mismo repreguntando por cuál arrancar; acá
no aplica, porque la lista ya está escrita y partirla en varias pasadas sería
trabajo inventado.

### El rubro de un producto se calcula, no se lee

`productos.categoriaPadre` y `categorias.idcategoriapadre` no coinciden en 24 de
los 644 productos, por dos motivos distintos:

- 19 productos de Construcción cuelgan **directo del rubro**: su `categoria` es
  el rubro 4, no una subcategoría. Ahí `categoriaPadre = 4` es correcto y el
  join contra `categorias` es el que devuelve 0.
- 5 productos de la subcategoría "Accesorios" (rubro 8, Seguridad Industrial)
  tienen `categoriaPadre = 1`, Limpieza. Ese dato está mal.

El segundo caso es peligroso porque el rubro 8 está desactivado y el 1 no: si se
filtrara el catálogo por `categoriaPadre` y se agrupara por el join, esos cinco
productos entrarían a la propuesta como Limpieza y terminarían en un Quodom de
un rubro desactivado.

Regla única, usada **tanto para filtrar como para agrupar**: el rubro de un
producto es el `idcategoriapadre` de su categoría, salvo que esa categoría sea
ella misma un rubro (`idcategoriapadre = 0`), en cuyo caso el rubro es el `id`
de la categoría. Vive en `api/src/helpers/catalogoActivo.js` y no se lee nunca
`productos.categoriaPadre`.

Los cinco "Accesorios" quedan así en el rubro 8 (desactivado) y no aparecen en
ninguna propuesta, que es lo correcto: son artículos de seguridad industrial. No
se corrigen los datos acá: `quodom.sqlite` se commitea y un cambio de datos no
se revisa en el diff (CLAUDE.md §6).

### Sin multer y sin archivos en disco

`express.json` ya acepta 50 MB (`api/src/server.js:13`), así que el archivo
viaja como base64 dentro del JSON. No hace falta multer.

El archivo **no se persiste**: vive en memoria durante el request y se descarta.
No va a `uploads/` ni a la base. Una foto con datos personales no queda en
ningún lado.

### El helper de Gemini no se toca

`callGemini` recibe `contents` ya armado por el caller y lo pasa tal cual al API
(`api/src/helpers/gemini.js:52`). Para mandar una imagen o un PDF alcanza con
que el controller construya
`parts: [{ inlineData: { mimeType, data } }, { text }]`. La cadena de fallback
entre modelos, los reintentos y el deadline se heredan gratis.

## Arquitectura

### Endpoint

`POST /api/ia/lista`, en `ia.route.js`, detrás de `auth.verifyToken()` y
`rateLimit.perUserPerMinute` igual que el chat. Comparte el contador diario
`ia_usage`: una carga cuenta como un mensaje.

Request:

```
{ tipo: 'texto' | 'archivo',
  texto?: string,                                  // texto pegado
  archivo?: { nombre, mime, datosBase64 } }        // xlsx/xls/csv/jpg/png/pdf
```

Response:

```
{ res: true,
  grupos: [ { idrubro, rubro, items: [{ textoOriginal, idproducto, nombreProducto, cantidad }] } ],
  noEncontrados: [ { textoOriginal, motivo } ],
  lineasIgnoradas: 0 }
```

### Módulos

**`api/src/helpers/catalogoActivo.js`** — devuelve los productos de rubros
activos con su rubro ya resuelto (`{ id, nombre, idrubro, rubro }`), aplicando la
regla de arriba. Es la única fuente de rubro para filtrar y para agrupar.

**`api/src/helpers/listaEntrada.js`** — la única pieza que sabe de formatos.
Normaliza la entrada a lo que va al modelo:

- `.xlsx` / `.xls` / `.csv`: se parsean en memoria con `xlsx.read(buffer)` (la
  librería ya es dependencia de la API, la usa el seed) y salen como texto plano
  línea por línea (`3 x Lavandina 5L`).
- `.jpg` / `.png` / `.pdf`: salen como `inlineData` (`mimeType` + base64).
- Texto pegado: sale tal cual.

Se testea sola con archivos de fixture.

**`api/src/controllers/lista.controller.js`** — arma el prompt con los productos
de rubros activos, hace **un** `callGemini` con `responseSchema`, valida y
agrupa. Nunca confía en la salida del modelo: un `idproducto` que no está en el
índice real cae en `noEncontrados`, no en la propuesta.

**`api/src/helpers/iaErrores.js`** — el mapeo de fallos de Gemini a respuestas
HTTP (`ia_quota` 429, `ia_busy` 503, `ia_unavailable` 500) hoy está escrito
adentro del handler de `/chat` (`ia.route.js:47-58`). Se extrae acá para que las
dos rutas lo compartan en vez de duplicarlo.

**`app/src/screens/ListaIA/`** — pantalla nueva en `/lista` (protegida), con
entrada propia en el drawer. Reusa `PropuestaEditable` una vez por grupo y el
flujo de confirmación de `ModoIA.tsx:104`.

**`app/src/api/lista.ts`** — cliente tipado del endpoint.

### Esquema de respuesta del modelo

```
{ items: [{ textoOriginal, idproducto, cantidad }],
  noEncontrados: [{ textoOriginal, motivo }] }
```

El system prompt le prohíbe tres cosas:

1. Inventar ids o nombres: sólo los de la lista provista.
2. Agregar productos que el usuario no pidió. No hay "esto también te puede
   servir" — eso es trabajo del Modo IA.
3. Descartar líneas en silencio: **toda** línea de la entrada tiene que salir en
   `items` o en `noEncontrados`.

El server verifica esa cobertura: lo que no aparezca en ninguna de las dos
listas se agrega a `noEncontrados`.

Si una línea no trae cantidad, la cantidad es 1.

## Flujo de datos

1. La pantalla ofrece un `<input type="file">` y un `<textarea>` para pegar.
2. El front valida **antes de mandar**: extensión permitida y tamaño ≤ 5 MB, y
   lee el archivo a base64 con `FileReader`. Un archivo de 20 MB se rechaza en
   el navegador, no después de treinta segundos de espera.
3. `POST /api/ia/lista`.
4. `listaEntrada.js` normaliza; el controller arma el prompt y llama a Gemini.
5. El controller valida los ids contra el índice, resuelve el rubro de cada
   producto y agrupa.
6. Tope de 150 líneas por carga. Se aplica en dos momentos distintos según el
   formato: en texto y planilla las líneas se cuentan **antes** del llamado y se
   recorta ahí, porque contarlas es trivial y así el prompt no crece de más. En
   foto y PDF no hay líneas contables hasta que el modelo lee la imagen, así que
   el recorte se aplica **después**, sobre `items` + `noEncontrados`. En los dos
   casos el sobrante se informa en `lineasIgnoradas`.
7. El front renderiza una sección por rubro más el bloque de no encontrados.

## La pantalla de resultado

Una sección por rubro, con su título ("Limpieza — 6 productos") y su
`PropuestaEditable`, que ya sabe editar cantidades y quitar líneas. Debajo de
todo, el bloque de **no encontrados** con el texto original de cada ítem y el
motivo, para que el usuario vea qué quedó afuera y pueda buscarlo a mano.

Cada grupo se confirma **por separado y sin navegar**:

- Si hay un Quodom abierto de ese rubro, las líneas van ahí.
- Si no hay, aparece `DialogoNuevoRubro` para que el usuario acepte crearlo.
  Nunca se crea un Quodom como efecto secundario.
- El grupo confirmado queda marcado *"Agregado ✓ — ver Quodom"* y la pantalla se
  queda donde está, así los otros rubros siguen a la vista.

Ésa es la diferencia con el Modo IA, que navega al confirmar porque siempre
tiene un solo grupo.

Las líneas se crean **sin atributo elegido**, que es válido: el detalle del
Quodom ya es donde se completan las MEDIDAS o el color.

## Errores y límites

Regla de fondo: nada se descarta en silencio, y un problema parcial no tira
abajo el resultado. Los grupos que sí matchearon se muestran igual.

| Situación | Respuesta |
|---|---|
| Extensión no permitida o > 5 MB | El front lo corta antes de mandar; el server igual valida: `400 formato_no_soportado` / `400 archivo_muy_grande` |
| Excel corrupto, PDF ilegible | `400 archivo_ilegible` — "No pude abrir el archivo. Probá exportarlo de nuevo o pegá la lista como texto." |
| Foto borrosa: el modelo no lee nada | Respuesta normal con `grupos: []` y todo en `noEncontrados`; la pantalla sugiere sacar otra foto o pegar el texto |
| Más de 150 líneas | Se procesan las primeras 150 y se informa cuántas quedaron afuera en `lineasIgnoradas`. No se trunca callado (ver abajo) |
| Ítem de un rubro desactivado | Cae en `noEncontrados` con motivo "no está en el catálogo", igual que un id inventado. El producto nunca estuvo en la lista que vio el modelo, así que para el server los dos casos son el mismo: un id que no está en el índice. No se distinguen, porque distinguirlos obligaría a consultar productos que el usuario no puede comprar |
| Gemini 429 / 5xx / timeout | `429 ia_quota` / `503 ia_busy` / `500 ia_unavailable`, vía `iaErrores.js` |
| Límite diario alcanzado | `429 limit_exceeded`, compartido con el chat vía `ia_usage` |

## Testing

**API** — integración con SQLite real (sin mocks de base), `callGemini`
mockeado, siguiendo el patrón de `tests/ia.controller.test.js:1`.

`listaEntrada.js`, unitario con fixtures:

- xlsx y csv se convierten a líneas de texto
- texto pegado pasa tal cual
- archivo corrupto lanza el error esperado
- imagen y PDF producen `inlineData` bien formado

`catalogoActivo.js`:

- un producto de una subcategoría toma el rubro del padre
- un producto cuya categoría es el rubro mismo toma esa categoría como rubro
- un producto de rubro desactivado no aparece
- un producto cuyo `categoriaPadre` contradice a `categorias` se resuelve por
  `categorias` (el caso de los cinco "Accesorios")

`lista.controller.js`:

- un `idproducto` inventado por el modelo cae en `noEncontrados`
- una línea de la entrada que el modelo omite aparece en `noEncontrados`
  (chequeo de cobertura)
- la agrupación por rubro es correcta para una lista multi-rubro
- un producto de rubro desactivado nunca aparece en un grupo
- el catálogo enviado en el prompt contiene sólo rubros activos
- una línea sin cantidad queda en 1
- planilla de más de 150 líneas: se recorta antes del llamado y `lineasIgnoradas`
  refleja el resto
- foto que devuelve más de 150 ítems: se recorta después del llamado y
  `lineasIgnoradas` refleja el resto

Endpoint:

- requiere auth
- respeta el rate limit por minuto y el límite diario
- devuelve los 400 de formato
- mapea los fallos de Gemini a 429 / 503 / 500

**Front** — vitest + testing-library:

- renderiza N grupos y el bloque de no encontrados
- confirmar el grupo 1 no navega, lo marca "Agregado ✓", y el grupo 2 sigue
  confirmable
- sin Quodom abierto de ese rubro aparece `DialogoNuevoRubro` y no se crea nada
  hasta aceptar
- rechaza tamaño y extensión inválidos antes de mandar
- muestra el aviso de líneas ignoradas cuando `lineasIgnoradas > 0`

## Configuración

Variables nuevas, todas con default:

- `IA_LISTA_MAX_FILE_MB` (5)
- `IA_LISTA_MAX_LINEAS` (150)

El modelo y la cadena de fallback se heredan de las variables que ya usa el chat.
