# Varios Quodoms por rubro, y el árbol que los ordena

Fecha: 2026-10-14
Reemplaza la regla central de `2026-08-18-quodom-por-rubro-design.md`.

## El problema

Hoy un usuario puede tener **como máximo un Quodom abierto por rubro**. Esa regla
hacía que "agregar un producto" tuviera una respuesta única y automática: se busca
el Quodom abierto de ese rubro y se le mete la línea.

Levantar el tope rompe esa respuesta. Con tres Quodoms de Pinturería abiertos, tocar
`+` en un látex ya no tiene un destino obvio, y el sistema no puede elegir por el
usuario sin arriesgarse a mandar la compra al Quodom equivocado.

Este diseño resuelve las dos cosas a la vez: saca el tope y define cómo se elige el
destino sin interrumpir en cada producto.

## La regla nueva

**El Quodom abierto de un rubro es el que recibe lo que agregás de ese rubro.**

- Un rubro puede tener **todos los Quodoms en `CREADO` que el usuario quiera**.
- De esos, **a lo sumo uno está "abierto"** — desplegado en el árbol, mostrando sus
  líneas. Abrir otro del mismo rubro cierra el anterior.
- **Cada rubro se acuerda del suyo**. Pinturería puede tener "Casa" abierto mientras
  Limpieza tiene "Oficina" abierto. Ir y venir entre rubros no interrumpe.
- Si el rubro no tiene ninguno abierto, el primer `+` pregunta una vez y el elegido
  queda abierto. A partir de ahí, ese rubro no vuelve a preguntar.

"Abierto" es una sola cosa con dos lecturas que coinciden a propósito: es el que
estás mirando y es el que recibe. No hay un estado "seleccionado" separado de
"desplegado"; un clic, un significado.

> **Por qué una marca por rubro y no una sola global.** Con una marca global, cruzar
> de rubro la invalida y el sistema vuelve a preguntar cada vez: agregar pintura,
> después lavandina, después pintura otra vez son tres preguntas. Con una por rubro
> son dos, una sola vez cada una. Se midió sobre el prototipo antes de decidir.

**El estado "abierto" es del cliente, no del servidor.** Vive en `localStorage` como
un mapa `{ idrubro: idquodom }`. No es un dato del Quodom: dos pestañas pueden tener
abiertos distintos sin que eso signifique nada para el backend, y un Quodom que deja
de existir o que se envía simplemente se descarta del mapa al leerlo.

## El árbol

El panel derecho deja de ser una lista plana y pasa a ser un árbol de dos niveles:

```
QUODOMS ACTIVOS

  PINTURERÍA (2)            ▼
     ● Casa          8 prod.      ← abierto: muestra sus líneas
         · Látex interior 20 L
         · Fijador 4 L
       Depto         3 prod.
  LIMPIEZA (1)              ▼
     ● Oficina       5 prod.
  BEBIDAS                   ▶
     Ningún Quodom en armado.

  [        Mis Quodoms        ]
```

- **El padre es el rubro**, con la cantidad de Quodoms en armado. Se despliega y se
  pliega. Un rubro sin Quodoms activos se muestra igual, porque es un destino válido
  para soltar algo (ver más abajo).
- **Los hijos son los Quodoms en `CREADO`**, y nada más. Los `ENVIADO` salen del panel.
- **El abierto muestra sus líneas ahí mismo**, con el editor que ya existe
  (`LineasQuodomSidebar`: cantidad, quitar, y el selector de atributo que falta).
- **Al pie, un botón "Mis Quodoms"** que lleva a la pantalla completa.

**Mis Quodoms pasa a ser el lugar de todo.** El panel muestra lo que está en armado;
la pantalla muestra todo, enviados incluidos, y se queda con "Repetí un pedido", que
hoy vive en el panel y lo llena de cosas que no son el trabajo en curso.

**Una sola implementación para las dos pantallas.** El árbol se escribe una vez. En
escritorio (`≥1025px`) es el panel derecho; en celular es lo que despliega la barra
inferior, que muestra `Sumando a: PINTURERÍA · Casa`. Las dos superficies ya existen
y nunca conviven: `.mq-sidebar` está en `display: none` bajo 1025px y
`.barra-quodom` lo está por encima.

## Los tres caminos para agregar un producto

### 1. `+` — el caso de todos los días

Va al Quodom abierto del rubro **del producto**, sin ventanas ni confirmaciones. Si
ese rubro no tiene ninguno abierto, aparece una única pregunta con los Quodoms
activos de ese rubro más "un Quodom nuevo"; el elegido queda abierto.

El rubro del producto manda siempre: tocar `+` en una lavandina mientras mirás
pinturería la manda al Quodom abierto de Limpieza, no al de Pinturería.

### 2. Arrastrar — la excepción, en escritorio

Arrastrar la tarjeta del producto sobre cualquier Quodom del árbol lo agrega ahí.
Es para el caso "estoy en Bebidas pero esto va a Pinturería", sin cambiar de contexto.

- **Soltar abre ese Quodom**: pasa a ser el abierto de su rubro.
- **Un rubro que no coincide rechaza el soltado**, con el borde en rojo. Un Quodom no
  mezcla rubros y el arrastre no puede ser la excepción a eso.
- **Mientras se arrastra, cada rubro ofrece además "+ un Quodom nuevo"** como destino.
  Soltar ahí lo crea con un nombre provisorio y lo abre. Esto es lo que hace que un
  rubro sin ningún Quodom siga siendo un destino válido.
- **Pasar por encima de un rubro plegado lo despliega**, para poder soltar adentro.
- Al acercarse a un destino válido, lo que se lleva en la mano **se achica**, y el
  destino crece un poco. Es la señal de que va a entrar ahí y no en otro lado.

