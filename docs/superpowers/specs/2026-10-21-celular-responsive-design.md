# Quodom en celular: barra de abajo como hoja, arrastre con el dedo y pantallas que entran

Fecha: 2026-10-21. Pedido del usuario: "que sea full responsive en todas las pantallas… el sidebar en el celular tiene que vivir abajo y tiene que funcionar con la misma lógica del sidebar cuando está oculto. si toco expandir se expande para arriba. podemos darle la lógica de arrastrar y soltar con el dedo… podés usar viewport. pero no podés romper nada".

## Por qué

En el celular la app "está llena de bugs" (palabras del usuario). Un recorrido hecho el 2026-10-21 en 390px, 320px y 800px de ancho, contra la app real con una cuenta de prueba, encontró esto:

1. **Los nombres de producto no se leen.** La tarjeta corta el nombre a dos palabras ("Latex Interior…", "Impermeabi… Fibrado…") en celular y en tablet; no se distingue un producto de otro.
2. **Los productos quedan muy abajo.** Adentro de un rubro, los cinco cuadros grandes de rubros ocupan casi toda la pantalla y el primer producto aparece al final.
3. **Las pantallas del menú desperdician espacio.** Historial, Perfil y Notificaciones reparten el alto con `space-evenly` (`--pantalla-alto`), y en celular eso deja un hueco grande entre el título y el contenido.
4. **Cambiar de pantalla no vuelve arriba.** Historial abrió scrolleado (heredó el scroll del catálogo): el título salió cortado y el botón "Nuevo" quedó encima.
5. **La barra de abajo ya existe y ya se despliega hacia arriba**, pero sólo con toques, sin gesto; y en 320px el "Sumando a: Pintura living" se corta.
6. **Las pestañas de subcategoría muestran la barra de scroll.**
7. **Agregar en celular no deja rastro.** `AvisoAgregado` vive adentro de `MisQuodomsSidebar`, que está en `display: none` debajo de 1025px.

Lo que anda bien en celular y no se toca: las ventanas (`VentanaQuodom`, `DialogoDestino`, `DialogoPedido`), los formularios (dirección, perfil), el menú lateral.

## Objetivos

- **Una sola versión móvil, robusta a largo plazo** (lo pidió el usuario: "la opción que sea mejor y robusta a largo plazo").
- La barra de abajo funciona como el panel de escritorio **cuando está oculto**: dice el destino, avisa lo agregado, y mientras se arrastra se vuelve el lugar donde soltar.
- La barra se abre como **hoja** hacia arriba: tocando o deslizando con el dedo; se cierra deslizando hacia abajo, con la flecha o tocando afuera.
- **Arrastrar un producto con el dedo** y soltarlo en la barra (o en un Quodom de la hoja abierta).
- Los siete problemas del recorrido, arreglados.

## No objetivos

- **El escritorio (desde 1025px) no cambia.** Ni el panel derecho, ni la manija, ni la pestaña de panel cerrado, ni el arrastre con mouse.
- No se cambia ninguna regla de producto (destino = abierto, `agregarProducto.ts` como único camino, etc.).
- La hora de las notificaciones ("06:02" para las 18:02, formato de 12 horas sin a.m./p.m.) es otro arreglo y va aparte.
- No hay app nativa ni PWA.

## Anti-objetivos (sería un fracaso aunque "funcione")

- **Que el arrastre se coma el scroll.** Ya pasó una vez: por eso hoy `iniciarArrastre` corta todo puntero que no sea mouse. Deslizar la lista de productos tiene que seguir siendo lo que pasa cuando se apoya el dedo y se mueve.
- **Que algo de escritorio cambie o se rompa.** Todos los tests actuales siguen pasando sin tocarles las expectativas de escritorio.
- **Dos copias de la misma lógica.** El destino compacto y el aviso de agregado ya existen en `MisQuodomsSidebar.tsx`; la barra los **reutiliza** (moverlos a un módulo compartido), no los copia. Es la misma regla que ya rige el árbol ("un solo árbol que dibujan las dos superficies").

## Decisiones del usuario

