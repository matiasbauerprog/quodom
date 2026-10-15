# La dirección en el mapa, y los proveedores que la rodean

Fecha: 2026-10-14
Enmienda la regla de `claude.md` §3 que declara que no existe lógica de vendedores.

## El problema

El embudo de Quodom termina en un link sin destinatario. `whatsappLink` devuelve
`https://wa.me/?text=...` y el usuario elige en WhatsApp a quién mandárselo. La app
armó el pedido completo — productos, atributos, contacto, dirección — y en el último
paso lo suelta: **quién lo cotiza es problema del comprador**, que es justo el trabajo
que no sabe hacer y por el que vino.

Este diseño cierra ese final: al enviar, Quodom propone los proveedores del rubro más
cercanos a la dirección del pedido, con su puntuación, y el comprador elige.

Para eso hacen falta dos cosas que hoy no existen: **coordenadas de la dirección**
(hoy es texto libre, no se puede calcular distancia a nada) y **proveedores**
(no hay tabla, ni modelo, ni calificaciones).

> **Por qué esto enmienda §3 y no la contradice.** La regla dice que no hay lógica de
> vendedores: ni cotizaciones, ni ofertas, ni zonas, ni calificaciones, ni bancos.
> Sigue siendo cierto. Un proveedor acá **no es un usuario del sistema**: no se
> registra, no cotiza adentro de la app, no tiene cuenta ni perfil ni calificación
> nuestra. Es un comercio que ya existe en el mapa y al que el comprador le escribe
> por WhatsApp. No se agrega un rol: se agrega un directorio de lectura.

## Las dos mitades, y por qué en ese orden

**A — La dirección nace en el mapa.** El formulario de direcciones usa el
autocompletado de Google: el usuario escribe, elige de una lista, y los campos se
llenan solos, con coordenadas.

**B — El selector de proveedores al enviar.** Con las coordenadas, al tocar "Cotizar
por WhatsApp" aparecen los 3 a 5 proveedores del rubro más cercanos y mejor puntuados.

**Se construye A primero, completa y verificada en producción, antes de empezar B.**
No es prolijidad: es el único control posible sobre el riesgo central del feature.
Si la geocodificación está mal, **B no falla: miente.** Muestra cinco pinturerías
ordenadas por cercanía a un punto equivocado, con su puntuación y su distancia, y se
ve impecable. Ningún test puede detectarlo, porque el test no sabe dónde vive el
usuario. Se detecta cargando una dirección real y mirando el mapa. A es barata y
reversible; sirve sola (hoy una localidad mal tipeada queda mal para siempre); y es
el cimiento. Verificarla antes de construir encima es el orden que hace que un error
cueste una tarde y no una semana.

**Cada mitad lleva su propio plan de implementación.** Esta spec cubre las dos para
que el schema de la dirección nazca sirviendo al selector y no haya que migrarla dos
veces, pero son dos tandas de trabajo con una verificación manual en el medio, y
mezclarlas en un solo plan borra justamente esa pausa.

## A — La dirección

El formulario reemplaza el tipeo libre de calle y localidad por un campo de búsqueda.
Elegida una opción, Google devuelve la dirección desarmada y se llenan los campos que
ya existen.

**El autocompletado llena los campos actuales, no los reemplaza.** El mensaje de
WhatsApp no lee la dirección de `users_direcciones`: la lee de la vista
`v_InfoCompradors` (`Direccion`, `Localidad`, `Provincia`, `cp`), y `idprovincia` es
clave real contra la tabla `provincias`. Guardar sólo coordenadas y `placeid` deja al
proveedor recibiendo **un pedido sin domicilio**, y en silencio: el armado del mensaje
tiene un `if (info.Direccion && ...)` que omite el renglón cuando falta. Ese agujero
exacto ya ocurrió una vez en este proyecto y está documentado en §3.

`users_direcciones` gana tres columnas:

| columna | para qué |
|---|---|
| `placeid` | el identificador de Google. Es el único dato de Places que se puede guardar para siempre. |
| `lat`, `lng` | el punto, que es lo que B necesita. Caché de 30 días (ver más abajo). |
| `coords_actualizado` | cuándo se resolvieron, para saber cuándo vencen. |

