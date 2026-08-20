# Atributos en la tarjeta de producto — Design Spec

**Fecha:** 2026-08-20
**Estado:** Implementado
**Extiende a:** `2026-08-19-catalogo-en-home-design.md` (la lista de productos
en el home) y `2026-08-18-quodom-por-rubro-design.md` (cómo entra una línea al
Quodom).

## 1. Objetivo

Elegir el atributo de un producto —el talle, los litros, la medida— sólo se
podía hacer **después**, en el detalle del Quodom, con un modal por atributo.
El usuario agregaba "Bolsa de residuos" a ciegas y recién más tarde descubría
que tenía que decir cuál.

Este diseño adelanta esa elección al momento de agregar, dentro de la misma
tarjeta de la lista de productos, sin sumar un paso ni una pantalla.

**Elegir sigue siendo opcional.** Una línea sin atributo es válida y se
completa después desde el detalle del Quodom, como hasta ahora.

## 2. El modelo de datos (la parte que confunde)

Los nombres de las columnas invitan a equivocarse:

| Dónde | Campo | Qué guarda |
|---|---|---|
| `productos` | `atributo1`, `atributo2` | El **nombre del grupo**: `"MEDIDAS"`, `"LITROS"` |
| `productos_atributos` | `valoratributo` | Un **valor elegible**: `"20 litros"` |
| `quodom_lines` | `nombreAtributo1/2` | El nombre del grupo, copiado del producto |
| `quodom_lines` | `atributo1`, `atributo2` | El **valor que eligió el usuario** |

O sea: `productos.atributo1` **no es un valor, es una etiqueta**. Un producto
sin `atributo1` no tiene atributos; uno con `atributo1 = 'TIPO'` tiene un grupo
llamado TIPO cuyos valores hay que buscar en `productos_atributos`.

`quodom_lines.nombreAtributoN` lo escribe el servidor en `add()` copiándolo de
`producto.atributoN`. El cliente no necesita mandarlo, y si lo manda se ignora.

**No agrupar por `idatributo`.** El id se repite entre grupos distintos: `3` es
`MEDIDAS` en unos productos y `PESO` en otros; `4` es `TALLE` y también
`VOLTAJE`. Lo que relaciona una fila de `productos_atributos` con
`producto.atributoN` es el **nombre**, no el id.

### Forma del catálogo (agosto 2026)

- 309 de 644 productos tienen atributos.
- De esos: 267 tienen un grupo, 40 tienen dos, 2 tienen tres o cuatro.
- Valores por grupo: de 1 a 23, la mayoría entre 2 y 7.
- La peor subcategoría son 101 valores / ~1.7 KB de texto.

Ese último número es el que justifica traer los valores junto con la lista en
vez de pedirlos de a uno: el costo es despreciable y evita un modal.

**Los slots 3 y 4 no existen.** `quodom_lines` sólo tiene dos, así que los 2
productos con más de dos grupos exponen únicamente los dos primeros. Es una
limitación heredada del modelo original, no un olvido.

## 3. Contrato de API

`GET /productos/categoria/:idcategoria` suma dos campos a cada producto:

```json
{
  "id": 137,
  "nombreproducto": "Latex Interior Blanco Mate",
  "atributo1": "LITROS",
  "atributo2": "MARCA",
  "valoresAtributo1": ["1 litro", "4 litros", "10 litros", "20 litros"],
  "valoresAtributo2": ["Sherwin Williams", "Alba", "Sinteplast", "..."]
}
```

- Arrays de strings, ordenados por `productos_atributos.orden`.
- Se filtra `esvendedor = '0'`, igual que el `GET /quodom_lines/atributos` que
  ya existía. Quodom Web no tiene vendedores; esos valores no son elegibles.
- Un producto sin atributos devuelve `[]` en ambos, nunca `null`.
- Se resuelven en **una sola consulta para toda la página**, no una por
  producto.

Cambio aditivo: ningún campo existente cambia de forma ni de significado.

**Lo que no cambió, porque ya servía:**

- `POST /quodom_lines/add` ya aceptaba `atributo1` / `atributo2`.
- `findLineaExistente` ya deduplica por producto **y** atributos, tratando
  `null`, `undefined` y `''` como "sin atributo". Dos bolsas de distinto tipo
  son dos líneas; dos iguales suman cantidad.
- `sameLine()` en `guest/guestQuodom.ts` aplica la misma regla en el carrito
  de invitado.
- `GET /quodom_lines/atributos` es público (sin `verifyToken`), así que el
  detalle del Quodom sigue funcionando para invitados.

## 4. La tarjeta

El pie de la tarjeta es una fila: a la izquierda una columna con uno o dos
`<select>`, a la derecha el botón `+` alineado al pie.

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   [ imagen ]     │  │   [ imagen ]     │  │   [ imagen ]     │
│ Cera incolora    │  │ Bolsa de resi-   │  │ Latex Interior   │
│ 5 litros         │  │ duos por 50 u.   │  │ Blanco Mate      │
│              (+) │  │ [TIPO      ▾] (+)│  │ [LITROS    ▾]    │
└──────────────────┘  └──────────────────┘  │ [MARCA     ▾] (+)│
   sin atributos         un atributo:       └──────────────────┘
   como antes            sin altura extra      dos: el + baja
```

Con un atributo **no suma altura**: ocupa el hueco que el `+` dejaba libre.
Sólo los 43 productos de dos grupos ganan una fila.

**Por qué un `<select>` nativo y no un modal.** En un teléfono abre el picker
del sistema operativo, que resuelve gratis las listas de 23 valores; la opción
vacía es "no elegir" sin inventar un botón de limpiar; y es accesible sin
trabajo extra. El modal `SelectorAtributo` sigue existiendo y sigue siendo el
control del detalle del Quodom — no se tocó.

**Estados del control:**

- Sin elegir: muestra el nombre del grupo (`MEDIDAS`) en gris, mayúsculas y
  10px. Se lee como etiqueta, no como un valor ya seleccionado.
- Elegido: muestra el valor en texto normal.
- Volver a la opción vacía **borra** la elección. No es un camino de una sola
  dirección.

**Estado en React.** `Record<idproducto, { atributo1?, atributo2? }>` en
`ListaProductos`, sin persistir: es un borrador de la tarjeta hasta que se
agrega la línea. Se limpia al cambiar de subcategoría, junto con la lista.

El modal `DetalleProducto` hereda la elección sin código extra: su "Agregar al
Quodom" delega en el mismo `agregar()` de la lista.

## 5. Qué queda afuera

- **La búsqueda** (`BusquedaScreen`) no lleva selectores: su endpoint es
  `GET /busqueda`, que devuelve otra forma y no incluye atributos. Lo que se
  agrega desde ahí se completa en el detalle del Quodom.
- **La vista de productos dentro de un Quodom abierto**
  (`GET /productos/categoriaQ/...`) tampoco: es otro controlador y otra query.

Ambas siguen funcionando exactamente como antes.