- **Dos cortes y no tres** (lo propuso el usuario y lo confirmó pidiendo "lo mejor y robusto a largo plazo"):
  - **Móvil: hasta 1024px.** Celular y tablet son una sola versión: barra de abajo con hoja, arrastre con el dedo, rubros en fila chica.
  - **Escritorio: desde 1025px**, igual que hoy.
  - Dentro de móvil, los tamaños se ajustan solos con el ancho (grillas `auto-fill`/`minmax`, `clamp()` con unidades de viewport), en vez de un tercer corte fijo en 601px.
  - Hay que actualizar las reglas escritas: §4 del `CLAUDE.md` raíz y "Reglas visuales" de `app/CLAUDE.md` hoy dicen tres cortes.
- **Las dos formas de arrastre con el dedo**: arrastrar un producto a la barra, y deslizar la barra para abrirla y cerrarla.
- **Usar unidades de viewport** para que el contenido se ajuste a cualquier pantalla.
- **No romper nada.**

## Diseño

### 1. Cortes

- Todo `@media (min-width: 601px)` y `(min-width: 601px) and (max-width: 1024px)` desaparece. Lo que hacía se resuelve:
  - **Columnas** (productos, rubros, historial): con `grid-template-columns: repeat(auto-fill, minmax(<mínimo>, 1fr))`, que pone dos columnas en un celular y más en una tablet sin corte.
  - **Márgenes y tipografía**: con `clamp(mín, Xvw, máx)`.
  - **Ventanas** (`VentanaQuodom`, `DialogoPedido`, `DialogoProveedores`, `FilaProveedor`): hoy son hoja abajo hasta 600px y caja centrada desde 601px. En móvil (hasta 1024px) quedan como **hoja anclada abajo con `max-width` (≈560px) y centrada horizontalmente**: en un celular ocupa el ancho, en una tablet no se estira de punta a punta. Desde 1025px, como hoy.
- Los cortes de alto (`max-height: 740px` en el inicio) y los de preferencia (`hover: hover`, `prefers-reduced-motion`) no son cortes de ancho y se quedan.
- Los dos valores (1024/1025) se escriben en un solo lugar de referencia (comentario en `tokens.css`, ya que CSS plano no tiene variables en media queries), y los dos `CLAUDE.md` se actualizan.

### 2. Viewport

- Altos con `dvh` (ya se usa en `Layout.css`), con `svh` donde importe que no salte cuando aparece la barra del navegador (la hoja abierta: `max-height` en `svh`).
- Franja de inicio del iPhone: `env(safe-area-inset-bottom)` en la barra (ya está) y en la hoja abierta.
- Verificar que `index.html` tenga `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` (`viewport-fit=cover` es lo que hace que `env(safe-area-inset-*)` valga algo).
- La reserva de 72px de `main` debajo de 1025px pasa a ser el alto real de la barra cerrada (una variable `--alto-barra` que la barra define), para que un texto en dos renglones no tape contenido.

### 3. La barra de abajo (`BarraQuodomInferior`)

**Cerrada.** Como hoy: cuenta, "Sumando a: X" (o "Pintura · elegís el Quodom al agregar"), flecha y campanita. En pantallas angostas el texto puede ir en dos renglones en vez de cortarse (hoy `white-space: nowrap`).

**Aviso de agregado.** Lo que entra con `+`, el diálogo o soltando se avisa 3,5s **arriba de la barra**, con el mismo componente que en escritorio (`AvisoAgregado`, sacado de `MisQuodomsSidebar.tsx` a su propio archivo y usado por las dos superficies).

**Hoja.**
- Se abre tocando la barra (como hoy) o **deslizándola hacia arriba**; sube siguiendo al dedo.
- Se cierra deslizándola hacia abajo, con la flecha, con Escape o tocando afuera (hoy: `mousedown` afuera; pasar a `pointerdown` para que ande con el dedo).
- Soltada a mitad de camino, termina hacia donde iba: si la velocidad del gesto es clara gana la dirección; si no, gana la posición (más de la mitad = abierta). *(Decisión del diseño.)*
- Una **manija** visible arriba de la hoja (la rayita gris de las hojas de Maps) que es lo que se agarra para cerrarla; adentro, el contenido scrollea normal. El gesto de cerrar desde el contenido sólo vale cuando el contenido está scrolleado hasta arriba. *(Decisión del diseño.)*
- Alto máximo ~70% de la pantalla (`70svh`); hoy `60vh`.
- Con `prefers-reduced-motion`, sin animación: abre y cierra en el acto.