**La provincia se traduce con una tabla escrita a mano de 24 renglones.** Google
devuelve el nombre en texto y la base guarda un `id`. Las 24 provincias son fijas y
están escritas igual que las nombra Google; la única que difiere es Tierra del Fuego,
que en Google lleva el nombre oficial largo. Es una tabla literal en
`config/provinciasGoogle.js`, **no un emparejamiento aproximado**: con 24 valores
conocidos, adivinar es peor que enumerar. Si una dirección no matchea — sólo puede
pasar fuera de Argentina, que el producto no atiende — se guarda sin `idprovincia`,
que hoy ya es válido, y se loguea.

El detalle de la vista: en CABA, Google suele devolver la comuna o el barrio en
`sublocality` y "Buenos Aires" en `locality`. Para que `Localidad` siga siendo útil al
proveedor, se prefiere `sublocality` cuando existe.

## B — El selector de proveedores

### Una sola consulta por envío

Esta es la decisión que ordena todo lo demás, y vale la pena el detalle porque define
el costo y la complejidad del feature.

La búsqueda de lugares cercanos (`places:searchNearby`) acepta:

- `locationRestriction` circular de hasta **50.000 metros**,
- `rankPreference: DISTANCE`, que ordena ascendente por distancia,
- `maxResultCount` de hasta **20**,
- y una máscara de campos que, pedida en el nivel Enterprise, devuelve en **la misma
  respuesta** `displayName`, `location`, `id`, `rating`, `userRatingCount` **y
  `nationalPhoneNumber`** de los 20.

De ahí salen tres simplificaciones:

**No hay escalado de radio.** La intención — buscar cerca y ampliar hasta juntar tres,
mostrando la distancia de cada uno — se obtiene con **una** consulta a 50 km ordenada
por distancia: en una ciudad los 20 más cercanos están a pocas cuadras; en un pueblo
están desparramados, que es exactamente el comportamiento deseado. El escalado 5 → 15
→ 50 km que se consideró primero costaba tres consultas para el mismo resultado.

**No hay segunda consulta para el teléfono.** Google cobra por el campo más caro de la
máscara. `rating` y `nationalPhoneNumber` están **en el mismo nivel**, así que pedir
el teléfono de los 20 no cuesta más que pedir la puntuación. La optimización de
"pedirlo sólo del elegido" era más caro, no más barato: agregaba una consulta.

**No hay caché de proveedores.** No hay nada que reusar: la consulta se hace en el
momento en que se muestra el resultado. (La caché de 30 días que aparece más abajo es
de **la dirección del comprador**, no de los comercios. Son dos cosas distintas.)

### Lo que se guarda y lo que no

Los términos de Google permiten archivar **el identificador de un lugar** sin límite,
y **las coordenadas** hasta 30 días corridos. Para el nombre, la puntuación y el
teléfono **no hay un permiso equivalente**: leídos literalmente, no se pueden guardar.

El diseño se acomoda a eso sin perder nada, porque cada dato se usa en un momento
distinto:

- **Se guarda** `placeid` y el orden en que se ofreció, por Quodom, para siempre.
- **Se guarda** si ya se lo contactó y cuándo. Es un hecho nuestro, no de Google.
- **No se guarda** nombre, puntuación ni teléfono. Se piden cada vez que se muestran.
- Las coordenadas de la dirección se tratan como **caché de 30 días**: pasado ese
  plazo se resuelven de nuevo desde el `placeid`, que sí es permanente.

Consecuencia práctica, y hay que aceptarla: **reabrir un pedido viejo necesita
internet y una consulta** para volver a mostrar los nombres de los proveedores que
faltan. A cambio, el dato nunca está vencido: un comercio que cerró o cambió el
teléfono se ve actualizado.

Y una obligación: la lista **muestra la atribución a Google**, como exigen los
términos.

### Desde qué punto se busca, cuando no hay punto exacto

**Medido con un usuario real el 2026-10-15, y la spec no lo contemplaba:** hay
direcciones argentinas que el autocompletado de Google **no tiene**. Buscando
"Ídolo 3720, Villa Ballester" ofrece la localidad y cuatro comercios, ninguno es
la dirección. El usuario la carga a mano y queda **sin coordenadas** — no por un
error, sino porque Google no la conoce.

