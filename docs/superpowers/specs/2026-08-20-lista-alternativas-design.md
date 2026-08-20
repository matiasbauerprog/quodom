# Elegir entre productos parecidos

Fecha: 2026-08-20

## Problema

La Lista IA toma lo que el usuario subió, busca cada renglón en el catálogo y
devuelve productos agrupados por rubro. Cada renglón se resuelve en **un**
producto.

Eso funciona cuando el renglón es preciso. Falla cuando es general, que es como
la gente escribe una lista de compras. "Platos descartables" corresponde hoy a
tres productos distintos del catálogo:

| Producto | Subcategoría | Variantes |
|---|---|---|
| Plato descartable por 100 unidades | Gastronomía | Chico P17 / Grande P22 |
| Plato de cartón dorado por 10 unidades | Cartón | 7 diámetros, de 16 a 36 cm |
| Plato por 10 unidades | Aluminio | 7 medidas, de 17 a 32 cm |

El sistema elige uno, no dice que había otros, y el usuario no puede cambiarlo
desde la propuesta: sólo editar la cantidad, borrar la línea, o salir a buscar a
mano.

Conviene separar dos cosas que se parecen y no son lo mismo:

- **Variantes del mismo producto** (el tamaño del plato). Ya está resuelto y
  bien: 232 de los 441 productos activos tienen atributos, y la IA tiene
  prohibido adivinarlos. La línea se agrega sin variante y el usuario la elige
  después, en el detalle del Quodom, donde ve las opciones reales.
- **Productos distintos que compiten por el mismo renglón**. Eso es lo que este
  documento resuelve.

## Alcance

Sólo la lista subida. El chat conversacional queda como está: tiene una salida
que la lista no tiene — si duda, repregunta antes de proponer. El problema de
elegir a ciegas es propio de la lista, donde la IA resuelve todo de una sin
poder preguntar nada.

## Decisiones de diseño

### Los candidatos los da el modelo

Su respuesta gana una tercera lista, junto a las resueltas y las no encontradas:
las **ambiguas**, cada una con hasta tres ids candidatos y cuál sugiere. Sigue
siendo un solo llamado.

El modelo es el único punto del sistema que puede juzgar esto: ya tiene los 441
productos activos en el mismo prompt y acaba de leer lo que el usuario escribió.

Las alternativas descartadas:

- **Que el modelo elija uno y el servidor busque parecidos**: exigiría construir
  un buscador por tokens en el servidor. Es el mismo trabajo que se descartó al
  diseñar el matcheo, porque el `LIKE` existente no encuentra "Resma A4"
  buscando "resma de papel A4".
- **Dos llamados, uno para matchear y otro para revisar las dudosas**: duplica
  tiempo y cuota de cada carga para resolver un caso que es minoría.

El riesgo de que el modelo marque todo —o nada— como ambiguo se controla con
reglas explícitas en el prompt y con el tope de tres candidatos.

### Sólo cuando duda

Una línea precisa se resuelve sola y no genera ninguna decisión. Las alternativas
aparecen únicamente cuando hay varios productos que responden igual de bien al
renglón.

Mostrar alternativas en todas las líneas convertiría una lista de treinta
renglones en treinta decisiones, y haría que el caso fácil pese tanto como el
difícil.

### Las dudosas se resuelven arriba, fuera de los grupos

**41 palabras del catálogo aparecen en productos de más de un rubro activo.**
"Papel" existe en Papelera, Limpieza y Librería; "guantes" en Limpieza y
Papelera; "látex" en Limpieza, Pintura y Papelera. Así que los candidatos de un
renglón general pueden pertenecer a rubros distintos, y no hay un grupo donde esa
línea vaya naturalmente.

Por eso las líneas dudosas salen de los grupos y se juntan en un bloque propio,
arriba: **"Tenés que elegir"**. Al elegir un candidato, la línea baja al grupo del
rubro que corresponda.

Esto separa decidir de confirmar, y funciona igual sean los candidatos del mismo
rubro o de rubros distintos. Las alternativas —limitar los candidatos al rubro
del sugerido, o dejar que elegir mude la línea de un grupo a otro— o esconden
opciones válidas, o reacomodan la pantalla mientras el usuario trabaja.

### El sugerido es una recomendación, no una preselección

Mientras el usuario no toque nada, la línea dudosa **no entra a ningún Quodom**.
El sugerido se marca como tal para orientar, no para resolver por él.

Si el usuario confirma un grupo teniendo líneas sin resolver, el botón le avisa
cuántas quedaron esperando. Avisa, no bloquea: puede haberlas dejado a propósito.

Preseleccionar y bajar la línea automáticamente sería el problema de hoy —elegir
por el usuario— apenas avisado.

## Arquitectura

### Lo que devuelve el servidor

La respuesta de `POST /api/ia/lista` gana `ambiguas`:

```
{ res: true,
  grupos: [ { idrubro, rubro, items: [...] } ],
  ambiguas: [ { textoOriginal, cantidad, sugerido, candidatos: [
                 { idproducto, nombreProducto, idrubro, rubro } ] } ],
  noEncontrados: [ { textoOriginal, motivo } ],
  lineasIgnoradas: 0 }
```

`sugerido` es el `idproducto` de uno de los candidatos. El nombre y el rubro de
cada candidato los resuelve el servidor contra el catálogo, nunca el modelo.

### Lo que el servidor valida

Las mismas garantías que ya rigen para los ids, aplicadas a los candidatos:

