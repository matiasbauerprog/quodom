# Quodom por rubro — Design Spec

**Fecha:** 2026-08-18
**Estado:** Aprobado en diseño, pendiente de plan de implementación
**Extiende a:** `2026-07-12-quodom-web-design.md` (§4.3 navegación guest) y `2026-07-15-quodom-modo-ia-design.md`.

## 1. Objetivo

Un Quodom es un presupuesto de **un solo rubro**. Hoy no existe esa noción: un
Quodom acepta productos de cualquier categoría y el usuario tiene un único
"Quodom activo" donde cae todo lo que agrega.

Este diseño introduce dos invariantes de dominio y el flujo que las hace usables:

1. **Un Quodom pertenece a exactamente un rubro**, fijado al crearlo e inmutable.
2. **Como máximo un Quodom abierto (`estado = 'CREADO'`) por usuario y rubro.**

Consecuencia para el usuario: si tiene un Quodom abierto de Bebidas y agrega un
producto de Construcción, el sistema le avisa que no se pueden mezclar y le
ofrece crear un Quodom de Construcción. Si ya tenía uno abierto de Construcción,
el producto va ahí sin preguntar nada.

Además, el sidebar "Mis Quodoms" pasa a mostrar **todos** los Quodoms abiertos y
a actualizarse en tiempo real cuando se agrega un producto.

## 2. Alcance de "rubro"

Rubro = categoría de primer nivel (`categorias.idcategoriapadre = 0`). Son 8:
Limpieza (1), Librería (2), Papelera (3), Construcción (4), Pintura (5),
Sanitarios (6), Bebidas (7), Seguridad Industrial (8).

Las 50 subcategorías **no** particionan Quodoms: dentro de Construcción se pueden
mezclar Cementos y Ladrillos libremente.

El rubro de un producto ya está materializado en la base: `productos.categoriaPadre`
contiene el id del rubro, y `quodom_lines.categoriaPadre` se llena en cada alta
(`quodom_lines.controller.js:46`). Validar el rubro de un producto es leer una
columna — no hace falta ningún join.

## 3. Modelo de datos

### 3.1 Columna nueva

`quodom_headers.idrubro` — `INTEGER, allowNull: false`. Se fija al crear el
Quodom y no se modifica nunca. `PUT /quodom/:id` la ignora explícitamente.

### 3.2 Vista

`v_Quodoms` (definida en `api/src/helpers/views.js`) suma dos columnas:

- `idrubro` — de `quodom_headers`.
- `nombrerubro` — `LEFT JOIN categorias c ON c.id = q.idrubro`, para que el
  sidebar y Mis Quodoms etiqueten sin pedir el catálogo aparte.

### 3.3 Rubro en los resultados de búsqueda

`v_Busquedas` no expone hoy ninguna categoría, así que la pantalla de búsqueda no
puede saber el rubro de lo que agrega. Se le suma `p.categoriaPadre`, y el tipo
`BusquedaResult` del frontend la incluye. Sin esto, agregar desde el buscador no
puede decidir a qué Quodom va.

### 3.4 Estado inicial de la base

Se vacían **únicamente** `quodom_headers` y `quodom_lines`. Usuarios, catálogo,
direcciones, notificaciones, historial de búsquedas y contadores de IA quedan
intactos. No se escribe script de migración de Quodoms viejos: los existentes son
de prueba y se descartan.

`model.sync()` no altera tablas ya creadas, así que el drop no ocurre solo. Se
agrega un script `npm run reset-quodoms` (en `api/src/seed/`) que borra esas dos
tablas y deja que `sync()` las recree con la columna nueva. Es un paso manual y
explícito del despliegue de este cambio, no algo que corra al arrancar el server.

## 4. Reglas en el backend

El backend es la autoridad. El frontend valida antes de llamar para poder mostrar
el cartel, pero nunca es la única barrera.

### 4.1 Crear

`POST /quodom/create` pasa a exigir `idrubro` (entero, requerido, validado por Joi).