Si la mitad B asumiera que toda dirección tiene punto, esos usuarios se quedarían
sin el feature entero. Y son una porción desconocida pero no marginal: el primer
usuario real que probó cayó justo ahí.

La salida está en que **nunca se desconoce del todo dónde está**: la localidad es
un campo obligatorio del formulario, y convertirla en coordenadas es una consulta
del nivel básico (10.000 gratis por mes). O sea que siempre hay un punto; lo que
cambia es la precisión.

**La regla, en tres escalones:**

1. **La dirección tiene coordenadas** → se busca desde ahí. El popup encabeza
   *"Proveedores cerca de Ídolo 3720"*.
2. **No las tiene, pero la localidad resuelve** → el servidor geocodifica
   `localidad + provincia`, **guarda ese punto** (una vez por dirección, no por
   envío) y busca desde ahí. El popup encabeza *"Proveedores cerca de Villa
   Ballester"* y aclara en chico: *"tu dirección no está ubicada con precisión —
   las distancias son desde el centro de la localidad"*, con un link para
   ubicarla.
3. **Ni la localidad resuelve** (texto mal escrito, pueblo que Google no conoce)
   → no hay lista. El popup lo dice y ofrece el camino de hoy: enviar sin
   destinatario y elegir en WhatsApp.

> **Por qué no se le pide al usuario que vaya a ubicar su dirección.** Se
> consideró y se descartó: mandarlo al formulario para que elija del buscador
> termina, cuando Google no tiene su calle, en que elija **su localidad** — que
> es el dato que el formulario ya tiene. Es hacerlo trabajar para entregar algo
> que ya está. El link para ubicarla sigue ahí, pero como mejora opcional, no
> como peaje.

> **Por qué no bloquea el envío.** Las tres cosas que frenan un Quodom son las
> que el proveedor **necesita** para cotizar. Las coordenadas no: el proveedor no
> las ve nunca, son nuestras para buscar. Convertirlas en una cuarta traba le
> sacaría a un usuario algo que hoy hace sin problemas, por un dato que antes no
> hacía falta y que en su caso no depende de él.

**Lo que la pantalla nunca hace es callar desde dónde midió.** La precisión del
punto cambia qué tan creíble es la distancia, y la distancia es lo que el usuario
usa para decidir. Mostrar "a 2 km" sin aclarar que es desde el centro del pueblo
es el mismo tipo de mentira silenciosa que el diseño viene evitando en todo lo
demás.

### El orden: distancia y puntuación

El ranking es una función pura en `helpers/rankearProveedores.js`, separada del
cliente HTTP a propósito: **es la regla que más se va a ajustar** cuando se vean
resultados reales, y pegada al `fetch` cada ajuste necesitaría simular una respuesta
de Google. Separada, se prueba con una tabla de comercios inventados.

Punto de partida, explícitamente provisorio:

- Se descartan los que tienen **menos de 5 reseñas**. Una puntuación de 5,0 con una
  sola reseña no es información. **Pero si tras descartar quedan menos de 3**, se
  reincorporan los descartados por orden de cercanía hasta llegar a 3: mostrar pocos
  es peor que mostrar uno con poca reputación y su distancia a la vista.
- Un comercio sin `rating` (no tiene ninguna reseña) se trata como descartado por la
  misma regla, no como puntuación 0.
- `puntaje = 0.6 * (rating / 5) + 0.4 * (1 - min(distanciaKm, 50) / 50)`
- Se muestran **hasta 5** — menos si no hay más — y **cada uno con su distancia en
  km**, que es lo que permite al usuario descartar al que está lejos aunque esté
  primero.
- Si no hay **ninguno**, el popup lo dice y ofrece el camino de hoy: mandar el pedido
  sin destinatario, eligiendo a mano en WhatsApp. El feature nunca deja al usuario sin
  poder enviar.

La distancia la calculamos nosotros: Google no la devuelve, y tampoco deja filtrar por
puntuación mínima. Haversine desde las coordenadas de la dirección.

### Los 8 rubros contra las categorías de Google

`config/rubrosPlaces.js` mapea cada rubro a `includedPrimaryTypes` de Places y, cuando
no hay un tipo que sirva, a una consulta de texto. Pinturería tiene `paint_store`,
Librería tiene `book_store`; Papelera y Limpieza no tienen un tipo propio y van por
texto.