- Un candidato que no está en el catálogo activo se descarta.
- Si tras descartar queda **un solo** candidato, la línea deja de ser ambigua y
  baja directo a su grupo: no tiene sentido hacer elegir entre una opción.
- Si no queda ninguno, la línea va a `noEncontrados`.
- Si `sugerido` no sobrevivió al descarte, se sugiere el primer candidato válido.
- Tope de tres candidatos; si el modelo manda más, se conservan los tres primeros.

La regla de cobertura no cambia: **toda línea de la entrada termina en un grupo,
en las ambiguas, o en no encontrados**. Nada se descarta en silencio.

### La regla del prompt

Una línea es ambigua cuando hay varios productos del catálogo que responden
igual de bien a lo que el usuario escribió; en ese caso no se elige uno en
silencio, se devuelven los candidatos. Si el renglón es preciso, se resuelve. La
ambigüedad no es una salida para no decidir.

### La pantalla

**`app/src/screens/ListaIA/LineasAmbiguas.tsx`** (nuevo) — el bloque de arriba.
Por cada línea muestra el texto tal como lo escribió el usuario y sus candidatos,
cada uno con su nombre completo y su rubro, porque pueden ser de rubros
distintos. El sugerido lleva una marca. Tocar un candidato resuelve la línea en
un solo toque; cada línea tiene además su descarte.

**`app/src/screens/ListaIA/PanelLista.tsx`** — pasa a llevar el estado de lo que
el usuario fue resolviendo, y de ahí sale lo que se dibuja.

Ese es el cambio con sustancia. Hoy los grupos vienen armados del servidor y la
pantalla sólo los dibuja. Ahora los grupos son **lo que trajo el servidor más lo
que el usuario resolvió**, así que esa combinación se calcula en la pantalla:
resolver una línea la agrega al grupo de su rubro, creándolo si ese rubro no
tenía grupo. Es donde puede aparecer un error sutil —una línea resuelta dos
veces, un grupo que no se crea— así que lleva sus propios tests.

**`GrupoRubro.tsx`** — recibe cuántas líneas quedan sin resolver, para el aviso
del botón de confirmar. Su flujo de confirmación, su diálogo antes de crear un
Quodom y su guardia de reintento quedan intactos.

Y tiene que manejar un caso que antes no existía: **que le lleguen productos
nuevos después de haber sido confirmado**. Pasa si el usuario confirma el grupo
de Papelera y recién entonces resuelve una línea dudosa que también es de
Papelera. Hasta ahora un grupo confirmado quedaba en "Agregado ✓" para siempre,
porque su contenido no podía cambiar.

Cuando eso ocurre, el grupo vuelve a mostrar su propuesta editable, con el
producto nuevo listo para confirmar, y conserva el aviso de que ya agregó lo
anterior. La guardia de reintento que ya tiene —el registro de qué productos
mandó al servidor— hace que confirmar de nuevo agregue sólo lo nuevo y no
duplique lo anterior. Sin esto, el producto recién elegido no tendría ninguna
forma de llegar al Quodom.

**`app/src/api/lista.ts`** — los tipos nuevos.

Sin cambios: `CargarLista`, `NoEncontrados`, `PropuestaEditable` (compartido con
el chat, que no se toca), y todo el flujo de confirmación al Quodom.

## Errores y límites

| Situación | Qué pasa |
|---|---|
| El modelo devuelve un candidato que no existe | Se descarta; la línea sigue con los válidos |
| Queda un solo candidato válido | Deja de ser ambigua y baja a su grupo |
| No queda ninguno | Va a `noEncontrados` |
| `sugerido` no está entre los candidatos válidos | Se sugiere el primero |
| El modelo manda más de tres candidatos | Se conservan tres |
| El modelo no marca nada como ambiguo | La pantalla es la de hoy: el bloque no se dibuja |
| El usuario confirma con líneas sin resolver | El botón avisa cuántas faltan; no bloquea |
| Resuelve una línea de un rubro ya confirmado | El grupo vuelve a ser editable con el producto nuevo; confirmar otra vez agrega sólo ese |

## Testing

**API** — SQLite real en memoria, `callGemini` mockeado:

- una línea ambigua sale en `ambiguas` con sus candidatos, y no en ningún grupo
- el nombre y el rubro de cada candidato salen del catálogo, no del modelo
- un candidato inventado se descarta y la línea conserva los válidos
- una ambigua que queda con un solo candidato válido baja a su grupo
- una que queda sin candidatos válidos va a `noEncontrados`
- un `sugerido` que no sobrevivió se reemplaza por el primer candidato válido
- más de tres candidatos se recortan a tres
- la cobertura sigue valiendo: ninguna línea de la entrada desaparece

**Front** — vitest + testing-library:

- el bloque muestra el texto original y los candidatos con su rubro
- el sugerido aparece marcado
- tocar un candidato saca la línea del bloque y la agrega al grupo de su rubro
- resolver hacia un rubro sin grupo lo crea
- descartar una línea no agrega nada a ningún grupo
- el aviso de pendientes aparece con líneas sin resolver y desaparece al
  resolverlas todas
- resolver una línea hacia un rubro cuyo grupo ya fue confirmado devuelve ese
  grupo a estado editable con el producto nuevo, y confirmarlo otra vez agrega
  sólo ese, sin duplicar lo anterior
- sin ambiguas, la pantalla se comporta exactamente como hoy