**Mientras se arrastra un producto** (con el dedo o con el mouse en una ventana angosta):
- La barra cerrada muestra el destino compacto: "Soltá para sumar a **Pintura living**" o "Soltá para crear un Quodom de **Pintura**". Es el mismo `DestinoCompacto` de escritorio, con `data-destino`/`data-nuevo` + `data-rubro`, así que el soltado va por el mismo `blancoBajo` y el mismo `onSoltar` que hoy. Se **monta** sólo mientras se arrastra (no se esconde con CSS), por la regla ya escrita: un destino escondido duplica el `data-nuevo` del árbol.
- **Si el dedo se queda ~0,8s sobre la barra, la hoja se abre sola** y muestra el árbol con sus destinos (los Quodoms del rubro y "+ Soltar en un Quodom nuevo"), para soltar en uno puntual. Para eso el árbol ya escucha `arrastre:sobre-rubro` y despliega el rubro del producto. *(El tiempo exacto lo ajusta quien lo construya; lo que importa es que no se abra con sólo pasar.)*
- Soltar fuera de un destino no hace nada, como en escritorio.
- **La hoja que abrió el arrastre se vuelve a cerrar sola** al terminar el arrastre (soltado, soltado en el vacío, Escape o `pointercancel`) *(decisión del diseño)*: abierta tapa el 70% de la pantalla, encima de la lista de la que vino el usuario, y en escritorio el panel cerrado también sigue cerrado después de soltar. Lo que entró lo cuenta el aviso de agregado de la barra. Hace falta recordar **quién** la abrió, aparte de si está abierta: una hoja que el usuario abrió a mano antes de arrastrar queda abierta.
- Con la hoja abierta, `DestinoCompacto` no se monta (el árbol ya tiene los destinos reales y un segundo `data-nuevo` duplicaría el del árbol).

### 4. Arrastre con el dedo (`arrastre.ts`)

Hoy `iniciarArrastre` corta todo lo que no sea mouse. Pasa a aceptar `touch` (y `pen`) **con mantener apretado**:

- **Mouse**: igual que hoy (umbral de 6px).
- **Dedo**: el arrastre arranca si el dedo se queda quieto ~450ms sobre el producto (tolerancia de unos 8px). Si el dedo se mueve antes, es scroll y el arrastre no existe. Al levantar, vibración corta (`navigator.vibrate(15)` si existe; en iPhone no existe y no pasa nada).
- **Un toque lento sigue siendo un toque** *(decisión del diseño)*: si el producto se levantó pero el dedo se suelta sin haberse movido (más allá de la tolerancia), no es un soltado en el vacío sino el toque de siempre, y abre `DialogoDestino` como hoy. Mucha gente toca despacio, y en celular ese toque es el camino principal para elegir destino: que vibre y no haga nada sería romperlo en silencio. `tragarClic` se aplica sólo si hubo movimiento después de levantar. Esto invierte el test `ListaProductos.test.tsx` "un toque no levanta el arrastre" para el dedo, que es una expectativa de celular y se puede cambiar.
- Una vez levantado, el navegador no tiene que scrollear bajo el dedo; mientras **no** se levantó, nada bloquea el scroll. **El mecanismo lo elige quien construye**: cambiar `touch-action` a mitad del gesto no frena el scroll en Chrome Android ni en Safari de iOS (se lee al apoyar el dedo, y el navegador manda `pointercancel`), así que lo esperable es un `touchmove` no pasivo en `window`, registrado al apoyar el dedo, que hace `preventDefault` sólo después de levantar y se saca en `limpiar()`. Lo que no se negocia es el anti-objetivo: el scroll intacto hasta el levantado, y un `pointercancel` previo al levantado tratado como scroll.
- El menú contextual de "mantener apretado" del navegador (copiar imagen, seleccionar texto) se apaga en la tarjeta: `-webkit-touch-callout: none` y `user-select: none` en `.prod-item`, y `preventDefault` en `contextmenu` mientras hay arrastre en curso.
- Todas las salidas siguen terminando en `limpiar()` (regla ya escrita): `pointercancel` —que en el dedo llega cuando el navegador decide que era scroll— aborta sin agregar.
- El fantasma se dibuja **arriba del dedo** (desplazado hacia arriba), para que el dedo no tape lo que se arrastra ni el destino.
- El clic que el navegador dispara al final se sigue tragando (`tragarClic`).
- Sin sesión sigue sin haber arrastre (no hay Quodoms donde soltar), igual que hoy.

