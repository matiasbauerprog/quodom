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

Esta es la decisión que ordena todo lo demás, y vale la pena el detalle porque
define el costo y la complejidad del feature.

La búsqueda es **`places:searchText`** (ver "Cómo se busca cada rubro": el tipo de
Places se midió y se descartó). Acepta:

- `locationBias` circular de hasta **50.000 metros**,
- `maxResultCount` de hasta **20**,
- y una máscara de campos que, pedida en el nivel Enterprise, devuelve en **la
  misma respuesta** `displayName`, `location`, `id`, `rating`, `userRatingCount`
  **y `nationalPhoneNumber`** de los 20.

De ahí salen tres simplificaciones:

**No hay segunda consulta para el teléfono.** Google cobra por el campo más caro
de la máscara. `rating` y `nationalPhoneNumber` están **en el mismo nivel**, así
que pedir el teléfono de los 20 no cuesta más que pedir la puntuación. La
optimización de "pedirlo sólo del elegido" era más caro, no más barato: agregaba
una consulta.

**No hay escalado de radio.** Una sola consulta con bias de 50 km trae lo que haya
en el área; en una ciudad los resultados caen a pocas cuadras y en un pueblo
quedan desparramados, que es el comportamiento deseado. El escalado 5 → 15 → 50 km
que se consideró primero costaba tres consultas para el mismo resultado.

**No hay caché de proveedores.** No hay nada que reusar: la consulta se hace en el
momento en que se muestra el resultado. (La caché de 30 días que aparece más abajo
es de **la dirección del comprador**, no de los comercios. Son dos cosas distintas.)

> **Lo que se pierde al buscar por texto, y por qué se acepta.** `searchNearby`
> tiene `rankPreference: DISTANCE`, que garantiza "los 20 más cercanos".
> `searchText` ordena por relevancia y el `locationBias` es una preferencia, no un
> límite: en el sondeo del 2026-10-15 aparecieron resultados a 4,9 y 5,7 km
> mezclados con los de 300 metros. O sea que **no hay garantía de traer al más
> cercano** si hay muchos candidatos relevantes lejos.
>
> Se acepta porque la alternativa medida es peor: `searchNearby` por tipo devuelve
> kioscos para Librería y no existe para Pinturería. Un orden imperfecto sobre
> proveedores correctos le gana a un orden perfecto sobre resultados equivocados.
> Y el riesgo está acotado: la distancia la calculamos nosotros, así que lo que
> llegue se reordena por cercanía antes de mostrarlo, y si la lista final queda
> con todos lejos, se ve — cada uno muestra su distancia.

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

- Se descartan los que tienen **menos de 3 reseñas**. Una puntuación de 5,0 con una
  sola reseña no es información. **Pero si tras descartar quedan menos de 3**, se
  reincorporan los descartados por orden de cercanía hasta llegar a 3: mostrar pocos
  es peor que mostrar uno con poca reputación y su distancia a la vista.

  > El umbral arrancaba en 5 y se bajó a 3 con el sondeo del 2026-10-15: en
  > Librería sobra (las del barrio tienen 230, 732, 771, 946 reseñas), pero en
  > **Limpieza los comercios de barrio tienen 3, 6, 7, 9, 10**, y con 5 se perdía
  > JB Artículos de Limpieza, que está a 400 metros. El umbral tiene que dejar
  > pasar al comercio de barrio, que es justo el que el comprador quiere.
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

### Cómo se busca cada rubro: por texto, no por tipo

**Esta sección se reescribió el 2026-10-15 con mediciones reales** (sondeo sobre
Villa Ballester, los cinco rubros activos). La versión anterior estaba invertida
en todo lo que afirmaba.

**Se busca por TEXTO, para los cinco rubros.** Los tipos de Places se descartan:

| | medido |
|---|---|
| `paint_store` | **no existe**. Google responde `400 Unsupported types: paint_store`. Estaba nombrado en esta spec como el tipo de Pinturería; me lo inventé. |
| `book_store` | devuelve kioscos: "KIOSCO CYL", "Casa de karol sevilla real", "G & L". Por texto, "librería" devuelve Santa Inés (946 reseñas), Koky (771), El Chalet (732). |
| `liquor_store` | mayormente bien, pero con ruido: "404NOTFOUNDMARKET", "Casa del Perrito Marrón". |

Y la predicción de la versión anterior estaba al revés: **Papelera y Limpieza,
las dos que figuraban como "sin tipo propio, van a traer cualquier cosa", son las
que mejor funcionan** — Witpel (761 reseñas), Papelera Buenos Aires, Papelera
Italia; Ángel, La Jabonería de Ballester, Fusión Química, todas a menos de 1,5 km.

Las pinturerías reales que Google sí encuentra por texto están catalogadas como
`building_materials_store` y `hardware_store`, o sea que ni siquiera comparten un
tipo entre ellas. El tipo no es el eje por el que estos comercios están
organizados en Google; el nombre sí.