- Si ya existe un Quodom del usuario con ese `idrubro` y `estado = 'CREADO'`,
  responde **409 `rubro_duplicado`** con el mensaje "Ya tenés un Quodom abierto de
  <rubro>." y el id del existente, para que el frontend pueda llevar al usuario ahí.
- Los Quodoms `ENVIADO` no bloquean: cerrado un Quodom de Bebidas, se puede abrir
  otro de Bebidas.

### 4.2 Agregar línea

`POST /quodom_lines/add` valida, después de resolver el producto y antes de crear
la línea, que `producto.categoriaPadre === quodom.idrubro`. Si no coincide,
responde **409 `rubro_mismatch`** con ambos nombres de rubro en el mensaje.

### 4.3 Resolver el Quodom abierto de un rubro

`POST /quodom/getLastQuodom/` se reemplaza por **`GET /quodom/activo/:idrubro`**,
que devuelve el Quodom `CREADO` de ese rubro o `null`.

**No crea nada.** Es el cambio de contrato más importante de este spec: como
crear un Quodom ahora requiere confirmación explícita del usuario, crear no puede
seguir siendo un efecto secundario de consultar. `getLastQuodomOrCreate` en el
controller queda reducido a `getActivoPorRubro`.

### 4.4 Repetir

`POST /quodom/repetir/:id` hereda el `idrubro` del original. Si el usuario ya
tiene uno abierto de ese rubro, responde el mismo 409 `rubro_duplicado`.

## 5. Alta de producto en el frontend

`agregarProducto(producto)` (en `app/src/quodom/agregarProducto.ts`) pasa a:

1. Tomar el rubro del producto (`producto.categoriaPadre`).
2. Buscar el Quodom abierto de ese rubro.
3. **Si existe:** agrega la línea y termina. Sin carteles, sin fricción.
4. **Si no existe:** no agrega nada y devuelve `{ necesitaConfirmacion: true, rubro }`.

En el caso 4 la pantalla muestra un diálogo:

> **No se pueden mezclar rubros**
> Este producto es de **Construcción** y tu Quodom abierto es de **Bebidas**.
> [ Crear Quodom de Construcción ] [ Cancelar ]

Al confirmar: `create({ idrubro })` seguido del alta de la línea. Si el usuario no
tenía ningún Quodom abierto, el diálogo es el mismo pero sin la frase comparativa.

El botón "Nuevo" de Mis Quodoms pasa a pedir el rubro, ofreciendo únicamente los
que el usuario no tiene abiertos.

## 6. Invitado

El carrito de `localStorage` pasa de un objeto único a un mapa indexado por rubro:

```
{ [idrubro]: { descripcion, lines: [...] } }
```

El invitado ve el mismo diálogo de confirmación que el usuario logueado, de modo
que la experiencia es idéntica antes y después del login.

`migrateGuestQuodom()` deja de crear un Quodom y pasa a recorrer el mapa rubro
por rubro:

- **Rubro sin Quodom abierto:** se crea el Quodom con ese `idrubro` y sus líneas,
  sin preguntar nada.
- **Rubro con un Quodom abierto:** no se puede crear otro (invariante 2), así que
  **se le pregunta al usuario qué hacer con ese rubro**:
  - **Integrar** — las líneas del invitado se suman al Quodom abierto. Si un
    producto ya estaba con los mismos atributos, se suman las cantidades (misma
    regla que `sameLine` en `guestQuodom.ts`). Es la opción por defecto.
  - **Reemplazar** — se descarta el Quodom abierto **entero** (se borra el Quodom
    y sus líneas, vía `DELETE /quodom/:id`, que ya destruye header y líneas cuando
    el estado es `CREADO`) y se crea uno nuevo con las líneas del invitado. El
    Quodom resultante tiene id, número y fecha nuevos.
  - **Cancelar** — ese rubro no se migra y su carrito queda intacto en
    `localStorage`, para no perder nada.

