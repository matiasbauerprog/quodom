# La IA vive en el home

Fecha: 2026-08-20

## Problema

El asistente tiene dos personalidades: el **chat** que te aconseja cuando no
sabés qué necesitás, y la **carga de lista** que lee un archivo que ya tenés
escrito. Hoy cada una es una pantalla aparte (`/modo-ia` y `/lista`), a las que
se llega por un botón del home y por el drawer.

Eso obliga a irse del home para algo que puede pasar ahí mismo. El home ya tiene
la mitad de abajo dedicada a elegir rubro, subcategoría y producto: cuando el
usuario está usando la IA, ese espacio no le sirve, y en cambio es exactamente
donde la conversación o la lista deberían aparecer.

La premisa del cambio, en las palabras del usuario: **¿para qué voy a ir a otra
ventana?**

## Alcance

El botón "Modo IA" del home se convierte en dos pestañas — **Conversando** y
**Subí tu lista** — y el contenido de cada modo se dibuja en el home, en lugar
del catálogo.

Las pantallas `/modo-ia` y `/lista` desaparecen, junto con sus entradas en el
drawer.

Fuera de alcance: cambiar el backend, el matching, el flujo de confirmación al
Quodom o el diseño de las tarjetas de producto. Todo eso ya funciona y se reusa
tal cual.

## Qué se reusa y qué se tira

Se reusa entero: todo el backend (`/api/ia/chat` y `/api/ia/lista`), el cliente
`api/lista.ts`, y los tres componentes de la pantalla de lista —
`CargarLista`, `GrupoRubro` y `NoEncontrados` —, que no cambian ni una línea.

Se tira: los envoltorios. `ListaIA.tsx` y el `AppBarBack` de `ModoIA.tsx`
existen sólo para darle a cada pantalla una barra propia y una ruta. Sin rutas,
no hay nada que envolver.

## Decisiones de diseño

### Extraer el cuerpo, no agregar un flag

Cada pantalla es hoy "barra de navegación + cuerpo". Se quedan con el cuerpo,
renombradas a `PanelConversacion` y `PanelLista`, y el home las monta.

La alternativa —una prop `embebido` que decida si se dibuja la barra y si se
navega al confirmar— no crea archivos nuevos, pero deja dos componentes que
hacen dos cosas según un flag. Ese es el tipo de condicional que después nadie
se anima a borrar. Un tercer camino, mover el estado del chat a un hook
`useConversacionIA` y dejar los paneles como presentación pura, es refactor que
este cambio no necesita: el estado del chat ya vive prolijo dentro de su
componente.

### Las pestañas son también el control para volver

Con un panel abierto, el catálogo no está. Los dos botones siguen visibles
arriba: el activo se ve marcado, tocarlo otra vez cierra el panel y devuelve el
catálogo, y tocar el otro cambia de modo sin pasar por el catálogo.

Un botón de cerrar dentro del panel daría más espacio, pero obligaría a cerrar y
volver a elegir para pasar de un modo al otro. Dejar el catálogo debajo del
panel no oculta nada, pero en un celular lo manda tan abajo que deja de existir,
y el chat compite con él por el alto de pantalla.

### El modo vive en estado local, no en la URL

El home ya usa la URL para `?rubro=` y `?sub=`, pero el modo de IA no se agrega
ahí. Consecuencia asumida: recargar cierra el panel, el botón Atrás no lo
cierra, y el modo no se puede compartir por link.

Se acepta a cambio de no sumar un tercer parámetro al home ni la maquinaria de
sincronizarlo con los otros dos. Si más adelante molesta, agregarlo es un cambio
chico y aislado.

### Las pestañas sólo en el home raíz

Igual que el botón "Modo IA" de hoy: con un rubro elegido no se muestran, para
que la pantalla quede compacta mientras el usuario está comprando.

De ahí se sigue algo que conviene decir explícitamente, porque el diseño lo
tentaba: **no hace falta limpiar `?rubro=` y `?sub=` al abrir un panel.** Si las
pestañas sólo se ven sin rubro elegido, en el momento de abrir un panel no hay
rubro que limpiar. Escribir esa limpieza sería código que no se puede alcanzar
desde la UI, y un test que lo cubriera pasaría igual con la limpieza borrada.

Para volver al catálogo desde un rubro, el usuario ya tiene el propio selector:
tocar el rubro activo lo deselecciona y devuelve al home raíz, donde las
pestañas reaparecen.

### El invitado entra, y el login aparece cuando hace falta

Cualquiera ve las pestañas y puede abrir un panel. El login se pide recién al
mandar el primer mensaje o al elegir un archivo.

Es coherente con el resto del sitio, donde el invitado arma su Quodom y el login
aparece al enviarlo por WhatsApp. Las alternativas —botones deshabilitados, o
directamente ocultos— esconden la función justo de quien todavía no se registró.