**Consecuencia técnica:** la búsqueda es `places:searchText` con `locationBias`
circular, y no `places:searchNearby` con `includedPrimaryTypes`. `searchText`
ordena por relevancia y el `locationBias` es una preferencia, no un límite — se
vieron resultados a 5,7 km con bias de 50 km. No importa: **la distancia la
calculamos nosotros igual**, así que el filtro por cercanía es nuestro y el de
Google es sólo para traer candidatos del área.

### Los términos de búsqueda son la perilla, y se calibran

`config/rubrosPlaces.js` tiene **un término por rubro** y es el único lugar donde
se tocan. Punto de partida medido:

| rubro | término | resultado del sondeo |
|---|---|---|
| 1 Limpieza | `artículos de limpieza` | 6 comercios reales a menos de 1,5 km |
| 2 Librería | `librería` | las grandes del barrio, 230–946 reseñas |
| 3 Papelera | `papelera artículos de papelería` | Witpel, Papelera Buenos Aires, Italia, Chaco |
| 5 Pintura | `pinturería` | Le Bleu, San Andrés, Devoto, Balcarce |
| 7 Bebidas | `distribuidora de bebidas` | BMG, SCR, Fullescabio |

**El mismo sondeo, el mismo día y con los mismos términos, en las otras dos zonas.**
Queda anotado acá para que "anda en las tres" sea un dato y no una afirmación: la
tabla de arriba es sólo Villa Ballester, y una zona no alcanza para elegir un término
que corre para todo el país.

**Palermo, CABA** (centro resuelto desde "Palermo, Ciudad Autónoma de Buenos Aires"):

- Limpieza: Tienda Artículos de Limpieza (5★, 147), El Cacique Limpieza (5★, 81),
  El Cacique (4,5★, 36), ARTÍCULOS DE LIMPIEZA FÉNIX (5★, 27)
- Librería: SANTA INÉS (4,4★, 946), El Chalet (4,4★, 732), Librería Catriel (4,5★, 145),
  Las Palabras Ballester (4,2★, 57), y **Librería Teorema (4,4★, 3.794 reseñas y sin teléfono)**
- Papelera: Papelera Chacarita (3,2★, 231), PAPELERA MAGIC (4,8★, 155),
  Librería y Papelera Aries (3,2★, 44), PAPELERA Y DESCARTABLES ORO (5★, 18)
- Pintura: Prestigio (4★, 351), Rex (4,9★, 223), TABARES pinturería (4,5★, 108),
  Pinturerías Liberato (4,5★, 18)
- Bebidas: Señor Bebidas (4,9★, 103), Mal Trago Liquor Store (4,4★, 33),
  Espacio bebidas (3,8★, 21), La Previa (4,9★, 11)

**Nueva Córdoba, Córdoba:**

- Limpieza: Aroma de Hogar (4,2★, 33), Aroma de Hogar mayorista (4,7★, 15),
  Todo Bien Limpito! (4,4★, 7), Distribuidora San Lorenzo
- Librería: Librería del Palacio (4,7★, 592), Librería Mil Trazos (4,3★, 655),
  OVNI Librerías (4,2★, 113)
- Papelera: **Papelera Santa Elena (4,3★, 810)**, Multipapel (4,3★, 665),
  Pencilbag mayorista (4,4★, 320), La papelera (4,4★, 32)
- Pintura: Pinturería Szumik (4,5★, 153), Garin Pinturerías (4,6★, 102),
  Pinturería Color Home (4,6★, 57), **Rex (4,1★, 453, `0800-777-7739`)**
- Bebidas: Coca Parque (4,1★, 209), Distribuidora Cofico (4,5★, 166),
  El Paraíso Distribuidora de Bebidas (4,7★, 18), Bebidas 520 (4,1★, 7)

Dos cosas que muestran estos datos y que no se ven en la tabla de Villa Ballester:

- **`book_store` es malo en CABA y aceptable en Córdoba.** En Palermo devuelve
  Cristoneitor (5★ con **una** reseña), Lirbano (sin reseñas), Almacén Astral y
  "365 Kioscos Argentinos" (2,2★); en Nueva Córdoba devuelve Librería del Palacio
  (4,7★, 592) y OVNI Librerías (4,2★, 113), que son las correctas. **Eso mismo es el
  argumento del texto**, y pesa más que cualquier promedio: un tipo cuya calidad
  depende de la ciudad no es una regla en la que se pueda confiar. El texto devolvió lo
  correcto en las dos, y en Córdoba sumó además Librería Mil Trazos (655 reseñas).
- **El comercio sin teléfono no es el caso raro.** Librería Teorema tiene **3.794
  reseñas** y Google no tiene su número. Filtrar a los que no tienen teléfono habría
  borrado del selector al mejor puntuado del rubro en CABA — por eso se muestran, con
  "ver en Maps".