**Esta tabla es donde se decide si el feature sirve o devuelve basura**, y no se puede
validar con tests (ver Testing). Se afina a mano con el script de verificación.

### El teléfono y el agujero de WhatsApp

No existe forma legítima de saber si un número tiene WhatsApp. Los servicios que lo
ofrecen funcionan conectando una cuenta real de WhatsApp y consultando como si fueran
un usuario: va contra los términos de WhatsApp y **el número conectado es el que se
expone a ser bloqueado**. Se descarta, gratis o pago.

Entonces el objetivo no es evitar el caso, es **que cueste poco y pase una sola vez**:

1. **Formato correcto.** Un celular argentino necesita ir en formato internacional con
   el 9 y sin el 15, o WhatsApp no abre el chat **aunque el comercio sí lo tenga**.
   Se normaliza con una biblioteca de teléfonos (tipo `libphonenumber`), que de paso
   **clasifica celular contra fijo** sin internet y sin costo.
2. **Aviso sólo en los fijos.** El renglón de un fijo avisa que puede no tener
   WhatsApp. No bloquea: un fijo puede tener WhatsApp Business. Un celular no lleva
   aviso, así que el aviso no se vuelve ruido.
3. **Salida alternativa en el mismo renglón.** Botón de llamar (`tel:`) y de ver en
   Maps. Si WhatsApp no funciona, el usuario resuelve ahí y no vuelve a buscar.
4. **El sistema aprende.** Si el usuario reporta que falló, eso queda contra el
   `placeid` **para siempre** y ese comercio baja en el orden y aparece con aviso para
   todos. Es una observación nuestra, no un dato de Google: nos pertenece y se puede
   guardar sin límite. Es el único dato propio que el feature acumula, y lo que hace
   que la lista de una zona mejore con el uso.

### Qué significa "enviado"

**El Quodom pasa a `ENVIADO` cuando el usuario toca el primer proveedor.** No queda
otra: lo único observable es el toque del botón; lo que pasa dentro de WhatsApp no se
ve. Fingir más conocimiento que eso sería peor que aceptar el límite.

Eso no cambia la máquina de estados — hoy `ENVIADO` ya ocurre al generar el link — y
encaja con el flujo: al pasar a `ENVIADO`, el pedido **sale solo del árbol del panel**,
que muestra únicamente los `CREADO`. El usuario queda naturalmente empujado al
historial, que es donde viven los proveedores que faltan.

Cada proveedor se marca contactado al tocarlo, con fecha. **Y se puede desmarcar:**
"no se envió" lo devuelve a la lista, y ese mismo gesto alimenta el punto 4 de arriba.
Un toque, dos usos.

## Backend

`openapi.yaml` primero, como manda §2. Endpoints:

| endpoint | qué hace |
|---|---|
| `GET /lugares/sugerencias?q=&sesion=` | autocompletado de direcciones. Devuelve `[{placeid, texto}]`. `sesion` es el token de sesión de Google, que la app genera y repite mientras el usuario tipea: es lo que hace que la tanda de sugerencias no se cobre aparte de la consulta final. |
| `GET /lugares/{placeid}` | la dirección desarmada y sus coordenadas. Cierra la sesión de autocompletado. |
| `GET /quodom/proveedores/{id}` | hasta 5 proveedores del rubro del Quodom, con nombre, puntuación, reseñas, distancia, teléfono, si es fijo, y si fue reportado sin WhatsApp. Más `radiokm` y la atribución. |
| `GET /quodom/whatsapp/{id}?proveedor={placeid}` | **extiende el endpoint actual.** Con `proveedor`: resuelve el teléfono, marca contactado, pasa a `ENVIADO` y devuelve `wa.me/<tel>?text=`. Sin `proveedor`: comportamiento de hoy, link sin destinatario. |
| `POST /quodom/proveedores/{id}/no-enviado` | desmarca un contactado. Cuerpo `{placeid, motivo}`; con `motivo: 'sin_whatsapp'` deja además la anotación permanente contra ese `placeid`. |

