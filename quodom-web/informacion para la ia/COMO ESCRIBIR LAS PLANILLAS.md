# Cómo escribir las planillas de cada rubro

Esto es lo que el asistente lee para armar un presupuesto. Una carpeta por rubro,
y dentro un archivo `Listado_*.xlsx`. Después de tocar cualquier planilla hay que
correr **`npm run guias`** dentro de `quodom-web/api/`, si no la API sigue usando
la versión anterior sin avisar.

De cada archivo se usan:

- las hojas de **ejemplo** (una por caso: "Restaurant 50p", "Casa 150m2"…),
- la hoja **`Supuestos`**.

Se ignoran la hoja `Pendientes` y los archivos `<Rubro>.xlsx`, que repiten el
catálogo que ya sale de la base.

## La división que importa

**En los ejemplos va QUÉ comprar. En los supuestos va CUÁNTO.**

Un ejemplo muestra el mix: un restaurant lleva bandejas de cartón y portapanchos,
una oficina lleva resmas y toner. Eso no se calcula, se muestra.

Los supuestos llevan las reglas para calcular. "Un litro de látex rinde 10 m² por
mano" sirve para 40 m², para 150 y para 800. Sin esa frase el asistente no tiene
con qué calcular y copia los números del ejemplo que tenga más a mano.

Por eso **no hacen falta ejemplos para cada tamaño**. Con un ejemplo por *tipo* de
caso, más las reglas por unidad, cualquier tamaño sale calculado. Si hicieran
falta ejemplos para cada combinación de tipo y tamaño, no terminarían nunca.

## Los ejemplos

Al menos **dos por rubro, de tamaños claramente distintos**. Medido sobre un caso
que no coincidía con ninguna referencia: sin ejemplos el asistente proponía 7
productos y se olvidaba el esmalte de las aberturas; con **uno** solo copiaba su
escala (pedía 2 bandejas y 2 cintas para un departamento que lleva 1 de cada
una); con **dos** de distinto tamaño interpola y llega a 17 productos correctos.

Formato que funciona, el que ya usan las planillas:

| Categoría | Producto | Formato / Detalle | Cantidad sugerida |
|---|---|---|---|

Dos ejemplos del mismo tipo y distinto tamaño enseñan a escalar. Dos de tipos
distintos (restaurant y oficina) enseñan el mix. Idealmente hay de los dos.

## Las cinco cosas que van en `Supuestos`

**1. Qué preguntar.** El dato con el que se calcula todo lo demás: metros
cuadrados, cantidad de personas, comensales por día, cantidad de baños. Esto ya
está escrito en casi todas las planillas ("consultar la cantidad de empleados").

**2. Cuánto rinde cada cosa.** La regla por unidad, que es la que generaliza.
Ejemplos que ya funcionan: *"látex interior ~10 m²/L por mano"*, *"1 botella de
vino (750 ml) cada 3 personas"*, *"100 hojas por persona por mes"*.

Si un dato no se sabe, es mejor escribir "consultar y estimar con criterio" que
inventar una razón: un número inventado sale con cara de preciso y está mal.

**3. Cada cuánto se compra.** No es lo mismo abastecer un mes que hacer un
trabajo una sola vez. Bebidas ya lo separa: el restaurant es compra mensual, el
evento es una sola vez. Esa palabra multiplica o divide todas las cantidades.

**4. Cómo se vende.** Una cosa es lo que necesita y otra lo que puede comprar.
Librería lo tiene escrito: necesita 1.000 hojas, o sea 2 resmas, pero se venden
en packs de 5, así que lleva un pack. Sin esa frase el asistente pide 2 resmas,
que no existen como unidad de venta.

**5. Qué no va.** Dos cosas distintas:

- **Lo que el catálogo no tiene** — el hielo en Bebidas, el limpiavidrios en
  Limpieza, las servilletas de mesa en Papelera. Sirve para que lo diga en vez de
  entregar otra cosa parecida en silencio. Este es el error más caro: el usuario
  cree que se lleva lo que pidió y se entera en el mostrador.
- **Lo que no corresponde al caso** — *"no incluí Lavandería porque no hay ropa
  que lavar"*. Evita que infle la lista.

## Estado al 2026-09-22

| Rubro | Ejemplos | Reglas por unidad |
|---|---|---|
| Pintura | 2 | completas |
| Bebidas | 2 | completas |
| Librería | 1 | una sola (100 hojas por persona por mes) |
| Papelera | 1 | faltan (sabe qué preguntar, no cuánto por comensal) |
| Limpieza | 1 | faltan (sabe qué preguntar, no cuánto rinde cada producto) |

Pendiente: un segundo ejemplo y las reglas por unidad en Papelera, Limpieza y
Librería. `npm run guias` avisa al correr cuántos ejemplos quedó teniendo cada
rubro.

Cuando estén cargadas conviene medir en vez de suponer: correr el mismo caso con
dos tamaños distintos (una oficina de 10 personas y otra de 50) y verificar que
las cantidades escalan en vez de quedar pegadas al ejemplo.