La pregunta se hace una vez **por rubro en conflicto**, en el momento del login y
antes de navegar. Los rubros sin conflicto se migran igual, sin esperar respuesta.

Reemplazar es destructivo e irreversible: el diálogo dice qué Quodom se va a
descartar (número, rubro y cantidad de productos) antes de confirmar.

Esto refina §4.3 del spec de 2026-07-12 ("si el usuario ya tenía Quodoms, el de
invitado se agrega como uno más"), que fue escrito cuando no existía la regla de
un Quodom por rubro.

## 7. Sidebar en tiempo real

`MisQuodomsSidebar` pasa de "Quodom activo" en singular a **"Quodoms activos"**:
la lista de todos los `CREADO`, cada uno con su rubro y su cantidad de productos.
Debajo sigue la sección de últimos Quodoms enviados.

La actualización en tiempo real usa el evento `quodom:changed` que ya existe y que
`agregarProducto()` ya emite en cada alta; el sidebar simplemente no lo escuchaba.
Se agrega la emisión también al crear, eliminar y enviar un Quodom, de modo que
toda mutación de Quodoms refresque el sidebar.

### 7.1 Barra inferior

`BarraQuodomInferior` hoy muestra un contador único y linkea al Quodom activo.
Pasa a ser el acceso a **todos** los Quodoms abiertos, y deja de ser un link para
ser un desplegable:

- **Colapsada:** dice "Mis Quodoms activos" con la cantidad de Quodoms abiertos.
- **Al tocarla:** se despliega hacia arriba un panel con la lista de Quodoms
  abiertos — rubro, descripción y cantidad de productos — y cada ítem linkea a su
  detalle. Se cierra tocando la barra de nuevo, tocando fuera del panel o con
  Escape.

La barra aparece cuando hay al menos un Quodom abierto (para el invitado, al
menos un carrito con líneas) y se refresca con `quodom:changed`, igual que el
sidebar: agregar un producto actualiza el contador y la lista en el acto.

El panel es un elemento propio (`PanelQuodomsActivos`), no una reimplementación
del sidebar: el sidebar es la vista de escritorio y ésta la de mobile, pero
ambos consumen la misma lista de Quodoms abiertos.

### 7.2 Detalle del Quodom de invitado

Con el carrito de invitado partido por rubro, `/quodom` sin parámetros deja de
ser suficiente. La ruta del invitado pasa a ser `/quodom?rubro=<idrubro>`, que es
la que arman los ítems del panel de la barra inferior. `/quodom` pelado, para un
invitado con más de un carrito, muestra la lista de sus carritos por rubro para
que elija.

### 7.3 Alcance de la sincronización

Alcance deliberado: esto sincroniza la pestaña actual. No hay polling ni
websockets — dos pestañas abiertas en paralelo quedan fuera de alcance (el evento
`storage`, que el sidebar también puede escuchar, cubre parcialmente el caso del
invitado porque su carrito vive en `localStorage`).

## 8. Modo IA

El clasificador de intención pasa a devolver `{ idrubro, idsSubcategoria }`, con
las subcategorías restringidas al rubro elegido. El prompt se ajusta para que,
cuando el mensaje del usuario abarque varios rubros, el asistente **repregunte por
cuál arrancar** en vez de mezclar.

La confirmación de la propuesta usa el mismo camino que el catálogo: busca el
Quodom abierto de ese rubro, y si no hay, pide confirmación antes de crearlo. Deja
de crear un Quodom nuevo en cada confirmación.

## 9. Manejo de errores

| Código | `error` | Cuándo | Mensaje al usuario |
|---|---|---|---|
| 409 | `rubro_mismatch` | El producto no es del rubro del Quodom | "No se pueden mezclar rubros: este producto es de <A> y el Quodom es de <B>." |
| 409 | `rubro_duplicado` | Ya hay un Quodom abierto de ese rubro | "Ya tenés un Quodom abierto de <rubro>." |

Ambos incluyen los nombres de rubro resueltos en el backend, para que el frontend
no tenga que pedir el catálogo sólo para armar el mensaje. `rubro_duplicado`
incluye además el `idquodom` existente.

El frontend nunca depende de estos 409 para el flujo normal — consulta el Quodom
abierto antes de actuar. Los 409 cubren la carrera entre dos pestañas y cualquier
cliente que no valide.

## 10. Testing

**API** (integración con SQLite real en memoria, sin mocks de base):

- `create` con `idrubro` faltante → 400.
- `create` dos veces el mismo rubro con uno abierto → 409 `rubro_duplicado`.
- `create` del mismo rubro con el anterior en `ENVIADO` → 200.
- `lines/add` de un producto de otro rubro → 409 `rubro_mismatch`, y la línea no
  se crea.
- `lines/add` de un producto del mismo rubro → 200.
- `GET /quodom/activo/:idrubro` devuelve el abierto, y `null` cuando no hay, sin
  crear ningún Quodom (se verifica contando filas antes y después).
- `repetir` de un rubro ya abierto → 409.

**Frontend** (vitest):

- `agregarProducto` con Quodom abierto del rubro → agrega, sin confirmación.
- `agregarProducto` sin Quodom de ese rubro → no agrega nada y pide confirmación.
- Confirmar → crea con el `idrubro` correcto y después agrega.
- Carrito de invitado: dos rubros conviven en el mapa sin pisarse.
- `migrateGuestQuodom` con dos rubros sin conflicto → crea dos Quodoms.
- `migrateGuestQuodom` con un rubro ya abierto → pregunta; "integrar" suma las
  líneas (y las cantidades de un producto repetido), "reemplazar" borra el Quodom
  anterior y crea uno nuevo con id distinto y sólo las líneas del invitado,
  "cancelar" no toca nada y el carrito sigue en `localStorage`.
- El sidebar recarga al recibir `quodom:changed`.
- La barra inferior despliega la lista de Quodoms abiertos y la actualiza al
  recibir `quodom:changed`.

## 10.1 Desviaciones decididas durante la implementación

Registradas acá para que el spec no mienta sobre lo que se construyó. Estado y
pendientes completos en `docs/superpowers/ESTADO-quodom-por-rubro.md`.

- **§5, el diálogo no muestra la frase comparativa.** "…y tu Quodom abierto es de
  X" se descartó: habría costado una consulta extra para servir una sola cláusula,
  y el título quedó como "Creá un Quodom de <rubro>", que es cierto tanto con cero
  Quodoms como mezclando rubros. El texto anterior afirmaba una mezcla incluso
  cuando no la había.
- **Spec de 2026-07-12 §4.3, envío por WhatsApp sin sesión.** Deja de auto-enviar:
  ahora es enviar → login → aterrizar en el Quodom migrado → enviar de nuevo. Con
  carritos de varios rubros, "enviar" ya no corresponde a un solo Quodom.
- **§4.1 agrega una validación que el spec no pedía:** `create` verifica que el
  `idrubro` sea realmente un rubro (`idcategoriapadre = 0`) y responde 400
  `idrubro_invalido` si no. Sin eso, un id de subcategoría creaba un Quodom al que
  ningún producto podía entrar nunca.
- **§4.1 se refuerza con un índice único parcial** sobre `(createdBy, idrubro)
  WHERE estado = 'CREADO'`. El chequeo de aplicación es check-then-create, así que
  dos pestañas simultáneas podían abrir dos Quodoms del mismo rubro. La violación
  del índice se traduce al mismo 409 `rubro_duplicado`.
- **§6, "integrar" suma cantidades del lado del servidor**, no del cliente:
  `quodom_lines/add` fusiona con la línea existente cuando coinciden producto y
  atributos. Así queda arreglado para todos los llamadores, incluido el "+" del
  catálogo.

## 11. Fuera de alcance

- Mover líneas de un Quodom a otro.
- Cambiar el rubro de un Quodom existente.
- Sincronización entre pestañas o dispositivos.
- Migración de los Quodoms actuales (se descartan, ver §3.3).