> Es `POST .../no-enviado` y no `DELETE .../contactado` porque lleva cuerpo: un `DELETE`
> con cuerpo es legal pero el validador de `openapi.yaml` y varios clientes lo tratan
> distinto, y acá el `motivo` no es opcional de adorno — es el que alimenta el
> aprendizaje.

Se conserva el camino sin destinatario a propósito: es la salida para mandarle el
pedido a un proveedor propio que no está en la lista, y es gratis porque es lo que ya
funciona.

Archivos nuevos:

```
src/helpers/places.js              dueño del fetch a Google. Nadie más sabe que existe.
src/helpers/rankearProveedores.js  puro: lista + punto → orden. Sin HTTP.
src/helpers/telefonoWhatsapp.js    normaliza a internacional y clasifica celular/fijo.
src/config/rubrosPlaces.js         los 8 rubros → tipos de Places o consulta de texto.
src/config/provinciasGoogle.js     las 24 provincias → id de nuestra tabla.
src/controllers/lugares.controller.js
src/controllers/proveedores.controller.js
src/models/quodom_proveedores.model.js     idquodom, placeid, orden, contactado_en
src/models/lugares_sinwhatsapp.model.js    placeid, reportes, actualizado
```

`places.js` copia la forma de `gemini.js`, que es el precedente de un HTTP externo
pago: un solo archivo con el `fetch`, timeout propio, y el formato de Google
encapsulado.

**Las llamadas a Google salen del servidor, nunca del navegador.** Tres razones: la
clave queda secreta (en el bundle se lee, y se restringe sólo por referrer, que es
débil para algo que se cobra por uso); se le aplica `rateLimit`, que ya existe; y el
contrato sigue siendo `openapi.yaml`.

Variables de entorno nuevas: `GOOGLE_MAPS_API_KEY` (`sync: false` en `render.yaml`,
cargada a mano en el dashboard, **nunca al repo**, igual que `GEMINI_API_KEY`),
`PLACES_RADIO_METROS` (50000), `PLACES_MAX_RESULTADOS` (20),
`PROVEEDORES_POR_PEDIDO` (5), `PLACES_TIMEOUT_MS`, y un tope diario de búsquedas por
usuario.

## App

```
screens/Direcciones/            el campo de autocompletado (A)
quodom/DialogoProveedores.tsx   el popup al enviar (B)
screens/Quodom/DetalleQuodom.tsx  "contactaste 2 de 5" y los que faltan
```

El popup aparece siempre al enviar, después de las tres trabas que ya existen
(productos, atributos, dirección). Cada renglón: nombre, estrellas con cantidad de
reseñas, distancia, y los botones WhatsApp / llamar / ver en Maps. El contactado queda
marcado con la opción de deshacer.

## Testing

Google es externo **y pago**: si los tests le pegaran de verdad, cada corrida gasta
plata y la suite se cae con internet. Se copia la solución que este proyecto ya usa
para la IA: **`places.js` se mockea**, como `callGemini`. Nada le pega a Google.

Tres cosas necesitan trato propio:

- **El ranking lleva la mayor parte de los tests.** Es puro: cinco comercios
  inventados con su distancia y puntuación, y se verifica el orden. Sin HTTP, sin
  base. Es la pieza que más se va a tocar, así que es la que tiene que ser más barata
  de probar.
- **El teléfono se prueba con una tabla de números reales**: celular de CABA, celular
  del interior, fijo, uno con 15, uno ya internacional. Cada uno con su resultado
  esperado. Esto es lo que evita que el feature falle por cómo escribimos el número.
- **La calidad de los resultados no se puede testear.** Ningún test sabe si buscar
  "papelera" devuelve papelerías o librerías. Para eso va un **script de verificación
  manual** (`api/scripts/verificar-proveedores.js`), que corre con la clave real sobre
  cinco direcciones — CABA, Gran Buenos Aires, ciudad del interior, pueblo chico, y una
  zona sin comercios — e imprime qué encontró por rubro. No es parte de la suite, no
  corre solo, cuesta centavos. **Es la herramienta con la que se afina
  `rubrosPlaces.js`, y la pieza más importante del feature**: lo demás es plomería.

## Costos, con números

| | precio | gratis por mes |
|---|---|---|
| Búsqueda de cercanos con puntuación y teléfono | ~US$35 / 1.000 | ~1.000 consultas |
| Datos de una dirección elegida (nivel básico) | ~US$5 / 1.000 | ~10.000 consultas |
| Autocompletado que termina en una dirección elegida | no se cobra aparte | — |