> **El arrastre nativo de HTML no sirve acá.** `dragstart` congela una imagen de la
> tarjeta al empezar y no deja animarla después, así que el efecto de entrar es
> imposible con esa API. Va implementado con eventos de puntero
> (`pointerdown`/`pointermove`/`pointerup`) y un elemento flotante propio. El
> prototipo lo tiene andando.

### 3. `···` — lo mismo, sin mouse

Cada tarjeta lleva un `···` que abre la misma lista de destinos del rubro. Es el
camino en celular, donde no hay arrastre, y es también el camino accesible por
teclado en escritorio.

**El arrastre nunca es obligatorio.** Es un atajo para quien lo descubre; todo lo que
hace se puede hacer con `+` y con `···`. Por eso que no exista en celular no deja la
app coja.

## El invitado

Sin cuenta no hay Quodoms: hay carritos en `localStorage`, **uno por rubro**, como
hoy. Un invitado no crea ni nombra varios Quodoms de un mismo rubro, así que el árbol
le muestra un hijo por rubro y nunca tiene que elegir destino.

La migración al iniciar sesión queda como está, con una simplificación: **ya no puede
haber conflicto de rubro duplicado**. Hoy, si el usuario tenía un Quodom abierto de
ese rubro, había que preguntarle integrar / reemplazar / cancelar. Ahora el carrito
migra siempre a un Quodom nuevo, y si quiere unirlos lo hace después arrastrando.

## Backend

### Contrato

| Antes | Ahora |
|---|---|
| `GET /quodom/activo/{idrubro}` → un Quodom o `null` | `GET /quodom/activos/{idrubro}` → lista de Quodoms en `CREADO` de ese rubro |
| `POST /quodom/create` → 409 `rubro_duplicado` si ya había uno abierto | crea siempre |
| `POST /quodom/repetir/{id}` → 409 `rubro_duplicado` | crea siempre |

`rubro_mismatch` **se queda**: una línea sigue sin poder entrar en un Quodom de otro
rubro, y es la regla que hace que el arrastre pueda rechazar.

### Base de datos

Hay que **borrar el índice único parcial `quodom_abierto_por_rubro`**
(`api/src/models/quodom.model.js`), que es el que impide físicamente dos Quodoms
abiertos del mismo rubro.

> **Trampa.** `model.sync()` nunca hace `ALTER` sobre una tabla que ya existe, así que
> sacar el índice del modelo **no lo borra de ninguna base que ya esté creada**. Hace
> falta un script `npm run migrar-multi-quodom` que haga `DROP INDEX IF EXISTS` y su
> `wal_checkpoint(TRUNCATE)`, igual que `migrar-empresa`. Sin eso, el servidor acepta
> el pedido y SQLite lo rechaza con un error de constraint que nadie espera.

Verificar contra el blob commiteado, no contra el archivo local (ver §6 de `claude.md`).

## Qué se borra

Levantar el tope deja código sin razón de existir. Borrarlo es parte del trabajo, no
una limpieza aparte:

- `DialogoConflictoRubro` y su rama "reemplazar" — ya no hay conflicto que resolver.
  Lo usan `SitioInicial`, `MisQuodomsSidebar`, `PanelConversacion` y `DetalleQuodom`.
- `DialogoNuevoRubro` — se reemplaza por la pregunta única de destino, que es la misma
  lista en los tres caminos.
- La rama de `migrateGuestQuodom` que maneja el conflicto por rubro.
- El manejo de `UniqueConstraintError` en `quodom.controller.create`, que existía sólo
  como red del índice.

## Decisiones tomadas, y lo que se descartó

**Un carrito aparte, con su "Finalizar".** Descartado. Un carrito con nombre y de un
solo rubro es exactamente un Quodom en `CREADO`: mismos campos, mismas reglas. Haberlo
construido aparte habría dejado dos objetos idénticos, dos editores y una migración
entre ellos, y el paso "Finalizar" habría sido volcar un borrador adentro de otro. El
único beneficio real —que nada se cree en el servidor hasta confirmar— no paga ese
costo, porque un Quodom sin enviar ya no lo ve ningún proveedor y se borra con un clic.

**Una marca global en vez de una por rubro.** Descartado por lo medido en el prototipo:
interrumpe en cada cruce de rubro.

**Preseleccionar el último Quodom usado** cuando hay que preguntar. Descartado: con
varios Quodoms por rubro, una preselección silenciosa es justo el error que este
diseño existe para evitar.

**Soltar en "un Quodom nuevo" no pide el nombre.** Lo crea con uno provisorio y se
renombra después, desde el menú de la tarjeta. Frenar el arrastre con un formulario
rompe la fluidez en el único momento en que el usuario está siendo rápido.

## Riesgos

**El árbol puede crecer mucho.** Con 5 rubros y varios Quodoms cada uno, el panel se
llena. Mitigación: los rubros arrancan plegados salvo los que tienen un Quodom abierto,
y sólo se listan los `CREADO`.

**El arrastre no se descubre solo.** Por eso el `···` hace lo mismo y está siempre
visible. El arrastre es un acelerador, nunca el único camino.

**El estado "abierto" puede quedar apuntando a un Quodom que ya no existe** (borrado en
otra pestaña, o enviado). Al leer el mapa hay que descartar las entradas que no
resuelven contra la lista de activos; se trata como "ninguno abierto", que es un estado
válido que ya sabe resolverse.

## Qué queda afuera

- Mover líneas **entre** Quodoms arrastrando desde el árbol. Sólo entra lo que viene
  del catálogo.
- Arrastre táctil en celular. El `···` lo cubre; si más adelante se quiere, el camino
  es mantener pulsado para levantar, sobre la misma implementación de puntero.
- Reordenar Quodoms en el árbol.