### Confirmar no saca al usuario de donde está

Hoy el chat navega a la pantalla del Quodom al confirmar. Deja de hacerlo: marca
*"Agregado ✓ — ver Quodom"* con un link y el usuario sigue en el home. La carga
de lista ya se comportaba así, porque puede tener varios rubros esperando
confirmación y sacarla de la pantalla dejaría grupos sin confirmar.

## Arquitectura

### El home

`SitioInicial` gana un estado `modoIa: 'chat' | 'lista' | null`:

```
QUODOM (wordmark)                 ← sólo sin rubro y sin panel abierto
buscador                          ← siempre
[ Conversando | Subí tu lista ]   ← sólo en el home raíz
──────────────────────────────
modoIa === null    → RubroSelector → SubcategoriaTabs → ListaProductos
modoIa === 'chat'  → PanelConversacion
modoIa === 'lista' → PanelLista
```

### Componentes

**`app/src/screens/Home/PestanasIA.tsx`** (nuevo) — los dos botones. Recibe el
modo activo y un callback; no sabe nada de lo que hay adentro de cada panel.

**`app/src/screens/ModoIA/PanelConversacion.tsx`** — es `ModoIA.tsx` renombrado,
sin `AppBarBack` y sin `navigate()`. El botón "nueva conversación", que hoy vive
en la barra que desaparece, se muda al encabezado del panel. Su test
(`__tests__/ModoIA.test.tsx`) se renombra igual.

**`app/src/screens/ListaIA/PanelLista.tsx`** — es `ListaIA.tsx` renombrado, sin
`AppBarBack`.

**Los dos directorios se quedan donde están**, aunque ya no contengan pantallas:
`screens/ModoIA/` es el hogar de `PropuestaEditable` y `MensajeChat`, y
`PropuestaEditable` lo importa además `GrupoRubro` desde `screens/ListaIA/`.
Moverlos sería un refactor que este cambio no necesita.

**`app/src/components/AvisoLogin.tsx`** (nuevo) — el aviso *"Para usar el
asistente necesitás iniciar sesión"* con su link. Lo necesitan los dos paneles;
vive en `components/` para no escribirlo dos veces ni que un panel lo importe
del otro.

**Se borran:** las rutas `/modo-ia` y `/lista` en `router/routes.tsx`, sus
imports, y las dos entradas del drawer. El router ya manda cualquier URL
desconocida al home, así que un link viejo degrada solo.

**Estilos:** las pestañas se agregan a `screens/Home/SitioInicial.css`, que es la
hoja del home. `ModoIA.css` y `ListaIA.css` se conservan: siguen siendo los
estilos de sus paneles.

### Alto del chat en celular

La lista de mensajes lleva un máximo **relativo al viewport, nunca fijo en
píxeles**, y scrollea sola; el campo de escribir queda fuera del área
scrolleable, al pie del panel.

La unidad es `dvh`, con `vh` como fallback para navegadores viejos. `vh` se
calcula contra la ventana con la barra del navegador escondida: en el momento en
que esa barra aparece, un panel medido en `vh` queda más alto que la pantalla y
el input se va abajo del borde visible. `dvh` sigue el alto real y se reacomoda.
En desktop el panel puede respirar más.

## Login

`useAuth()` expone `user`. Si es `null`, el panel se abre y se puede leer, pero
al intentar mandar el primer mensaje o elegir un archivo aparece un aviso — *"Para
usar el asistente necesitás iniciar sesión"* — con un link al login, **y no se
llama al API**.

Sin ese chequeo el backend devolvería un 401, que el cliente traduce a "Error del
servidor": un mensaje que no le explica nada al usuario.

## Testing

**Nuevo**, sobre `SitioInicial`:

- las dos pestañas se ven en el home raíz
- no se ven con un rubro elegido
- abrir una pestaña oculta el selector de rubros y muestra su panel
- tocar la pestaña activa cierra el panel y devuelve el catálogo
- tocar la otra pestaña cambia de panel sin pasar por el catálogo

Sobre los paneles:

- el invitado que intenta enviar un mensaje ve el pedido de login, y no se llama
  al API
- el invitado que elige un archivo ve lo mismo

**A modificar:** los tests actuales de `ModoIA` verifican que confirmar navega a
`/quodom`. Esa aserción se invierte: ahora tiene que probar que **no** navega y
que aparece el "Agregado ✓". El archivo se renombra junto con el componente.

**A borrar:** el test de la ruta `/lista` y el del link "Subí tu lista" en el
drawer, junto con lo que verifican.

Lo que **no** se toca: los tests de `CargarLista`, `GrupoRubro`,
`NoEncontrados` y todo el backend siguen tal cual, porque esos componentes no
cambian.