Una consulta por pedido enviado: **los primeros ~1.000 pedidos del mes son gratis**, y
de ahí en adelante **~3,5 centavos de dólar por pedido enviado**.

A eso se le suma, ocasionalmente, **una consulta del nivel básico** cuando las
coordenadas de la dirección pasaron los 30 días y hay que resolverlas de nuevo desde
el `placeid`. Cae en el tramo de 10.000 gratis por mes, así que en la práctica no
cuesta, pero existe y conviene no olvidarla al medir.

> Estos precios salen de análisis de terceros, no de la página de Google, y los niveles
> por campo cambian. **Verificar en la consola al crear la clave** antes de presupuestar.

La regla que mantiene esto en pie: **las consultas se hacen al enviar, nunca al
navegar.** Si el popup se abriera al mirar un Quodom, el número se multiplica por las
visitas. De ahí el tope diario por usuario.

## Decisiones tomadas, y lo que se descartó

- **Padrón propio de proveedores** (cargado por Quodom, con puntuación propia):
  descartado. Alguien tiene que cargarlo y mantenerlo, y hasta tener volumen el
  selector muestra poco o nada en la mayoría de las zonas. Places da cobertura
  nacional el día uno.
- **Escalado de radio en tres consultas**: descartado al descubrir
  `rankPreference: DISTANCE` con 20 resultados a 50 km. Mismo resultado, un tercio del
  costo.
- **Pedir el teléfono aparte, sólo del elegido**: descartado. Está en el mismo nivel de
  precio que la puntuación, así que la consulta extra era gasto puro.
- **Caché de 30 días de nombre, puntuación y teléfono**: descartado. Los términos sólo
  habilitan `placeid` (permanente) y coordenadas (30 días). Además ya no hace falta.
- **Verificar si un número tiene WhatsApp**: descartado. Sólo existe por vías no
  oficiales que exponen el número conectado a ser bloqueado.
- **Geocodificar la dirección de texto que ya está guardada**, sin tocar el formulario:
  descartado. Saltea la mitad A, pero el texto libre geocodifica mal — calle mal
  escrita, número faltante, una localidad que existe en cuatro provincias — y cada uno
  de esos casos no da error, da el centro de otra ciudad.
- **Mandar a los 3-5 proveedores de una vez**: imposible. `wa.me` abre un chat; WhatsApp
  no acepta varios destinatarios en un link y las listas de difusión no se abren por
  URL. Lo único que manda a muchos es la API de WhatsApp Business, que requiere número
  propio, plantillas aprobadas y que el destinatario haya aceptado recibir mensajes:
  nada de eso aplica a un comercio sacado del mapa.

## Riesgos

1. **La geocodificación silenciosa.** El riesgo central, y por eso A va primero y se
   verifica a mano en producción con direcciones reales.
2. **La calidad del mapeo de rubros.** Papelera y Limpieza van por texto y pueden traer
   cualquier cosa. Mitigación: el script de verificación, antes de dar B por terminado.
3. **El número que no tiene WhatsApp.** Inevitable. Mitigado por el aviso en fijos, el
   botón de llamar, y el aprendizaje por `placeid`.
4. **El costo si las consultas se disparan desde el navegador o al navegar.** Mitigado
   por: la clave sólo en el servidor, `rateLimit`, tope diario por usuario, y la regla
   de consultar sólo al enviar.
5. **Los términos de Google cambian.** El diseño toca el mínimo posible (`placeid` y
   coordenadas), que es la parte más estable de esos términos.

## Qué queda afuera

- Que el proveedor responda dentro de Quodom. Sigue contestando por WhatsApp, a mano.
- Comparar cotizaciones. No hay cotizaciones en el sistema.
- Puntuación propia de proveedores, reseñas de usuarios, o cualquier forma de registro
  de proveedores. Lo único propio que se acumula es "este `placeid` no tuvo WhatsApp".
- Elegir el radio o la cantidad de proveedores desde la UI. Son constantes de
  configuración hasta que haya datos de uso que justifiquen exponerlas.
- Direcciones fuera de Argentina.