> **Lo que todavía NO está calibrado: ninguna ciudad chica del interior.** Las tres
> zonas medidas son un partido del conurbano, CABA y una capital de provincia; o sea
> tres centros urbanos, que es exactamente el alcance declarado del producto. La ciudad
> chica es **la puerta manual pendiente** (ver el plan de pruebas): hasta que alguien
> corra el script ahí, "anda en las tres" dice lo que dice y nada más, y no alcanza
> para dar ese paso por cumplido.

Vive en código y no en la base por la misma razón que `config/rubros.js` lo
explica para los rubros activos: `quodom.sqlite` se commitea y corre en modo WAL,
así que **un cambio de datos no se revisa en el diff ni sobrevive con seguridad a
un reseed; un cambio de código sí**.

**El ciclo de calibración es: editar el término → correr
`node scripts/verificar-proveedores.js "<localidad>"` → mirar.** El script lee
este mismo archivo, así que lo que se prueba es lo que va a correr en producción.
Toma la localidad por parámetro, porque un término que funciona en el Gran Buenos
Aires puede no funcionar en una ciudad del interior, y eso hay que poder probarlo
sin tocar código.

Los rubros apagados (Construcción, Sanitarios, Seguridad Industrial) no tienen
término: cuando se activen, se mide el suyo antes de encenderlos.

### Un proveedor sin teléfono

**Medido, y hay dos casos distintos:**

**a) Sin teléfono.** Google no tiene número para una parte de los comercios (JB
Artículos de Limpieza, Santi Estevez, Vinotecas, y en CABA hasta Librería Teorema,
que tiene 3.794 reseñas).

**b) Con un teléfono que no recibe WhatsApp.** Rex, en Córdoba, publica
`0800-777-7739`. Es un número válido y el comercio es bueno —453 reseñas—, pero un
0800 no recibe WhatsApp. Se muestra con el botón de **llamar**, sin el de WhatsApp:
ofrecerlo sería mandar al usuario a un chat que no abre, y eso se lee como que el
comercio no tiene WhatsApp cuando el problema es el tipo de número.

Para el caso (a): A ésos no se les puede mandar WhatsApp
**ni llamarlos**, que eran las dos salidas previstas.

No se filtran: siguen en la lista, con su nombre, su puntuación y su distancia,
pero en vez de los botones de WhatsApp y llamar muestran **sólo "ver en Maps"**,
y un renglón que dice *"Google no tiene el teléfono de este comercio"*. Esconderlos
sería esconder un proveedor que al comprador puede servirle —está a tres cuadras y
tiene 4,8— por un dato que él puede conseguir solo.

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
src/config/rubrosPlaces.js         un término de texto por rubro activo (los tipos de Places se midieron y perdieron).
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
- **Escalado de radio en tres consultas**: descartado. Una sola consulta con bias
  de 50 km trae lo que haya en el área; el escalado costaba tres para lo mismo.
- **Buscar por tipo de Places** (`includedPrimaryTypes`, con texto sólo para los
  rubros sin tipo): descartado el 2026-10-15 **con mediciones**, y era el diseño
  original de esta spec. `paint_store` no existe (Google devuelve 400),
  `book_store` devuelve kioscos y `liquor_store` trae ruido. El texto gana en los
  cinco rubros activos.
- **Filtrar los proveedores sin teléfono**: descartado. Esconder un comercio a tres
  cuadras con 4,8 estrellas, porque Google no tiene su número, le saca al comprador
  una opción que podía resolver solo. Se muestra con "ver en Maps" y se dice que no
  hay teléfono.
- **Umbral de 5 reseñas**: bajado a 3. Con 5 se perdían los comercios de barrio de
  Limpieza, que tienen entre 3 y 10 reseñas y están a 400 metros.
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
2. **La calidad de los términos de búsqueda.** Medida para Villa Ballester el
   2026-10-15 y buena en los cinco rubros, pero **una sola zona no es el país**: un
   término que anda en el Gran Buenos Aires puede fallar en una ciudad chica del
   interior, donde no hay un comercio que se llame "papelera". Mitigación: el script
   toma la localidad por parámetro, así que se mide en varias zonas antes de dar B
   por terminado, y el término es un renglón de configuración.
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
- **Pueblos chicos.** El producto apunta a **centros urbanos**: CABA, AMBA y
  ciudades. Los términos de búsqueda se calibran y se validan ahí, y no se
  garantiza que funcionen en una localidad de pocos miles de habitantes, donde
  puede no haber ningún comercio que se llame "papelera" —palabra que además
  significa cesto de basura— y la búsqueda devolvería nada o cualquier cosa.
  Medido el 2026-10-15 en Villa Ballester, CABA y Córdoba —los tres, centros
  urbanos—: en las tres anda. **Ninguna ciudad chica se midió todavía**, así que
  esto es el alcance declarado y no un resultado: es la puerta manual pendiente.