### 5. Pantallas

- **Tarjeta de producto** (`ListaProductos.css`): el nombre ocupa hasta 3 renglones (`-webkit-line-clamp: 3`) y no se corta por ancho de columna; la grilla con `auto-fill`. Medir que en 320px entren dos columnas legibles; si no, una. El título completo queda en el `title`.
- **Rubros adentro de un rubro**: con `?rubro=` en la URL y en móvil, los cuadros grandes se vuelven **una fila de botones chicos** (ícono + nombre) que se desliza de costado, con el actual resaltado y visible (scroll hasta él). Sin rubro elegido, en el inicio, siguen los cuadros grandes.
- **Pantallas de sección** (Mis Quodoms, Perfil, Direcciones, Notificaciones): en móvil el contenido arranca debajo del título (`justify-content: flex-start` y un espacio fijo), sin `space-evenly` ni `--pantalla-alto`. Desde 1025px, igual que hoy.
- **Volver arriba al cambiar de pantalla**: al cambiar el `pathname` se scrollea a 0. **No** al cambiar sólo la búsqueda (`?rubro`, `?sub`, `?quodom`, `?ia`): elegir una subcategoría o abrir la ventana de un Quodom no puede mandarte arriba. El Atrás del navegador sí restaura donde estabas (lo hace el navegador si no se lo pisa).
- **Pestañas de subcategoría**: se deslizan igual, sin barra de scroll visible (`scrollbar-width: none` y `::-webkit-scrollbar { display: none }`).
- **Chat del Modo IA**: el campo para escribir queda abajo de la pantalla, arriba de la barra, en vez de flotar a mitad. *(Visto en el recorrido; si resulta que mover el campo choca con el teclado del teléfono, se deja como está y se anota.)*

## Cómo se verifica

- **Tests (Vitest)**: los 604 actuales en verde sin cambiar expectativas de escritorio. Tests nuevos para lo que se rompe en silencio:
  - el arrastre con dedo: no arranca si el dedo se mueve antes del tiempo; arranca después; `pointercancel` aborta sin agregar; soltar sobre el destino de la barra llama al mismo camino que soltar en el árbol;
  - la barra: el destino compacto aparece sólo mientras se arrastra; el aviso de agregado aparece en la barra; tocar afuera (con `pointerdown`) cierra la hoja;
  - volver arriba: cambia con el `pathname`, no con la búsqueda.
- **Recorrido en el navegador** (es la regla del proyecto: ningún test reemplaza mirar): en 320, 390 y 800px de ancho y en escritorio de 1280+, repitiendo las pantallas del recorrido del 2026-10-21 (inicio, rubro, barra y hoja, agregar, menú, historial, perfil, dirección, notificaciones, ventana del Quodom, Modo IA). Escritorio: comparar con capturas de antes del cambio.
- **En un teléfono de verdad**, lo que la compu no puede simular: el arrastre con el dedo contra el scroll, la hoja deslizada, la franja del iPhone. Lo hace el usuario en Render después del deploy; quien construye deja escrito qué mirar.

## Lo que queda para quien construye

- Los tiempos y umbrales exactos (mantener apretado, tolerancia, cuánto esperar sobre la barra para abrir la hoja, velocidad del gesto).
- Si deslizar la hoja se implementa a mano con eventos de puntero o con una biblioteca chica. Preferencia: a mano, como `arrastre.ts`, sin dependencias nuevas.
- El orden de los cambios, siempre que cada paso deje la suite verde y el escritorio igual.
