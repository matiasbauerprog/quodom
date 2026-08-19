# Catálogo en el home — Design Spec

**Fecha:** 2026-08-19
**Estado:** Aprobado en diseño, pendiente de plan de implementación
**Extiende a:** `2026-07-12-quodom-web-design.md` (§4 navegación) y
`2026-08-18-quodom-por-rubro-design.md` (el rubro como contexto del Quodom).

## 1. Objetivo

Hoy recorrer el catálogo cuesta tres pantallas encadenadas, cada una con su
header, su carga y su ruta:

```
/               SitioInicial          → grilla de rubros
/categoria/:id  SubcategoriaLista     → grilla de subcategorías
/subcategoria/:id ProductosPorCategoria → lista de productos
```

El catálogo es chico —5 rubros habilitados, 50 subcategorías, 644 productos— y
no justifica esa cadena. Además el rubro, que es *el* concepto del producto
(un Quodom pertenece a un solo rubro), desaparece de la vista justo cuando el
usuario está eligiendo productos.

Este diseño mueve el recorrido entero al home: elegir un rubro lo deja marcado
y despliega las subcategorías como tabs; elegir una tab lista sus productos,
todo en la misma pantalla. El rubro elegido queda siempre visible mientras se
arma el Quodom.

Además **desaparece la búsqueda**: con cinco rubros y las subcategorías a un
clic, dejó de tener razón de ser.

## 2. Contrato de URL

Todo vive en `/` y el estado de navegación vive en la query string. Esto no es
un detalle de implementación: es lo que preserva el botón Atrás (crítico en
Android, donde un Atrás sin historial saca de la app), compartir un link y
sobrevivir a un F5.

| URL | Qué se ve |
|---|---|
| `/` | Home completo: wordmark, botón Modo IA, los rubros sin selección |
| `/?rubro=7` | Estado transitorio: se normaliza a `/?rubro=7&sub=<primera>` |
| `/?rubro=7&sub=70` | Header compacto, rubro marcado, tabs, productos de la sub |

**Normalización.** Cuando llega `rubro` sin `sub`, apenas responden las
subcategorías se reescribe la URL con la primera, usando `replace: true` para
no dejar una entrada intermedia en el historial que haga que el Atrás parezca
no hacer nada.

**Parámetros inválidos** (URL a mano, link viejo, rubro que se apagó en
`api/src/config/rubros.js`):

- `rubro` que no está entre los que devuelve `GET /categorias` → se limpia a `/`.
- `sub` que no pertenece al rubro → cae a la primera subcategoría del rubro.

Ninguno de los dos casos muestra un error: el catálogo cambia con los rubros
habilitados y un link viejo tiene que degradar, no romper.

**Rutas viejas.** La app está deployada, así que no quedan URLs muertas:

- `/categoria/:id` → `/?rubro=:id` (redirect directo, `replace`)
- `/subcategoria/:id` → resuelve el padre con `GET /categorias/:id` y redirige a
  `/?rubro=<idcategoriapadre>&sub=:id`

## 3. Comportamiento de la pantalla

### 3.1 Header

Sin rubro elegido el home es el de siempre menos el buscador: wordmark QUODOM,
botón de Modo IA y la fila de rubros.

Con un rubro elegido el bloque de arriba **se compacta**: se ocultan el wordmark
y el botón de Modo IA, y quedan la fila de rubros (con el elegido marcado), las
tabs y la lista. En un teléfono eso deja el primer producto cerca del borde
superior sin scrollear.

**Deseleccionar:** volver a tocar el rubro marcado navega a `/` y devuelve el
home completo. El Atrás del navegador hace lo mismo, porque cada selección es
una entrada de historial.

Como el header compacto esconde el botón de Modo IA, el `Drawer` gana una
entrada **Modo IA**, en el lugar que deja la entrada **Buscar** que se va con la
búsqueda. Así la función queda siempre a un toque, sin importar en qué estado
esté el home.

### 3.2 Rubros y tabs son links, no botones

Cada selección se renderiza como `<Link to="/?rubro=7">` / `<Link
to="/?rubro=7&sub=70">`, no como un `<button>` con `onClick`. Con eso:

- cada selección es una entrada de historial real y el Atrás funciona solo;
- andan el clic derecho, "abrir en pestaña nueva" y copiar el link;
- no hay estado de componente que sincronizar con la URL: la URL **es** el estado.

La marca de selección va con `aria-current="page"`, y la tira de subcategorías
scrollea horizontalmente (los rubros con más subcategorías no entran en el ancho
de un teléfono).

### 3.3 Datos

| Qué | Cuándo | Endpoint |
|---|---|---|
| Rubros | Una vez, al montar | `GET /categorias` |
| Subcategorías | Al cambiar `rubro` | `GET /categorias/Sub/:rubro` |
| Productos | Al cambiar `sub` | `GET /productos/categoria/:sub` |

Cada carga mantiene lo que ya hace cada pantalla hoy: guard `alive` en el efecto
para descartar respuestas de una selección abandonada, `Loader` mientras carga y
`ErrorState` con retry si falla. Sin caché en memoria: son 644 productos contra
una SQLite local y agregar invalidación es complejidad que no se paga.

Los tres fetch son independientes: un error cargando productos no borra las tabs
ni la fila de rubros.

## 4. Estructura de componentes

`SitioInicial` pasa de pantalla monolítica a orquestador: lee `rubro` y `sub` de
`useSearchParams`, decide header completo o compacto, y compone.

| Componente | Responsabilidad | De dónde sale |
|---|---|---|
| `SitioInicial` | Lee la URL, normaliza, compone | Existente, adelgazado |
| `RubroSelector` | Fila de rubros con estado seleccionado | La `.cat-grid` actual |
| `SubcategoriaTabs` | Tira horizontal de subcategorías | Reemplaza `SubcategoriaLista` |
| `ListaProductos` | Lista, modal de detalle, agregar al Quodom | Cuerpo de `ProductosPorCategoria` |

`ListaProductos` se lleva tal cual el `DetalleProducto` modal, el hook
`useAgregarProducto` y el `DialogoNuevoRubro`: el camino de "agregar producto"
no cambia en nada, sigue pasando por `agregarProducto.ts` como manda el
CLAUDE.md.

**Se borran:** `SubcategoriaLista.tsx`, `ProductosPorCategoria.tsx`,
`BusquedaScreen.tsx`, `MasBuscados.tsx` y sus CSS.

## 5. Baja de la búsqueda

Sale del frontend, completa:

- la ruta `/busqueda` y `BusquedaScreen`;
- el formulario de búsqueda del home (`.home-search*` en `SitioInicial.css`);
- el link **Buscar** del `Drawer`, que pasa a ser **Modo IA** (§3.1);
- `MasBuscados`, que ya no se renderiza y se alimentaba del historial de búsquedas;
- los clientes `api/busqueda.ts` y `api/hist_busquedas.ts` quedan sin consumidores
  y se borran con sus pantallas.

**El backend no se toca.** `GET /busqueda` y `/hist_busquedas` quedan en pie con
sus tests: no molestan a nadie, y borrarlos es un cambio de riesgo propio sin
ganancia. Si la búsqueda vuelve, vuelve contra los mismos endpoints.

## 6. Tests

Frontend (vitest + testing-library), sobre el home:

1. Sin params: se ven los 5 rubros, no hay tabs ni lista de productos.
2. Elegir un rubro: la URL queda `?rubro=7&sub=<primera>` y se piden los
   productos de esa subcategoría.
3. Cambiar de tab: cambia `sub` en la URL y la lista de productos.
4. Entrar directo a `/?rubro=7&sub=70`: pinta rubro marcado, tabs y productos
   sin pasar por el home vacío.
5. `?rubro=999` (inexistente o apagado): vuelve a `/` sin mostrar error.
6. `?rubro=7&sub=999` (sub de otro rubro): cae a la primera sub del rubro.
7. Con rubro elegido, el wordmark no está en pantalla; tocar el rubro marcado
   vuelve a `/` y lo trae de nuevo.
8. Agregar un producto desde la lista: el test de `ProductosPorCategoria` se muda
   a `ListaProductos` sin cambiar lo que verifica.

No se agregan tests de API: el backend no cambia.

## 7. Fuera de alcance

- Buscar dentro de una subcategoría o filtrar la lista.
- Caché de subcategorías o productos entre selecciones.
- Cambios en el Modo IA, que sigue siendo su propia pantalla.
- Borrar los endpoints de búsqueda del backend.
