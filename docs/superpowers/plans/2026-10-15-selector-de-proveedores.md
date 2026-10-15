# Selector de proveedores (mitad B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que al enviar un Quodom por WhatsApp, Quodom proponga los proveedores del rubro más cercanos a la dirección, el comprador elija, y lo que falte contactar quede retomable desde el historial.

**Architecture:** Al tocar "Cotizar por WhatsApp", la app le pide a **nuestro** API los proveedores del Quodom. El API resuelve el punto (coordenadas de la dirección, o el centro de su localidad), busca en Places por **texto** según el rubro, ordena por distancia y puntuación con una función pura, y devuelve hasta 5. La elección de uno construye el link `wa.me`, lo deja anotado y pasa el Quodom a `ENVIADO`. De Places no se guarda nada salvo el `place_id`.

**Tech Stack:** Express + Sequelize + SQLite (CommonJS, `api/`), React 18 + Vite + TypeScript + CSS plano (`app/`), Jest + supertest, Vitest + Testing Library, Places API (New) — `places:searchText`, y `libphonenumber-js` (dependencia nueva).

**Spec:** `docs/superpowers/specs/2026-10-14-direccion-en-mapa-y-proveedores-design.md`

## Global Constraints

- **OpenAPI manda.** Todo cambio de API empieza en `api/openapi.yaml`. El validador **descarta todo campo que el contrato no declare**. Después: `cd app && npm run api-types`.
- **UI en español, código y commits en inglés.**
- **`places.js` es el único archivo que habla con Google.** En tests se mockea entero (`jest.mock('../src/helpers/places')`), como `callGemini`. **Ningún test le pega a Google**: es un servicio pago.
- **De Places sólo se archiva el `place_id`** (permanente) y las coordenadas (30 días). Nombre, puntuación y teléfono **no se guardan nunca**: se piden cada vez que se muestran, y la lista muestra la atribución a Google.
- **El precio lo fija el campo más caro de la máscara.** `rating`, `userRatingCount` y `nationalPhoneNumber` son del nivel Enterprise, y van en la **misma** consulta: pedirlos aparte es más caro, no más barato.
- **Las consultas se hacen al enviar, nunca al navegar.** Más el tope por usuario y por minuto, con **scope propio** (`perUserPerMinute(limit, 'proveedores')`): sin scope comparte balde con el chat de IA.
- **Dependencia nueva:** `libphonenumber-js` en `api/`. Va porque Argentina tiene más de 300 códigos de área de 2 a 4 dígitos y hay que saber dónde termina el área para decidir si el `15` que sigue es un celular; equivocarse no da error, da un chat que no abre.
- **Trampa de la base (§6):** `quodom.sqlite` está trackeada y es la que se despliega; corre en WAL y `model.sync()` **nunca hace ALTER**. Tras cambiar el schema: migración, `wal_checkpoint(TRUNCATE)`, commit, y **verificar el blob commiteado**. En Windows, extraerlo a una ruta **nativa**, no a `/tmp`: node no entiende las rutas de Git Bash y `sqlite3` crea ahí una base vacía, con lo que la verificación pasa en falso.
- **Tests de API: SQLite real en memoria.** **Fechas en fixtures: relativas, nunca absolutas.**
- **Mobile-first.** Breakpoints: tablet 601–1024px, desktop ≥1025px. Forma de hoja: `border-top-left-radius: 8px; border-bottom-right-radius: 8px`. `--color-whatsapp` es sólo del botón de WhatsApp.
- **No tocar** `F:\backup\...\API` ni `...\APP`, ni `quodom-new/`.

## Review Focus

Cinco entradas que la spec implica y que ningún task debería dejar sin test.

1. **Un rubro sin resultados en esa zona.** Esperable: el popup lo dice y ofrece enviar sin destinatario — el camino de hoy —, nunca deja al usuario sin poder enviar. → Task 7.
2. **Un proveedor sin teléfono.** Medido: existen. Esperable: aparece en la lista con su puntuación y distancia, sin botones de WhatsApp ni llamar, y diciendo que Google no tiene su número. → Tasks 3 y 9.
3. **Una dirección sin coordenadas ni localidad resoluble.** Esperable: sin lista, con el camino de hoy ofrecido; nunca un punto inventado. → Task 6.
4. **Un teléfono fijo, y uno con `15`.** Esperable: el `15` se convierte en el formato que WhatsApp abre; el fijo se marca como "puede no tener WhatsApp" pero **no se bloquea**. → Task 2.
5. **Google caído o sin clave en el momento de enviar.** Esperable: el envío **no se traba** — el popup dice que no pudo buscar y ofrece enviar sin destinatario. Que el buscador de proveedores falle nunca puede impedir mandar un pedido. → Task 7.

---

### Task 1: Los términos de búsqueda por rubro

**Files:**
- Create: `quodom-web/api/src/config/rubrosPlaces.js`
- Test: `quodom-web/api/tests/rubrosPlaces.test.js`

**Interfaces:**
- Consumes: `RUBROS_ACTIVOS` de `src/config/rubros`.
- Produces: `terminoDeRubro(idrubro: number): string | null`

- [ ] **Step 1: Write the failing test**

```js
// quodom-web/api/tests/rubrosPlaces.test.js
const { terminoDeRubro, TERMINOS } = require('../src/config/rubrosPlaces');
const { RUBROS_ACTIVOS } = require('../src/config/rubros');

describe('terminoDeRubro', () => {
  // Medidos contra Places el 2026-10-15 sobre Villa Ballester; cada uno trajo
  // comercios reales del rubro. Cambiarlos es la perilla de calibración.
  it('devuelve el término medido de cada rubro', () => {
    expect(terminoDeRubro(1)).toBe('artículos de limpieza');
    expect(terminoDeRubro(2)).toBe('librería');
    expect(terminoDeRubro(3)).toBe('papelera artículos de papelería');
    expect(terminoDeRubro(5)).toBe('pinturería');
    expect(terminoDeRubro(7)).toBe('distribuidora de bebidas');
  });

  it('acepta el id como string, que es como llega de los params', () => {
    expect(terminoDeRubro('5')).toBe('pinturería');
  });

  it('devuelve null para un rubro que no tiene término', () => {
    expect(terminoDeRubro(4)).toBeNull();
    expect(terminoDeRubro(999)).toBeNull();
    expect(terminoDeRubro(null)).toBeNull();
  });

  // Si alguien activa un rubro y se olvida de medirle el término, el selector
  // quedaría mudo en ese rubro sin que nada falle. Esto lo hace fallar acá.
  it('todo rubro activo tiene su término', () => {
    const sinTermino = RUBROS_ACTIVOS.filter(id => !TERMINOS[id]);
    expect(sinTermino).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/api && npx jest tests/rubrosPlaces.test.js`
Expected: FAIL — `Cannot find module '../src/config/rubrosPlaces'`

- [ ] **Step 3: Write minimal implementation**

```js
// quodom-web/api/src/config/rubrosPlaces.js
/**
 * Con qué texto se busca cada rubro en Google Places.
 *
 * **Se busca por texto y no por tipo de Places**, y eso está medido, no supuesto
 * (sondeo del 2026-10-15 sobre Villa Ballester): `paint_store` no existe —Google
 * devuelve 400—, `book_store` devuelve kioscos, y `liquor_store` trae ruido. El
 * texto gana en los cinco rubros activos.
 *
 * **Esta tabla es la perilla de calibración del feature.** El ciclo es: cambiar
 * un término, correr `node scripts/verificar-proveedores.js "<localidad>"`, y
 * mirar qué devuelve. El script lee este mismo archivo, así que lo que se prueba
 * es lo que corre en producción.
 *
 * Vive en código y no en la base por lo mismo que `config/rubros.js`: la base se
 * commitea y corre en WAL, así que un cambio de datos no se revisa en el diff ni
 * sobrevive con seguridad a un reseed. Un cambio de código sí.
 *
 * Los rubros apagados no tienen término: cuando se activen, se les mide el suyo
 * antes de encenderlos, y el test de este archivo lo exige.
 */
const TERMINOS = {
  1: 'artículos de limpieza',          // Ángel, JB, La Jabonería, Fusión Química
  2: 'librería',                       // Santa Inés, Koky, El Chalet, Tríada
  3: 'papelera artículos de papelería', // Witpel, Papelera Buenos Aires, Italia
  5: 'pinturería',                     // Le Bleu, San Andrés, Devoto, Balcarce
  7: 'distribuidora de bebidas'        // BMG, SCR, Fullescabio
};

function terminoDeRubro(idrubro) {
  const t = TERMINOS[Number(idrubro)];
  return t === undefined ? null : t;
}

module.exports = { terminoDeRubro, TERMINOS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quodom-web/api && npx jest tests/rubrosPlaces.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add quodom-web/api/src/config/rubrosPlaces.js quodom-web/api/tests/rubrosPlaces.test.js
git commit -m "feat(api): add the measured search term for each rubro"
```

---

### Task 2: El teléfono argentino

Convierte lo que devuelve Google al formato que abre WhatsApp, y dice si es celular o fijo.

**Files:**
- Create: `quodom-web/api/src/helpers/telefonoWhatsapp.js`
- Modify: `quodom-web/api/package.json` (dependencia `libphonenumber-js`)
- Test: `quodom-web/api/tests/telefonoWhatsapp.test.js`

**Interfaces:**
- Consumes: `libphonenumber-js`.
- Produces: `analizarTelefono(nacional: string | null | undefined): { e164: string | null, esFijo: boolean, sirveWhatsapp: boolean, original: string } | null` — `null` cuando no hay teléfono o no se puede interpretar. `sirveWhatsapp` es `false` para los que no pueden recibirlo (0800 y demás gratuitos), aunque sean números válidos.

- [ ] **Step 1: Install the dependency**

Run: `cd quodom-web/api && npm install libphonenumber-js`
Expected: se agrega a `dependencies` en `package.json` y al `package-lock.json`.

- [ ] **Step 2: Write the failing test**

Los números son **reales**, del sondeo del 2026-10-15.

```js
// quodom-web/api/tests/telefonoWhatsapp.test.js
const { analizarTelefono } = require('../src/helpers/telefonoWhatsapp');

describe('analizarTelefono', () => {
  // Un celular argentino necesita el 9 y NO el 15, o WhatsApp no abre el chat
  // aunque el comercio sí lo tenga. Es el modo de falla más caro del feature:
  // el número está bien y el link igual no funciona.
  it('convierte un celular con 15 al formato que abre WhatsApp', () => {
    const r = analizarTelefono('011 15-5481-2951');
    expect(r.e164).toBe('+5491154812951');
    expect(r.esFijo).toBe(false);
  });

  it('convierte otro celular con 15', () => {
    expect(analizarTelefono('011 15-2403-4527').e164).toBe('+5491124034527');
  });

  it('deja un fijo sin el 9 y lo marca como fijo', () => {
    const r = analizarTelefono('011 4767-0915');
    expect(r.e164).toBe('+541147670915');
    expect(r.esFijo).toBe(true);
  });

  it('interpreta un número ya en formato internacional', () => {
    expect(analizarTelefono('+54 11 4767-0915').e164).toBe('+541147670915');
  });

  it('interpreta un celular del interior', () => {
    const r = analizarTelefono('0351 15-555-4444');
    expect(r.e164.startsWith('+549351')).toBe(true);
    expect(r.esFijo).toBe(false);
  });

  // MEDIDO en Córdoba el 2026-10-15: Rex publica 0800-777-7739, y tiene 453
  // reseñas, o sea que es un proveedor que el comprador quiere. Un 0800 NO
  // recibe WhatsApp y tampoco es un fijo común: es un número de atención. Si se
  // lo trata como teléfono normal, el usuario toca WhatsApp, se va, y no abre —
  // el mismo modo de falla silencioso que este helper existe para evitar.
  it('marca un 0800 como no apto para WhatsApp', () => {
    const r = analizarTelefono('0800-777-7739');
    expect(r.sirveWhatsapp).toBe(false);
  });

  it('un celular sí sirve para WhatsApp', () => {
    expect(analizarTelefono('011 15-5481-2951').sirveWhatsapp).toBe(true);
  });

  // Un fijo puede tener WhatsApp Business, así que sirve: lo que lleva es el
  // aviso, no la prohibición.
  it('un fijo sirve para WhatsApp, con aviso', () => {
    const r = analizarTelefono('011 4767-0915');
    expect(r.sirveWhatsapp).toBe(true);
    expect(r.esFijo).toBe(true);
  });

  // Review Focus 2: Google no tiene el teléfono de todos los comercios.
  it('devuelve null cuando no hay teléfono', () => {
    expect(analizarTelefono(null)).toBeNull();
    expect(analizarTelefono('')).toBeNull();
    expect(analizarTelefono(undefined)).toBeNull();
  });

  it('devuelve null cuando el texto no es un teléfono interpretable', () => {
    expect(analizarTelefono('consultar por mail')).toBeNull();
  });

  // Conserva lo que Google dio, para mostrarlo tal cual al usuario: el link usa
  // el E.164 pero en pantalla se lee mejor el formato local.
  it('conserva el original para mostrarlo', () => {
    expect(analizarTelefono('011 4767-0915').original).toBe('011 4767-0915');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd quodom-web/api && npx jest tests/telefonoWhatsapp.test.js`
Expected: FAIL — `Cannot find module '../src/helpers/telefonoWhatsapp'`

- [ ] **Step 4: Write minimal implementation**

```js
// quodom-web/api/src/helpers/telefonoWhatsapp.js
/**
 * El teléfono que devuelve Google, llevado al formato que abre WhatsApp.
 *
 * Un celular argentino va con el **9** después del 54 y **sin el 15**. Si se le
 * pasa a `wa.me` como viene, no abre el chat **aunque el comercio sí tenga
 * WhatsApp**: el feature falla por cómo escribimos el número, no por el comercio.
 *
 * Se usa libphonenumber y no reglas propias porque Argentina tiene más de 300
 * códigos de área de 2 a 4 dígitos, y hay que saber dónde termina el área para
 * saber si el `15` que sigue es parte del número o la marca de celular.
 *
 * `esFijo` sirve para avisar que puede no tener WhatsApp. Es un aviso y no un
 * bloqueo: un fijo puede tener WhatsApp Business.
 */
const { parsePhoneNumberFromString } = require('libphonenumber-js');

function analizarTelefono(nacional) {
  const original = (nacional || '').trim();
  if (original === '') return null;

  const n = parsePhoneNumberFromString(original, 'AR');
  if (!n || !n.isValid()) return null;

  const tipo = n.getType();

  // Un 0800 es un número válido que NO recibe WhatsApp (medido: Rex, Córdoba,
  // 0800-777-7739, con 453 reseñas). Lo mismo cualquier número de tarifa
  // especial. Se devuelven igual, para poder mostrarlos y ofrecer "llamar",
  // pero marcados: ofrecer WhatsApp ahí es mandar al usuario a un chat que no
  // abre, y eso se lee como "el comercio no tiene WhatsApp".
  const noRecibe = ['TOLL_FREE', 'PREMIUM_RATE', 'SHARED_COST', 'VOICEMAIL'];

  return {
    e164: n.number,
    esFijo: tipo === 'FIXED_LINE',
    sirveWhatsapp: !noRecibe.includes(tipo),
    original
  };
}

module.exports = { analizarTelefono };
```

> Si algún caso del test no pasa, **el que manda es el test**: son números
> reales. Ajustar la implementación, nunca la expectativa. Si libphonenumber
> devuelve `FIXED_LINE_OR_MOBILE` para algún número argentino, tratarlo como
> **no fijo** (no mostrar el aviso): un aviso de más en un celular es ruido en
> todos los renglones, y el aviso sólo vale si es raro.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd quodom-web/api && npx jest tests/telefonoWhatsapp.test.js`
Expected: PASS, 8 tests

- [ ] **Step 6: Commit**

```bash
git add quodom-web/api/src/helpers/telefonoWhatsapp.js quodom-web/api/tests/telefonoWhatsapp.test.js \
        quodom-web/api/package.json quodom-web/api/package-lock.json
git commit -m "feat(api): format Argentine phone numbers the way WhatsApp opens them"
```

---

### Task 3: El orden de los proveedores

Pura. Es la pieza que más se va a tocar cuando se vean resultados reales, así que no toca HTTP ni base.

**Files:**
- Create: `quodom-web/api/src/helpers/rankearProveedores.js`
- Test: `quodom-web/api/tests/rankearProveedores.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `distanciaKm(a: {lat,lng}, b: {lat,lng}): number`
  - `rankear(candidatos, centro, opciones?): Proveedor[]` — `Proveedor` es `{ placeid, nombre, rating, resenas, distanciaKm, telefono, esFijo, sinTelefono, direccion }`. `opciones` = `{ cuantos = 5, minResenas = 3 }`.

- [ ] **Step 1: Write the failing test**

```js
// quodom-web/api/tests/rankearProveedores.test.js
const { rankear, distanciaKm } = require('../src/helpers/rankearProveedores');

const CENTRO = { lat: -34.5492, lng: -58.5588 }; // Villa Ballester

function cand(nombre, lat, lng, rating, resenas, extra = {}) {
  return { placeid: 'p-' + nombre, nombre, lat, lng, rating, resenas, ...extra };
}

describe('distanciaKm', () => {
  it('mide en kilómetros entre dos puntos', () => {
    // Villa Ballester a Obelisco: ~20 km en línea recta.
    expect(distanciaKm(CENTRO, { lat: -34.6037, lng: -58.3816 })).toBeGreaterThan(15);
    expect(distanciaKm(CENTRO, { lat: -34.6037, lng: -58.3816 })).toBeLessThan(25);
  });

  it('da cero sobre el mismo punto', () => {
    expect(distanciaKm(CENTRO, CENTRO)).toBeCloseTo(0, 5);
  });
});

describe('rankear', () => {
  it('devuelve a lo sumo los pedidos', () => {
    const muchos = Array.from({ length: 12 }, (_, i) =>
      cand('c' + i, CENTRO.lat + i / 1000, CENTRO.lng, 4.5, 50));
    expect(rankear(muchos, CENTRO)).toHaveLength(5);
  });

  it('calcula la distancia de cada uno desde el centro', () => {
    const out = rankear([cand('cerca', CENTRO.lat, CENTRO.lng, 4.5, 50)], CENTRO);
    expect(out[0].distanciaKm).toBeCloseTo(0, 2);
  });

  // La regla: 60% puntuación, 40% cercanía. Un 4,9 a 3 km le gana a un 3,5 a
  // 500 metros, porque el comprador puede ir un poco más lejos pero no puede
  // arreglar un mal proveedor.
  it('prefiere mejor puntuado aunque esté un poco más lejos', () => {
    const out = rankear([
      cand('malo-cerca', CENTRO.lat + 0.004, CENTRO.lng, 3.5, 40),
      cand('bueno-lejos', CENTRO.lat + 0.027, CENTRO.lng, 4.9, 40)
    ], CENTRO);
    expect(out[0].nombre).toBe('bueno-lejos');
  });

  it('a igual puntuación gana el más cercano', () => {
    const out = rankear([
      cand('lejos', CENTRO.lat + 0.05, CENTRO.lng, 4.5, 40),
      cand('cerca', CENTRO.lat + 0.001, CENTRO.lng, 4.5, 40)
    ], CENTRO);
    expect(out[0].nombre).toBe('cerca');
  });

  // Medido: en Limpieza los comercios de barrio tienen 3 a 10 reseñas. Un
  // umbral alto los borra justo a ellos, que son los que el comprador quiere.
  it('descarta los de menos de 3 reseñas cuando hay de sobra', () => {
    const out = rankear([
      cand('con-una', CENTRO.lat, CENTRO.lng, 5, 1),
      cand('a', CENTRO.lat + 0.01, CENTRO.lng, 4.5, 30),
      cand('b', CENTRO.lat + 0.02, CENTRO.lng, 4.4, 30),
      cand('c', CENTRO.lat + 0.03, CENTRO.lng, 4.3, 30)
    ], CENTRO);
    expect(out.map(p => p.nombre)).not.toContain('con-una');
    expect(out).toHaveLength(3);
  });

  // Mostrar uno es peor que mostrar tres con poca reputación y la distancia
  // a la vista: el usuario decide, pero necesita opciones.
  it('reincorpora los descartados si quedan menos de tres', () => {
    const out = rankear([
      cand('con-una', CENTRO.lat, CENTRO.lng, 5, 1),
      cand('con-dos', CENTRO.lat + 0.001, CENTRO.lng, 4, 2),
      cand('bueno', CENTRO.lat + 0.01, CENTRO.lng, 4.5, 30)
    ], CENTRO);
    expect(out).toHaveLength(3);
  });

  it('un comercio sin ninguna reseña se trata como descartado, no como cero', () => {
    const out = rankear([
      cand('sin-rating', CENTRO.lat, CENTRO.lng, undefined, 0),
      cand('a', CENTRO.lat + 0.01, CENTRO.lng, 4.5, 30),
      cand('b', CENTRO.lat + 0.02, CENTRO.lng, 4.4, 30),
      cand('c', CENTRO.lat + 0.03, CENTRO.lng, 4.3, 30)
    ], CENTRO);
    expect(out.map(p => p.nombre)).not.toContain('sin-rating');
  });

  // Review Focus 2: medido, existen. Siguen en la lista.
  it('un proveedor sin teléfono queda en la lista, marcado', () => {
    const out = rankear([
      cand('sin-tel', CENTRO.lat, CENTRO.lng, 4.8, 30, { telefono: null }),
      cand('con-tel', CENTRO.lat + 0.01, CENTRO.lng, 4.0, 30, { telefono: '+5491154812951', esFijo: false })
    ], CENTRO);
    const sinTel = out.find(p => p.nombre === 'sin-tel');
    expect(sinTel).toBeDefined();
    expect(sinTel.sinTelefono).toBe(true);
  });

  it('los reportados sin WhatsApp bajan al final', () => {
    const out = rankear([
      cand('reportado', CENTRO.lat, CENTRO.lng, 5, 100, { sinWhatsapp: true }),
      cand('normal', CENTRO.lat + 0.02, CENTRO.lng, 4.0, 30)
    ], CENTRO);
    expect(out[0].nombre).toBe('normal');
  });

  it('sin candidatos devuelve lista vacía, no explota', () => {
    expect(rankear([], CENTRO)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/api && npx jest tests/rankearProveedores.test.js`
Expected: FAIL — `Cannot find module '../src/helpers/rankearProveedores'`

- [ ] **Step 3: Write minimal implementation**

```js
// quodom-web/api/src/helpers/rankearProveedores.js
/**
 * De la lista cruda que devuelve Places al puñado que se le muestra al comprador.
 *
 * Separada del cliente HTTP a propósito: **es la regla que más se va a ajustar**
 * cuando se vean resultados reales, y pegada al `fetch` cada ajuste necesitaría
 * simular una respuesta de Google. Acá se prueba con una tabla de comercios
 * inventados, instantáneo.
 *
 * Google no devuelve distancia ni deja filtrar por puntuación mínima, así que
 * las dos cosas son nuestras.
 */
const CUANTOS = 5;
const MIN_RESENAS = 3;
const PESO_PUNTUACION = 0.6;
const PESO_CERCANIA = 0.4;
const TOPE_KM = 50;

function distanciaKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180;
  const la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function puntaje(p) {
  const porEstrellas = (p.rating || 0) / 5;
  const porCerca = 1 - Math.min(p.distanciaKm, TOPE_KM) / TOPE_KM;
  const base = PESO_PUNTUACION * porEstrellas + PESO_CERCANIA * porCerca;
  // Un comercio que ya le falló a alguien por WhatsApp no se esconde, pero no
  // encabeza: es una observación nuestra, acumulada por el uso.
  return p.sinWhatsapp ? base - 1 : base;
}

function rankear(candidatos, centro, opciones = {}) {
  const cuantos = opciones.cuantos || CUANTOS;
  const minResenas = opciones.minResenas != null ? opciones.minResenas : MIN_RESENAS;

  const conDistancia = (candidatos || []).map(c => ({
    placeid: c.placeid,
    nombre: c.nombre,
    rating: c.rating != null ? c.rating : null,
    resenas: c.resenas || 0,
    distanciaKm: distanciaKm(centro, { lat: c.lat, lng: c.lng }),
    telefono: c.telefono || null,
    esFijo: !!c.esFijo,
    sinTelefono: !c.telefono,
    sinWhatsapp: !!c.sinWhatsapp,
    direccion: c.direccion || ''
  }));

  // Una puntuación de 5,0 con una reseña no es información. Pero el umbral no
  // puede borrar al comercio de barrio: medido, en Limpieza tienen 3 a 10.
  const confiables = conDistancia.filter(p => p.resenas >= minResenas && p.rating != null);
  const resto = conDistancia.filter(p => !confiables.includes(p));

  const ordenar = arr => arr.slice().sort((a, b) => puntaje(b) - puntaje(a));

  if (confiables.length >= 3) return ordenar(confiables).slice(0, cuantos);

  // Mostrar uno es peor que mostrar tres con poca reputación y la distancia a
  // la vista: el usuario decide, pero necesita entre qué elegir.
  const faltan = ordenar(resto.slice().sort((a, b) => a.distanciaKm - b.distanciaKm));
  return ordenar(confiables).concat(faltan).slice(0, Math.max(cuantos, 0));
}

module.exports = { rankear, distanciaKm };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quodom-web/api && npx jest tests/rankearProveedores.test.js`
Expected: PASS, 12 tests. Si el caso "reincorpora los descartados" devuelve más de 3, revisar el `slice`: la regla es completar **hasta** `cuantos`, no concatenar todo.

- [ ] **Step 5: Commit**

```bash
git add quodom-web/api/src/helpers/rankearProveedores.js quodom-web/api/tests/rankearProveedores.test.js
git commit -m "feat(api): rank providers by rating and distance"
```

---

### Task 4: Buscar proveedores y resolver una localidad

**Files:**
- Modify: `quodom-web/api/src/helpers/places.js`
- Test: `quodom-web/api/tests/places.proveedores.test.js`

**Interfaces:**
- Consumes: `PlacesError` (ya existe en el archivo).
- Produces:
  - `buscarProveedores({ texto, lat, lng }): Promise<Array<{ placeid, nombre, lat, lng, rating, resenas, telefono, direccion }>>`
  - `puntoDeLocalidad(texto): Promise<{ lat, lng, nombre } | null>`

- [ ] **Step 1: Write the failing test**

```js
// quodom-web/api/tests/places.proveedores.test.js
const { buscarProveedores, puntoDeLocalidad } = require('../src/helpers/places');

describe('places: proveedores', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GOOGLE_MAPS_API_KEY;

  beforeEach(() => { process.env.GOOGLE_MAPS_API_KEY = 'test-key'; });
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = originalKey;
  });

  const UNA_RESPUESTA = {
    places: [{
      id: 'ChIJ-prov-1',
      displayName: { text: 'Pinturerías Le Bleu' },
      location: { latitude: -34.5461, longitude: -58.5613 },
      rating: 4.9,
      userRatingCount: 190,
      nationalPhoneNumber: '011 6668-7854',
      shortFormattedAddress: 'Almte Brown 3185, Villa Ballester'
    }]
  };

  it('busca por texto con sesgo de ubicación y devuelve los campos planos', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => UNA_RESPUESTA });

    const out = await buscarProveedores({ texto: 'pinturería', lat: -34.5492, lng: -58.5588 });

    expect(out).toEqual([{
      placeid: 'ChIJ-prov-1',
      nombre: 'Pinturerías Le Bleu',
      lat: -34.5461,
      lng: -58.5613,
      rating: 4.9,
      resenas: 190,
      telefono: '011 6668-7854',
      direccion: 'Almte Brown 3185, Villa Ballester'
    }]);

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('places:searchText');
    const body = JSON.parse(opts.body);
    expect(body.textQuery).toBe('pinturería');
    expect(body.locationBias.circle.center).toEqual({ latitude: -34.5492, longitude: -58.5588 });
    expect(body.maxResultCount).toBe(20);
  });

  // La máscara decide el precio de TODA la consulta. Estos tres campos son del
  // nivel caro y van juntos a propósito: pedir el teléfono aparte es otra
  // consulta del mismo precio.
  it('pide puntuación, reseñas y teléfono en la misma consulta', () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => UNA_RESPUESTA });

    return buscarProveedores({ texto: 'x', lat: 0, lng: 0 }).then(() => {
      const mask = global.fetch.mock.calls[0][1].headers['X-Goog-FieldMask'];
      expect(mask).toContain('places.rating');
      expect(mask).toContain('places.userRatingCount');
      expect(mask).toContain('places.nationalPhoneNumber');
    });
  });

  // Review Focus 2: medido, Google no tiene el teléfono de todos.
  it('un comercio sin teléfono viaja con telefono en null', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: [{ id: 'p', displayName: { text: 'JB' }, location: { latitude: 1, longitude: 2 }, rating: 4.3, userRatingCount: 3 }] })
    });

    const out = await buscarProveedores({ texto: 'x', lat: 0, lng: 0 });
    expect(out[0].telefono).toBeNull();
  });

  // Review Focus 1: un rubro sin nada en esa zona.
  it('sin resultados devuelve lista vacía, no error', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    expect(await buscarProveedores({ texto: 'x', lat: 0, lng: 0 })).toEqual([]);
  });

  it('un 503 de Google se reporta como google_error', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, text: async () => 'boom' });
    await expect(buscarProveedores({ texto: 'x', lat: 0, lng: 0 }))
      .rejects.toMatchObject({ codigo: 'google_error' });
  });
});

describe('puntoDeLocalidad', () => {
  const originalFetch = global.fetch;
  beforeEach(() => { process.env.GOOGLE_MAPS_API_KEY = 'test-key'; });
  afterEach(() => { global.fetch = originalFetch; });

  it('devuelve el punto de la localidad', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: [{ location: { latitude: -34.5492, longitude: -58.5588 }, formattedAddress: 'B1653 Villa Ballester' }] })
    });

    const p = await puntoDeLocalidad('Villa Ballester, Buenos Aires');
    expect(p.lat).toBeCloseTo(-34.5492, 3);
    expect(p.nombre).toContain('Villa Ballester');
  });

  // Review Focus 3: una localidad mal escrita o que Google no conoce.
  it('devuelve null cuando la localidad no resuelve', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    expect(await puntoDeLocalidad('Qwertyuiop')).toBeNull();
  });

  it('con texto vacío no llama a Google', async () => {
    global.fetch = jest.fn();
    expect(await puntoDeLocalidad('')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/api && npx jest tests/places.proveedores.test.js`
Expected: FAIL — `buscarProveedores is not a function`

- [ ] **Step 3: Write minimal implementation**

En `quodom-web/api/src/helpers/places.js`, junto a `CAMPOS_DIRECCION`:

```js
// La máscara del nivel caro: puntuación, reseñas y teléfono. Los tres van en la
// MISMA consulta a propósito — Google cobra por el campo más caro de la máscara,
// así que pedir el teléfono aparte es otra consulta al mismo precio.
const CAMPOS_PROVEEDOR = [
  'places.id',
  'places.displayName',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.nationalPhoneNumber',
  'places.shortFormattedAddress'
].join(',');

// Sólo ubicación: es del nivel básico y se usa para el centro de una localidad.
const CAMPOS_PUNTO = 'places.location,places.formattedAddress';

const RADIO_METROS = 50000;
const MAX_RESULTADOS = 20;
```

Y las dos funciones, antes del `module.exports`:

```js
/**
 * Los comercios del rubro alrededor de un punto.
 *
 * Es `searchText` y no `searchNearby` porque está medido (2026-10-15): buscar
 * por tipo de Places devuelve kioscos para Librería y `paint_store` ni siquiera
 * existe. El texto de cada rubro está en `config/rubrosPlaces.js`.
 *
 * `locationBias` es una preferencia, no un límite: pueden venir resultados
 * lejanos. No importa — la distancia la calcula `rankearProveedores` y el orden
 * final es nuestro.
 */
async function buscarProveedores({ texto, lat, lng }) {
  const key = clave();
  const data = await pedir(BASE + '/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': CAMPOS_PROVEEDOR
    },
    body: JSON.stringify({
      textQuery: texto,
      maxResultCount: MAX_RESULTADOS,
      languageCode: 'es-419',
      regionCode: 'AR',
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: RADIO_METROS } }
    })
  });

  return (data.places || []).map(p => ({
    placeid: p.id,
    nombre: (p.displayName && p.displayName.text) || '',
    lat: p.location ? p.location.latitude : null,
    lng: p.location ? p.location.longitude : null,
    rating: p.rating != null ? p.rating : null,
    resenas: p.userRatingCount || 0,
    telefono: p.nationalPhoneNumber || null,
    direccion: p.shortFormattedAddress || ''
  }));
}

/**
 * El punto de una localidad, para las direcciones cargadas a mano.
 *
 * Medido con un usuario real: hay calles que Google no tiene, y esas direcciones
 * se guardan sin coordenadas. La localidad sí resuelve siempre, y para buscar
 * los cinco comercios más cercanos el centro del pueblo alcanza.
 */
async function puntoDeLocalidad(texto) {
  const q = (texto || '').trim();
  if (q === '') return null;

  const key = clave();
  const data = await pedir(BASE + '/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': CAMPOS_PUNTO },
    body: JSON.stringify({ textQuery: q, maxResultCount: 1, languageCode: 'es-419', regionCode: 'AR' })
  });

  const p = (data.places || [])[0];
  if (!p || !p.location) return null;
  return { lat: p.location.latitude, lng: p.location.longitude, nombre: p.formattedAddress || q };
}
```

Y agregarlas al `module.exports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quodom-web/api && npx jest tests/places.proveedores.test.js tests/places.helper.test.js`
Expected: PASS, 8 + 6 tests

- [ ] **Step 5: Commit**

```bash
git add quodom-web/api/src/helpers/places.js quodom-web/api/tests/places.proveedores.test.js
git commit -m "feat(api): search providers by text and resolve a locality to a point"
```

---

### Task 5: Las dos tablas nuevas y la base commiteada

El único task con la trampa de §6. **La verificación del blob no es opcional.**

**Files:**
- Create: `quodom-web/api/src/models/quodom_proveedores.model.js`
- Create: `quodom-web/api/src/models/lugares_sinwhatsapp.model.js`
- Modify: `quodom-web/api/src/helpers/db.js` (registrar y sincronizar los dos)
- Create: `quodom-web/api/src/seed/migrar-proveedores.js`
- Modify: `quodom-web/api/package.json` (script)
- Modify: `quodom-web/api/quodom.sqlite`
- Test: `quodom-web/api/tests/proveedores.modelo.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `db.quodom_proveedores` (`idquodom`, `placeid`, `orden`, `contactado_en`) y `db.lugares_sinwhatsapp` (`placeid` PK, `reportes`).

- [ ] **Step 1: Write the failing test**

```js
// quodom-web/api/tests/proveedores.modelo.test.js
const db = require('../src/helpers/db');

beforeAll(async () => { await db.ready; });

describe('tablas de proveedores', () => {
  it('quodom_proveedores guarda a quién se le ofreció y a quién se le mandó', async () => {
    await db.quodom_proveedores.create({ idquodom: 'q-1', placeid: 'ChIJ-a', orden: 1 });
    await db.quodom_proveedores.create({ idquodom: 'q-1', placeid: 'ChIJ-b', orden: 2, contactado_en: new Date() });

    const filas = await db.quodom_proveedores.findAll({ where: { idquodom: 'q-1' }, order: [['orden', 'ASC']] });
    expect(filas).toHaveLength(2);
    expect(filas[0].placeid).toBe('ChIJ-a');
    expect(filas[0].contactado_en).toBeNull();
    expect(filas[1].contactado_en).toBeInstanceOf(Date);
  });

  // Es lo único propio que acumula el feature, y lo que lo hace mejorar con el
  // uso. Google deja guardar el place_id sin límite, y el reporte es nuestro.
  it('lugares_sinwhatsapp acumula reportes por lugar', async () => {
    await db.lugares_sinwhatsapp.create({ placeid: 'ChIJ-sin', reportes: 1 });
    const fila = await db.lugares_sinwhatsapp.findByPk('ChIJ-sin');
    expect(fila.reportes).toBe(1);
  });

  it('las dos tablas existen en la base', async () => {
    const [t] = await db.sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('quodom_proveedores','lugares_sinwhatsapp')");
    expect(t.map(x => x.name).sort()).toEqual(['lugares_sinwhatsapp', 'quodom_proveedores']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/api && npx jest tests/proveedores.modelo.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'create')`

- [ ] **Step 3: Write the models**

```js
// quodom-web/api/src/models/quodom_proveedores.model.js
const { DataTypes } = require('sequelize');

module.exports = model;

/**
 * A qué proveedores se le ofrecieron a un Quodom, y a cuáles ya les mandó.
 *
 * Guarda SÓLO el identificador de Google: el nombre, la puntuación y el teléfono
 * no se pueden archivar y se vuelven a pedir cada vez que se muestran. El
 * `place_id` sí es permanente.
 */
function model(sequelize) {
    const attributes = {
        idquodom: { type: DataTypes.STRING, allowNull: false },
        placeid: { type: DataTypes.STRING, allowNull: false },
        orden: { type: DataTypes.INTEGER, allowNull: true },
        // Null = se le ofreció y todavía no se le mandó. Se marca al tocar el
        // botón, que es lo único observable: lo que pasa dentro de WhatsApp no
        // se ve.
        contactado_en: { type: DataTypes.DATE, allowNull: true }
    };

    return sequelize.define('quodom_proveedores', attributes, {
        indexes: [{ fields: ['idquodom'] }]
    });
}
```

```js
// quodom-web/api/src/models/lugares_sinwhatsapp.model.js
const { DataTypes } = require('sequelize');

module.exports = model;

/**
 * Comercios que un usuario reportó como "no tiene WhatsApp".
 *
 * Es el ÚNICO dato propio que acumula el feature, y es lo que lo hace mejorar
 * con el uso: a los seis meses, la lista de pinturerías de una zona está
 * depurada por la gente que pasó antes.
 *
 * Se puede guardar sin límite de tiempo porque no es un dato de Google: es una
 * observación nuestra, indexada por un `place_id`, que sí es archivable.
 */
function model(sequelize) {
    const attributes = {
        placeid: { type: DataTypes.STRING, primaryKey: true },
        reportes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }
    };

    return sequelize.define('lugares_sinwhatsapp', attributes, { freezeTableName: true });
}
```

En `src/helpers/db.js`, junto a los demás (después de `db.ia_usage`):

```js
    db.quodom_proveedores = require('../models/quodom_proveedores.model')(sequelize);
    db.lugares_sinwhatsapp = require('../models/lugares_sinwhatsapp.model')(sequelize);
```

Y agregarlos al array `tableModels`, **antes** de `createViews`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quodom-web/api && npx jest tests/proveedores.modelo.test.js`
Expected: PASS, 3 tests (la base de tests es `:memory:`, así que `sync()` crea las tablas)

- [ ] **Step 5: Write the migration for the committed database**

```js
// quodom-web/api/src/seed/migrar-proveedores.js
/**
 * Crea las dos tablas de la mitad B en una base que ya existe.
 *
 * A diferencia de las otras migraciones, acá `model.sync()` SÍ alcanza: crea una
 * tabla que falta. El script existe igual para dejar el paso explícito, hacer el
 * checkpoint del WAL y poder verificar el blob commiteado (§6).
 */
require('dotenv').config();
const db = require('../helpers/db');

async function main() {
  await db.ready;

  const [t] = await db.sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('quodom_proveedores','lugares_sinwhatsapp')");
  console.log('  tablas presentes:', t.map(x => x.name).join(', ') || '(ninguna)');

  const [[wal]] = await db.sequelize.query('PRAGMA wal_checkpoint(TRUNCATE)');
  console.log('WAL checkpointed into quodom.sqlite:', JSON.stringify(wal));

  await db.sequelize.close();
}

main().then(() => process.exit(0)).catch(err => { console.error('Migrar-proveedores failed:', err); process.exit(1); });
```

En `package.json`: `"migrar-proveedores": "node src/seed/migrar-proveedores.js",`

- [ ] **Step 6: Run it against the real database**

Run: `cd quodom-web/api && npm run migrar-proveedores`
Expected: las dos tablas listadas y una línea de `WAL checkpointed`.

- [ ] **Step 7: Verify the COMMITTED blob (§6)**

**Extraer a una ruta NATIVA de Windows, no a `/tmp`:** node no entiende las rutas de Git Bash y `sqlite3` crea ahí una base vacía, con lo que esta verificación pasa en falso diciendo que no hay nada.

```bash
cd "F:/backup/Command Soluciones/Quodom/Quodom"
git add quodom-web/api/quodom.sqlite
git show :quodom-web/api/quodom.sqlite > "$LOCALAPPDATA/Temp/check-b.sqlite"
cd quodom-web/api && node -e "
const s = require('sqlite3');
const d = new s.Database(process.env.LOCALAPPDATA + '/Temp/check-b.sqlite', s.OPEN_READONLY, e => { if (e) { console.error('NO ABRE', e.message); process.exit(1); } });
d.all(\"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('quodom_proveedores','lugares_sinwhatsapp')\", (e, r) => {
  console.log('tablas en el blob:', r.map(x => x.name).sort().join(', '));
  d.get('SELECT COUNT(*) c FROM productos', (e2, r2) => console.log('productos:', r2.c, r2.c === 644 ? 'OK' : 'MAL'));
});"
```

Expected: `tablas en el blob: lugares_sinwhatsapp, quodom_proveedores` y `productos: 644 OK`.
Si falta alguna, **no commitear**: volver al Step 6.

- [ ] **Step 8: Run the whole API suite**

Run: `cd quodom-web/api && npm test`
Expected: todas verdes.

- [ ] **Step 9: Commit**

```bash
git add quodom-web/api/src/models/quodom_proveedores.model.js \
        quodom-web/api/src/models/lugares_sinwhatsapp.model.js \
        quodom-web/api/src/helpers/db.js \
        quodom-web/api/src/seed/migrar-proveedores.js \
        quodom-web/api/package.json quodom-web/api/quodom.sqlite \
        quodom-web/api/tests/proveedores.modelo.test.js
git commit -m "feat(api): store the providers offered per quodom and the ones without WhatsApp"
```

---

### Task 6: Desde qué punto se busca

Resuelve el punto del Quodom: las coordenadas de su dirección, o el centro de su localidad, **guardándolo** para no pagarlo dos veces.

**Files:**
- Create: `quodom-web/api/src/helpers/puntoDelQuodom.js`
- Test: `quodom-web/api/tests/puntoDelQuodom.test.js`

**Interfaces:**
- Consumes: `puntoDeLocalidad` de `src/helpers/places`; `db.user_direcciones`.
- Produces: `puntoDelQuodom(userId): Promise<{ lat, lng, preciso: boolean, desde: string } | null>` — `preciso` es `false` cuando salió de la localidad; `desde` es el texto que la pantalla muestra ("Ídolo 3720" o "Villa Ballester").

- [ ] **Step 1: Write the failing test**

```js
// quodom-web/api/tests/puntoDelQuodom.test.js
jest.mock('../src/helpers/places');

const db = require('../src/helpers/db');
const places = require('../src/helpers/places');
const { puntoDelQuodom } = require('../src/helpers/puntoDelQuodom');

beforeAll(async () => { await db.ready; });
beforeEach(() => jest.resetAllMocks());

async function direccion(datos) {
  return db.user_direcciones.create({ userid: datos.userid, default: true, ...datos });
}

describe('puntoDelQuodom', () => {
  it('usa las coordenadas de la dirección cuando las tiene', async () => {
    await direccion({ userid: 'u-1', calle: 'Corrientes', numero: '1234', localidad: 'San Nicolás', lat: -34.6037, lng: -58.3816 });

    const p = await puntoDelQuodom('u-1');

    expect(p.lat).toBeCloseTo(-34.6037, 4);
    expect(p.preciso).toBe(true);
    expect(p.desde).toContain('Corrientes');
    expect(places.puntoDeLocalidad).not.toHaveBeenCalled();
  });

  // Medido con un usuario real: hay calles que Google no tiene, y esas
  // direcciones se cargan a mano, sin coordenadas.
  it('cae a la localidad cuando la dirección no tiene coordenadas', async () => {
    await direccion({ userid: 'u-2', calle: 'Ídolo', numero: '3720', localidad: 'Villa Ballester', provincia: 'Buenos Aires' });
    places.puntoDeLocalidad.mockResolvedValue({ lat: -34.5492, lng: -58.5588, nombre: 'Villa Ballester' });

    const p = await puntoDelQuodom('u-2');

    expect(p.lat).toBeCloseTo(-34.5492, 4);
    expect(p.preciso).toBe(false);
    expect(p.desde).toContain('Villa Ballester');
    expect(places.puntoDeLocalidad).toHaveBeenCalledWith('Villa Ballester, Buenos Aires');
  });

  // Se paga una vez por dirección, no una por envío.
  it('guarda el punto de la localidad en la dirección', async () => {
    const d = await direccion({ userid: 'u-3', calle: 'X', numero: '1', localidad: 'Tandil', provincia: 'Buenos Aires' });
    places.puntoDeLocalidad.mockResolvedValue({ lat: -37.3338, lng: -59.1406, nombre: 'Tandil' });

    await puntoDelQuodom('u-3');

    const guardada = await db.user_direcciones.findByPk(d.id);
    expect(guardada.lat).toBeCloseTo(-37.3338, 3);
    expect(guardada.coords_actualizado).toBeInstanceOf(Date);
  });

  it('la segunda vez ya no le pregunta a Google', async () => {
    await direccion({ userid: 'u-4', calle: 'X', numero: '1', localidad: 'Rosario', provincia: 'Santa Fe' });
    places.puntoDeLocalidad.mockResolvedValue({ lat: -32.94, lng: -60.63, nombre: 'Rosario' });

    await puntoDelQuodom('u-4');
    await puntoDelQuodom('u-4');

    expect(places.puntoDeLocalidad).toHaveBeenCalledTimes(1);
  });

  // Review Focus 3.
  it('devuelve null cuando ni la localidad resuelve', async () => {
    await direccion({ userid: 'u-5', calle: 'X', numero: '1', localidad: 'Qwertyuiop' });
    places.puntoDeLocalidad.mockResolvedValue(null);

    expect(await puntoDelQuodom('u-5')).toBeNull();
  });

  it('devuelve null cuando el usuario no tiene ninguna dirección', async () => {
    expect(await puntoDelQuodom('u-sin-direccion')).toBeNull();
  });

  // Un punto marcado como preciso que en realidad salió de la localidad haría
  // que la pantalla mienta sobre desde dónde mide. El flag no se deduce de que
  // haya coordenadas: se deduce de que haya CALLE Y NÚMERO ubicados.
  it('una dirección con punto de localidad guardado sigue siendo imprecisa', async () => {
    await direccion({ userid: 'u-6', calle: 'X', numero: '1', localidad: 'Tandil', lat: -37.33, lng: -59.14, placeid: null });

    const p = await puntoDelQuodom('u-6');
    expect(p.preciso).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/api && npx jest tests/puntoDelQuodom.test.js`
Expected: FAIL — `Cannot find module '../src/helpers/puntoDelQuodom'`

- [ ] **Step 3: Write minimal implementation**

```js
// quodom-web/api/src/helpers/puntoDelQuodom.js
/**
 * Desde qué punto se buscan los proveedores.
 *
 * Dos escalones, y la pantalla tiene que poder decir cuál se usó:
 *
 * 1. La dirección fue elegida del mapa → punto exacto (`preciso: true`).
 * 2. Se cargó a mano → el centro de su localidad (`preciso: false`). Medido con
 *    un usuario real: hay calles que Google no tiene, y esas direcciones se
 *    cargan a mano. Sin este escalón el feature no existiría para ellos.
 *
 * El punto de la localidad se **guarda** en la dirección: se paga una vez por
 * dirección y no una por envío.
 *
 * `preciso` sale de que haya `placeid` —o sea, de que el usuario haya elegido la
 * dirección del mapa— y no de que haya coordenadas: una dirección cuyas
 * coordenadas vinieron de la localidad también las tiene, y decir que es precisa
 * haría que la pantalla mienta sobre desde dónde midió.
 */
const db = require('./db');
const { puntoDeLocalidad } = require('./places');

async function puntoDelQuodom(userId) {
    const dir = await db.user_direcciones.findOne({
        where: { userid: userId },
        order: [['default', 'DESC'], ['id', 'ASC']]
    });
    if (!dir) return null;

    const calle = [dir.calle, dir.numero].filter(Boolean).join(' ').trim();

    if (dir.placeid && dir.lat != null && dir.lng != null) {
        return { lat: dir.lat, lng: dir.lng, preciso: true, desde: calle || dir.localidad || '' };
    }

    if (dir.lat != null && dir.lng != null) {
        return { lat: dir.lat, lng: dir.lng, preciso: false, desde: dir.localidad || '' };
    }

    const texto = [dir.localidad, dir.provincia].filter(Boolean).join(', ');
    const p = await puntoDeLocalidad(texto);
    if (!p) return null;

    dir.lat = p.lat;
    dir.lng = p.lng;
    dir.coords_actualizado = new Date();
    await dir.save();

    return { lat: p.lat, lng: p.lng, preciso: false, desde: dir.localidad || p.nombre };
}

module.exports = { puntoDelQuodom };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quodom-web/api && npx jest tests/puntoDelQuodom.test.js`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add quodom-web/api/src/helpers/puntoDelQuodom.js quodom-web/api/tests/puntoDelQuodom.test.js
git commit -m "feat(api): resolve the point a quodom searches from, exact or by locality"
```

---

### Task 7: El endpoint de proveedores

**Files:**
- Modify: `quodom-web/api/openapi.yaml`
- Create: `quodom-web/api/src/controllers/proveedores.controller.js`
- Create: `quodom-web/api/src/routes/proveedores.route.js`
- Modify: `quodom-web/api/src/server.js`
- Modify: `quodom-web/api/tests/openapi.coverage.test.js` (el conteo fijo de rutas)
- Test: `quodom-web/api/tests/proveedores.endpoint.test.js`

**Interfaces:**
- Consumes: `puntoDelQuodom`, `buscarProveedores`, `rankear`, `terminoDeRubro`, `analizarTelefono`, `db.lugares_sinwhatsapp`, `db.quodom_proveedores`.
- Produces: `GET /quodom/proveedores/{id}` → `{ proveedores: [...], preciso: boolean, desde: string, atribucion: string }`.

- [ ] **Step 1: Write the failing test**

```js
// quodom-web/api/tests/proveedores.endpoint.test.js
jest.mock('../src/helpers/places');

const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');
const { sessionToken } = require('./helpers/session');
const places = require('../src/helpers/places');
const { PlacesError } = jest.requireActual('../src/helpers/places');

let token, userId, idquodom;

beforeAll(async () => {
  await db.ready;
  await db.provincia.create({ id: 1, provincia: 'Buenos Aires' });
  await request(app).post('/users/signup').send({
    username: 'prov', email: 'prov@test.com', nombre: 'Prov', password: 'secreto123',
    codArea: '11', telefono: '55559999'
  });
  const login = await request(app).post('/users/signin').send({ username: 'prov@test.com', password: 'secreto123' });
  token = sessionToken(login);
  userId = login.body.id;

  await request(app).post('/user_direcciones/create').set('Authorization', 'Bearer ' + token)
    .send({ alias: 'Casa', calle: 'Almte Brown', numero: '3185', localidad: 'Villa Ballester',
            idprovincia: 1, placeid: 'ChIJ-casa', lat: -34.5492, lng: -58.5588, default: true });

  const q = await request(app).post('/quodom/create').set('Authorization', 'Bearer ' + token)
    .send({ descripcion: 'Obra', idrubro: 5 });
  idquodom = q.body.id || (q.body.quodom && q.body.quodom.id);
});

beforeEach(() => jest.resetAllMocks());
const auth = req => req.set('Authorization', 'Bearer ' + token);

const UNO = {
  placeid: 'ChIJ-lebleu', nombre: 'Pinturerías Le Bleu', lat: -34.5461, lng: -58.5613,
  rating: 4.9, resenas: 190, telefono: '011 6668-7854', direccion: 'Almte Brown 3185'
};

describe('GET /quodom/proveedores/:id', () => {
  it('devuelve los proveedores del rubro, con distancia y teléfono listo para WhatsApp', async () => {
    places.buscarProveedores.mockResolvedValue([UNO]);

    const res = await auth(request(app).get('/quodom/proveedores/' + idquodom));

    expect(res.status).toBe(200);
    expect(res.body.preciso).toBe(true);
    expect(res.body.proveedores).toHaveLength(1);
    const p = res.body.proveedores[0];
    expect(p.nombre).toBe('Pinturerías Le Bleu');
    expect(p.distanciakm).toBeGreaterThan(0);
    expect(p.telefono).toBe('+541166687854');
    expect(p.esfijo).toBe(true);
    // Buscó con el término medido del rubro 5.
    expect(places.buscarProveedores).toHaveBeenCalledWith(expect.objectContaining({ texto: 'pinturería' }));
  });

  it('deja anotado a quiénes se le ofreció', async () => {
    places.buscarProveedores.mockResolvedValue([UNO]);

    await auth(request(app).get('/quodom/proveedores/' + idquodom));

    const filas = await db.quodom_proveedores.findAll({ where: { idquodom } });
    expect(filas.map(f => f.placeid)).toContain('ChIJ-lebleu');
  });

  // Review Focus 1: un rubro sin nada cerca.
  it('sin resultados devuelve la lista vacía y un 200, no un error', async () => {
    places.buscarProveedores.mockResolvedValue([]);

    const res = await auth(request(app).get('/quodom/proveedores/' + idquodom));

    expect(res.status).toBe(200);
    expect(res.body.proveedores).toEqual([]);
  });

  // Review Focus 5: que el buscador falle NO puede impedir mandar el pedido.
  it('si Google falla responde 503 con su código, sin tocar el Quodom', async () => {
    places.buscarProveedores.mockRejectedValue(new PlacesError('google_error', 'places: HTTP 503'));

    const res = await auth(request(app).get('/quodom/proveedores/' + idquodom));

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('google_error');
    const q = await db.Quodom.findByPk(idquodom);
    expect(q.estado).toBe('CREADO');
  });

  it('el Quodom de otro usuario no se puede consultar', async () => {
    await request(app).post('/users/signup').send({
      username: 'otro', email: 'otro@test.com', nombre: 'Otro', password: 'secreto123',
      codArea: '11', telefono: '55558888'
    });
    const login2 = await request(app).post('/users/signin').send({ username: 'otro@test.com', password: 'secreto123' });

    const res = await request(app).get('/quodom/proveedores/' + idquodom)
      .set('Authorization', 'Bearer ' + sessionToken(login2));

    expect(res.status).toBe(400);
  });

  it('exige sesión', async () => {
    const res = await request(app).get('/quodom/proveedores/' + idquodom);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/api && npx jest tests/proveedores.endpoint.test.js`
Expected: FAIL — 404 en todos

- [ ] **Step 3: Add the contract**

En `components.schemas`, después de `DireccionDeLugar`:

```yaml
    Proveedor:
      type: object
      required: [placeid, nombre, distanciakm, sintelefono, esfijo, sinwhatsapp]
      properties:
        placeid: { type: string }
        nombre: { type: string }
        rating: { type: number, nullable: true }
        resenas: { type: integer }
        distanciakm: { type: number }
        telefono: { type: string, nullable: true }
        telefonovisible: { type: string, nullable: true }
        sintelefono: { type: boolean }
        esfijo: { type: boolean }
        sinwhatsapp: { type: boolean }
        direccion: { type: string }
        contactadoen: { type: string, format: date-time, nullable: true }
```

En `paths`, junto a los demás `/quodom/...`:

```yaml
  /quodom/proveedores/{id}:
    get:
      summary: Proveedores del rubro cerca de la dirección del Quodom
      security: [{ bearerAuth: [] }]
      parameters:
        - { name: id, in: path, required: true, schema: { type: string } }
      responses:
        '200':
          description: Hasta 5 proveedores. Lista vacía si no hay ninguno en la zona.
          content:
            application/json:
              schema:
                type: object
                required: [proveedores, preciso, desde, atribucion]
                properties:
                  proveedores:
                    type: array
                    items: { $ref: '#/components/schemas/Proveedor' }
                  preciso: { type: boolean }
                  desde: { type: string }
                  atribucion: { type: string }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '409':
          description: No se puede ubicar la dirección ni por su localidad
          content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
        '429': { $ref: '#/components/responses/TooMany' }
        '503': { $ref: '#/components/responses/ServicioExterno' }
```

- [ ] **Step 4: Write the controller and the route**

```js
// quodom-web/api/src/controllers/proveedores.controller.js
const db = require('../helpers/db');
const places = require('../helpers/places');
const { rankear } = require('../helpers/rankearProveedores');
const { terminoDeRubro } = require('../config/rubrosPlaces');
const { analizarTelefono } = require('../helpers/telefonoWhatsapp');
const { puntoDelQuodom } = require('../helpers/puntoDelQuodom');
const { httpError } = require('../helpers/http-error');

const ATRIBUCION = 'Resultados de Google';

module.exports = { listar };

async function listar(idquodom, userId) {
    const quodom = await db.Quodom.findByPk(idquodom);
    if (!quodom) throw 'El Quodom no existe.';
    if (quodom.createdBy !== userId) throw 'El Id Quodom no pertenece a el usuario.';

    const termino = terminoDeRubro(quodom.idrubro);
    if (!termino) {
        // Un rubro activo sin término es un olvido de configuración, no un caso
        // del usuario: se avisa en el log y se devuelve vacío en vez de romper.
        console.warn('proveedores: rubro sin término de búsqueda. idrubro=' + quodom.idrubro);
        return { proveedores: [], preciso: false, desde: '', atribucion: ATRIBUCION };
    }

    const punto = await puntoDelQuodom(userId);
    if (!punto) {
        throw httpError(409, 'sin_ubicacion',
            'No pudimos ubicar tu dirección, ni siquiera por su localidad.');
    }

    const crudos = await places.buscarProveedores({ texto: termino, lat: punto.lat, lng: punto.lng });

    // Lo que el feature aprendió de los usuarios anteriores.
    const reportados = await db.lugares_sinwhatsapp.findAll({
        where: { placeid: crudos.map(c => c.placeid) }
    });
    const sinWhatsapp = new Set(reportados.map(r => r.placeid));

    const conTelefono = crudos.map(c => {
        const tel = analizarTelefono(c.telefono);
        return {
            ...c,
            // Un número que no puede recibir WhatsApp (un 0800) viaja como
            // teléfono para "llamar", pero sin número de WhatsApp: el renglón
            // muestra el botón de llamar y no el de WhatsApp.
            telefono: tel && tel.sirveWhatsapp ? tel.e164 : null,
            telefonoVisible: tel ? tel.original : null,
            esFijo: tel ? tel.esFijo : false,
            sinWhatsapp: sinWhatsapp.has(c.placeid)
        };
    });

    const elegidos = rankear(conTelefono, punto);
    await anotarOfrecidos(idquodom, elegidos);

    const yaContactados = await db.quodom_proveedores.findAll({ where: { idquodom } });
    const porPlace = new Map(yaContactados.map(f => [f.placeid, f.contactado_en]));

    return {
        proveedores: elegidos.map(p => ({
            placeid: p.placeid,
            nombre: p.nombre,
            rating: p.rating,
            resenas: p.resenas,
            distanciakm: Math.round(p.distanciaKm * 10) / 10,
            telefono: p.telefono,
            telefonovisible: p.telefonoVisible || null,
            sintelefono: p.sinTelefono,
            esfijo: p.esFijo,
            sinwhatsapp: p.sinWhatsapp,
            direccion: p.direccion,
            contactadoen: porPlace.get(p.placeid) || null
        })),
        preciso: punto.preciso,
        desde: punto.desde,
        atribucion: ATRIBUCION
    };
}

// Se anota a quiénes se le ofreció, sin pisar lo ya contactado: el usuario puede
// volver a abrir el popup y la lista puede venir distinta.
async function anotarOfrecidos(idquodom, elegidos) {
    const existentes = await db.quodom_proveedores.findAll({ where: { idquodom } });
    const conocidos = new Set(existentes.map(f => f.placeid));

    for (let i = 0; i < elegidos.length; i++) {
        if (conocidos.has(elegidos[i].placeid)) continue;
        await db.quodom_proveedores.create({
            idquodom, placeid: elegidos[i].placeid, orden: i + 1
        });
    }
}
```

```js
// quodom-web/api/src/routes/proveedores.route.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const { httpError } = require('../helpers/http-error');
const Controler = require('../controllers/proveedores.controller');

// Cada búsqueda se le paga a Google. El scope separa este cupo del chat de IA:
// sin él comparten balde y buscar proveedores gasta el cupo del chat.
const MAX_RPM = () => Number(process.env.PROVEEDORES_RATE_LIMIT_PER_MINUTE) || 10;

router.get('/:id', auth.verifyToken(),
  (req, res, next) => rateLimit.perUserPerMinute(MAX_RPM(), 'proveedores')(req, res, next), getProveedores);

module.exports = router;

function getProveedores(req, res, next) {
  Controler.listar(req.params.id, req.user.id)
    .then(data => res.json(data))
    .catch(e => next(mapear(e)));
}

function mapear(e) {
  if (e && e.name === 'PlacesError') {
    console.warn('proveedores: places fallo. codigo=' + e.codigo + ' mensaje=' + e.message);
    return httpError(503, e.codigo || 'google_error', e.message);
  }
  return e;
}
```

En `src/server.js`, junto a las demás rutas:

```js
app.use('/quodom/proveedores', require('./routes/proveedores.route'));
```

> **Montarla ANTES de `app.use('/quodom', ...)`**, o `/quodom/:id` se come
> `/quodom/proveedores/xxx` y el endpoint nuevo nunca se alcanza.

- [ ] **Step 5: Run the tests**

Run: `cd quodom-web/api && npx jest tests/proveedores.endpoint.test.js`
Expected: PASS, 6 tests

- [ ] **Step 6: Fix the route count and run the contract tests**

El guard de `openapi.coverage.test.js` lleva un conteo fijo. Subirlo por la ruta nueva.

Run: `cd quodom-web/api && npx jest tests/openapi.coverage.test.js tests/openapi.validation.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add quodom-web/api/openapi.yaml quodom-web/api/src/controllers/proveedores.controller.js \
        quodom-web/api/src/routes/proveedores.route.js quodom-web/api/src/server.js \
        quodom-web/api/tests/proveedores.endpoint.test.js quodom-web/api/tests/openapi.coverage.test.js
git commit -m "feat(api): serve the nearby providers for a quodom"
```

---

### Task 8: Elegir un proveedor, y deshacerlo

**Files:**
- Modify: `quodom-web/api/openapi.yaml`
- Modify: `quodom-web/api/src/controllers/quodom.controller.js` (`whatsappLink`)
- Modify: `quodom-web/api/src/routes/quodom.route.js`
- Modify: `quodom-web/api/src/controllers/proveedores.controller.js` (+ `noEnviado`)
- Modify: `quodom-web/api/src/routes/proveedores.route.js`
- Test: `quodom-web/api/tests/proveedores.envio.test.js`

**Interfaces:**
- Consumes: lo de Task 7.
- Produces:
  - `GET /quodom/whatsapp/{id}?proveedor={placeid}&tel={e164}` → `{ res, link }` con `wa.me/<tel>`; marca contactado y pasa a `ENVIADO`.
  - `POST /quodom/proveedores/{id}/no-enviado` con `{ placeid, motivo }`.

- [ ] **Step 1: Write the failing test**

```js
// quodom-web/api/tests/proveedores.envio.test.js
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');
const { sessionToken } = require('./helpers/session');

let token, idquodom;

beforeAll(async () => {
  await db.ready;
  await db.provincia.create({ id: 1, provincia: 'Buenos Aires' });
  await request(app).post('/users/signup').send({
    username: 'envio', email: 'envio@test.com', nombre: 'En', password: 'secreto123',
    codArea: '11', telefono: '55557777'
  });
  const login = await request(app).post('/users/signin').send({ username: 'envio@test.com', password: 'secreto123' });
  token = sessionToken(login);

  await request(app).post('/user_direcciones/create').set('Authorization', 'Bearer ' + token)
    .send({ alias: 'Casa', calle: 'Brown', numero: '3185', localidad: 'Villa Ballester', idprovincia: 1, default: true });

  const q = await request(app).post('/quodom/create').set('Authorization', 'Bearer ' + token)
    .send({ descripcion: 'Obra', idrubro: 5 });
  idquodom = q.body.id || (q.body.quodom && q.body.quodom.id);

  // Una línea con su atributo elegido, para que el envío no esté bloqueado.
  const prods = await db.Products.findAll({ limit: 1, where: { categoriaPadre: 5 } });
  await db.Quodom_Lines.create({
    idquodom, idproducto: prods[0].id, nombreProducto: prods[0].nombreproducto, cantidad: 1
  });
});

const auth = req => req.set('Authorization', 'Bearer ' + token);

describe('elegir un proveedor', () => {
  it('arma el link al número del proveedor y lo marca contactado', async () => {
    const res = await auth(request(app)
      .get('/quodom/whatsapp/' + idquodom + '?proveedor=ChIJ-lebleu&tel=%2B541166687854'));

    expect(res.status).toBe(200);
    expect(res.body.link).toContain('wa.me/541166687854');
    expect(res.body.link).toContain('text=');

    const fila = await db.quodom_proveedores.findOne({ where: { idquodom, placeid: 'ChIJ-lebleu' } });
    expect(fila.contactado_en).toBeInstanceOf(Date);
  });

  it('el Quodom queda ENVIADO con el primero', async () => {
    const q = await db.Quodom.findByPk(idquodom);
    expect(q.estado).toBe('ENVIADO');
  });

  // El camino de hoy sigue vivo: es la salida cuando no hay proveedores, cuando
  // Google falla, y para mandarle a un proveedor propio que no está en la lista.
  it('sin el parámetro proveedor devuelve el link sin destinatario, como siempre', async () => {
    const res = await auth(request(app).get('/quodom/whatsapp/' + idquodom));
    expect(res.status).toBe(200);
    expect(res.body.link).toContain('wa.me/?text=');
  });

  it('un teléfono que no es un número válido se rechaza', async () => {
    const res = await auth(request(app)
      .get('/quodom/whatsapp/' + idquodom + '?proveedor=ChIJ-x&tel=hola'));
    expect(res.status).toBe(400);
  });
});

describe('POST /quodom/proveedores/:id/no-enviado', () => {
  it('desmarca el contactado', async () => {
    const res = await auth(request(app).post('/quodom/proveedores/' + idquodom + '/no-enviado')
      .send({ placeid: 'ChIJ-lebleu' }));

    expect(res.status).toBe(200);
    const fila = await db.quodom_proveedores.findOne({ where: { idquodom, placeid: 'ChIJ-lebleu' } });
    expect(fila.contactado_en).toBeNull();
  });

  // El aprendizaje: lo que hace que la lista de una zona mejore con el uso.
  it('con motivo sin_whatsapp lo anota contra el lugar, para todos', async () => {
    await auth(request(app).post('/quodom/proveedores/' + idquodom + '/no-enviado')
      .send({ placeid: 'ChIJ-lebleu', motivo: 'sin_whatsapp' }));

    const anotado = await db.lugares_sinwhatsapp.findByPk('ChIJ-lebleu');
    expect(anotado.reportes).toBeGreaterThanOrEqual(1);
  });

  it('dos reportes del mismo lugar suman, no fallan', async () => {
    await auth(request(app).post('/quodom/proveedores/' + idquodom + '/no-enviado')
      .send({ placeid: 'ChIJ-lebleu', motivo: 'sin_whatsapp' }));

    const anotado = await db.lugares_sinwhatsapp.findByPk('ChIJ-lebleu');
    expect(anotado.reportes).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/api && npx jest tests/proveedores.envio.test.js`
Expected: FAIL — el link no tiene destinatario y el POST da 404

- [ ] **Step 3: Extend the contract**

En `/quodom/whatsapp/{id}`, agregar los dos parámetros de consulta:

```yaml
        - { name: proveedor, in: query, required: false, schema: { type: string } }
        - { name: tel, in: query, required: false, schema: { type: string } }
```

Y el path nuevo:

```yaml
  /quodom/proveedores/{id}/no-enviado:
    post:
      summary: Deshacer el contacto con un proveedor
      security: [{ bearerAuth: [] }]
      parameters:
        - { name: id, in: path, required: true, schema: { type: string } }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [placeid]
              properties:
                placeid: { type: string }
                motivo: { type: string, enum: [sin_whatsapp, otro] }
      responses:
        '200':
          description: Desmarcado
          content: { application/json: { schema: { type: object, properties: { res: { type: boolean } } } } }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
```

> Es `POST .../no-enviado` y no `DELETE .../contactado` porque lleva cuerpo: un
> `DELETE` con cuerpo es legal pero el validador y varios clientes lo tratan
> distinto, y acá el `motivo` es el que alimenta el aprendizaje.

- [ ] **Step 4: Extend whatsappLink and add noEnviado**

En `quodom.controller.js`, `whatsappLink(id, userId, proveedor, tel)`: antes del `return`, reemplazar la última línea por:

```js
    if (proveedor && tel) {
        const { analizarTelefono } = require('../helpers/telefonoWhatsapp');
        const n = analizarTelefono(tel);
        if (!n) throw 'El teléfono del proveedor no es válido.';

        // Se marca el toque del botón, que es lo único observable: lo que pasa
        // dentro de WhatsApp no se ve. Fingir más conocimiento sería peor.
        const [fila] = await db.quodom_proveedores.findOrCreate({
            where: { idquodom: id, placeid: proveedor },
            defaults: { idquodom: id, placeid: proveedor }
        });
        fila.contactado_en = new Date();
        await fila.save();

        return 'https://wa.me/' + n.e164.replace('+', '') + '?text=' + encodeURIComponent(msg);
    }

    return 'https://wa.me/?text=' + encodeURIComponent(msg);
```

En la ruta, pasar los parámetros: `Controler.whatsappLink(req.params.id, req.user.id, req.query.proveedor, req.query.tel)`.

En `proveedores.controller.js`:

```js
async function noEnviado(idquodom, userId, { placeid, motivo }) {
    const quodom = await db.Quodom.findByPk(idquodom);
    if (!quodom || quodom.createdBy !== userId) throw 'El Id Quodom no pertenece a el usuario.';

    const fila = await db.quodom_proveedores.findOne({ where: { idquodom, placeid } });
    if (fila) { fila.contactado_en = null; await fila.save(); }

    // El único dato propio que acumula el feature. Es una observación nuestra
    // indexada por place_id, así que se puede guardar sin límite de tiempo.
    if (motivo === 'sin_whatsapp') {
        const [l, creado] = await db.lugares_sinwhatsapp.findOrCreate({
            where: { placeid }, defaults: { placeid, reportes: 1 }
        });
        if (!creado) { l.reportes = (l.reportes || 0) + 1; await l.save(); }
    }

    return { res: true };
}
```

Y en la ruta: `router.post('/:id/no-enviado', auth.verifyToken(), postNoEnviado);`

- [ ] **Step 5: Run the tests**

Run: `cd quodom-web/api && npx jest tests/proveedores.envio.test.js tests/whatsapp.test.js`
Expected: PASS. `whatsapp.test.js` **no debe romperse**: sin `proveedor` el comportamiento es el de siempre.

- [ ] **Step 6: Run the whole API suite and regenerate types**

Run: `cd quodom-web/api && npm test`
Run: `cd quodom-web/app && npm run api-types`
Expected: todo verde.

- [ ] **Step 7: Commit**

```bash
git add quodom-web/api/openapi.yaml quodom-web/api/src/controllers/ quodom-web/api/src/routes/ \
        quodom-web/api/tests/proveedores.envio.test.js quodom-web/app/src/api/schema.d.ts
git commit -m "feat(api): build the wa.me link for a chosen provider, and let it be undone"
```

---

### Task 9: El popup de proveedores

**Files:**
- Create: `quodom-web/app/src/api/proveedores.ts`
- Create: `quodom-web/app/src/quodom/DialogoProveedores.tsx`
- Create: `quodom-web/app/src/quodom/DialogoProveedores.css`
- Modify: `quodom-web/app/src/api/types.ts`
- Test: `quodom-web/app/src/quodom/__tests__/DialogoProveedores.test.tsx`

**Interfaces:**
- Consumes: `GET /quodom/proveedores/{id}`, `GET /quodom/whatsapp/{id}?proveedor=&tel=`, `POST /quodom/proveedores/{id}/no-enviado`.
- Produces: `<DialogoProveedores idquodom onCerrar onEnviadoSinProveedor />`.

- [ ] **Step 1: Write the API client**

```ts
// quodom-web/app/src/api/proveedores.ts
import { apiFetch } from './client';
import type { Proveedor } from './types';

export type RespuestaProveedores = {
  proveedores: Proveedor[];
  preciso: boolean;
  desde: string;
  atribucion: string;
};

export const proveedores = {
  delQuodom: (idquodom: string) =>
    apiFetch<RespuestaProveedores>('/quodom/proveedores/' + encodeURIComponent(idquodom)),
  noEnviado: (idquodom: string, placeid: string, motivo?: 'sin_whatsapp' | 'otro') =>
    apiFetch<{ res: boolean }>('/quodom/proveedores/' + encodeURIComponent(idquodom) + '/no-enviado',
      { method: 'POST', body: { placeid, motivo } })
};
```

En `types.ts`: `export type Proveedor = S['Proveedor'];`

- [ ] **Step 2: Write the failing test**

```tsx
// quodom-web/app/src/quodom/__tests__/DialogoProveedores.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DialogoProveedores } from '../DialogoProveedores';
import { proveedores } from '../../api/proveedores';
import { quodom } from '../../api/quodom';

vi.mock('../../api/proveedores', () => ({ proveedores: { delQuodom: vi.fn(), noEnviado: vi.fn() } }));
vi.mock('../../api/quodom', () => ({ quodom: { whatsapp: vi.fn() } }));
const abrir = vi.hoisted(() => vi.fn());
vi.mock('../../utils/whatsapp', () => ({ openWhatsappLink: abrir }));

const LE_BLEU = {
  placeid: 'p1', nombre: 'Pinturerías Le Bleu', rating: 4.9, resenas: 190,
  distanciakm: 0.4, telefono: '+541166687854', telefonovisible: '011 6668-7854',
  sintelefono: false, esfijo: true, sinwhatsapp: false, direccion: 'Almte Brown 3185',
  contactadoen: null
};
const SIN_TEL = {
  placeid: 'p2', nombre: 'JB Artículos de Limpieza', rating: 4.3, resenas: 3,
  distanciakm: 0.4, telefono: null, telefonovisible: null,
  sintelefono: true, esfijo: false, sinwhatsapp: false, direccion: 'Pacífico Rodríguez 5369',
  contactadoen: null
};

function respuesta(extra = {}) {
  return { proveedores: [LE_BLEU], preciso: true, desde: 'Almte Brown 3185', atribucion: 'Resultados de Google', ...extra };
}

beforeEach(() => {
  vi.mocked(proveedores.delQuodom).mockReset();
  vi.mocked(proveedores.noEnviado).mockReset();
  vi.mocked(quodom.whatsapp).mockReset();
  abrir.mockReset();
});

describe('DialogoProveedores', () => {
  it('muestra cada proveedor con su puntuación y su distancia', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta());

    render(<DialogoProveedores idquodom="q1" onCerrar={vi.fn()} />);

    expect(await screen.findByText('Pinturerías Le Bleu')).toBeInTheDocument();
    expect(screen.getByText(/4,9|4\.9/)).toBeInTheDocument();
    expect(screen.getByText(/0,4 km|0\.4 km/)).toBeInTheDocument();
  });

  it('al elegir uno abre WhatsApp con ese número', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta());
    vi.mocked(quodom.whatsapp).mockResolvedValue({ res: true, link: 'https://wa.me/541166687854?text=hola' });

    render(<DialogoProveedores idquodom="q1" onCerrar={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /whatsapp/i }));

    await waitFor(() => expect(abrir).toHaveBeenCalledWith('https://wa.me/541166687854?text=hola'));
    expect(quodom.whatsapp).toHaveBeenCalledWith('q1', { proveedor: 'p1', tel: '+541166687854' });
  });

  it('al volver, el contactado queda marcado y los demás siguen disponibles', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({
      proveedores: [{ ...LE_BLEU, contactadoen: new Date().toISOString() }, SIN_TEL]
    }));

    render(<DialogoProveedores idquodom="q1" onCerrar={vi.fn()} />);

    expect(await screen.findByText(/ya le mandaste/i)).toBeInTheDocument();
    expect(screen.getByText('JB Artículos de Limpieza')).toBeInTheDocument();
  });

  // Review Focus 2: medido, existen.
  it('un proveedor sin teléfono no ofrece WhatsApp ni llamar, y lo dice', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({ proveedores: [SIN_TEL] }));

    render(<DialogoProveedores idquodom="q1" onCerrar={vi.fn()} />);

    expect(await screen.findByText(/no tiene el teléfono/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /whatsapp/i })).toBeNull();
    expect(screen.getByRole('link', { name: /maps/i })).toBeInTheDocument();
  });

  it('avisa que un fijo puede no tener WhatsApp, sin bloquearlo', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta());

    render(<DialogoProveedores idquodom="q1" onCerrar={vi.fn()} />);

    expect(await screen.findByText(/puede no tener whatsapp/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /whatsapp/i })).toBeEnabled();
  });

  it('cuando el punto es aproximado lo dice', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({ preciso: false, desde: 'Villa Ballester' }));

    render(<DialogoProveedores idquodom="q1" onCerrar={vi.fn()} />);

    expect(await screen.findByText(/centro de la localidad/i)).toBeInTheDocument();
  });

  // Review Focus 1 y 5: sin proveedores, o con Google caído, el usuario TIENE
  // que poder mandar igual. Es el camino que existe hoy.
  it('sin proveedores ofrece enviar sin destinatario', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({ proveedores: [] }));

    render(<DialogoProveedores idquodom="q1" onCerrar={vi.fn()} />);

    expect(await screen.findByRole('button', { name: /enviar sin elegir/i })).toBeInTheDocument();
  });

  it('si la búsqueda falla igual ofrece enviar sin destinatario', async () => {
    vi.mocked(proveedores.delQuodom).mockRejectedValue(new Error('503'));

    render(<DialogoProveedores idquodom="q1" onCerrar={vi.fn()} />);

    expect(await screen.findByRole('button', { name: /enviar sin elegir/i })).toBeInTheDocument();
  });

  it('deshacer un envío lo devuelve a la lista', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({
      proveedores: [{ ...LE_BLEU, contactadoen: new Date().toISOString() }]
    }));
    vi.mocked(proveedores.noEnviado).mockResolvedValue({ res: true });

    render(<DialogoProveedores idquodom="q1" onCerrar={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /no se envió/i }));

    await waitFor(() => expect(proveedores.noEnviado).toHaveBeenCalledWith('q1', 'p1', undefined));
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd quodom-web/app && npx vitest run src/quodom/__tests__/DialogoProveedores.test.tsx`
Expected: FAIL — no resuelve `../DialogoProveedores`

- [ ] **Step 4: Write the component**

Requisitos que los tests fijan, y que el implementador arma con el estilo del repo (`DialogoDestino.tsx` es el modelo más cercano — mirarlo antes de empezar):

- Carga `proveedores.delQuodom(idquodom)` al montar; esqueleto mientras carga (no spinner).
- Encabezado: *"Proveedores cerca de {desde}"*. Si `preciso === false`, una línea chica: *"tu dirección no está ubicada con precisión — las distancias son desde el centro de la localidad"* y un link a `/direcciones`.
- Cada proveedor: nombre, `rating` con `resenas`, `distanciakm` con una coma decimal, dirección.
  - Con teléfono: botón **"WhatsApp"** con `btn-whatsapp`, link **"Llamar"** (`tel:`) y link **"Ver en Maps"**.
  - `esfijo`: la leyenda *"es un teléfono fijo, puede no tener WhatsApp"*. No deshabilita nada.
  - `sintelefono`: sin botones de contacto, la leyenda *"Google no tiene el teléfono de este comercio"*, y sólo **"Ver en Maps"**.
  - `sinwhatsapp`: la leyenda *"otro usuario reportó que no tiene WhatsApp"*.
  - `contactadoen`: el renglón se marca *"ya le mandaste"* y ofrece **"no se envió"**, que llama a `noEnviado` y refresca.
- Pie: **"Enviar sin elegir proveedor"**, que llama a `quodom.whatsapp(id)` sin parámetros y abre el link. **Visible siempre**: con lista, sin lista, y cuando la búsqueda falló.
- Al final, la atribución: *"Resultados de Google"*.

`quodom.whatsapp` pasa a aceptar un segundo argumento opcional:

```ts
  whatsapp: (id: string, opts?: { proveedor: string; tel: string }) =>
    apiFetch<{ res: boolean; link: string }>('/quodom/whatsapp/' + encodeURIComponent(id) +
      (opts ? '?proveedor=' + encodeURIComponent(opts.proveedor) + '&tel=' + encodeURIComponent(opts.tel) : '')),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd quodom-web/app && npx vitest run src/quodom/__tests__/DialogoProveedores.test.tsx`
Expected: PASS, 9 tests

- [ ] **Step 6: Commit**

```bash
git add quodom-web/app/src/api/proveedores.ts quodom-web/app/src/api/types.ts quodom-web/app/src/api/quodom.ts \
        quodom-web/app/src/quodom/DialogoProveedores.tsx quodom-web/app/src/quodom/DialogoProveedores.css \
        quodom-web/app/src/quodom/__tests__/DialogoProveedores.test.tsx
git commit -m "feat(app): show the nearby providers when sending a quodom"
```

---

### Task 10: Conectarlo a los tres lugares que envían

**Files:**
- Modify: `quodom-web/app/src/components/layout/MisQuodomsSidebar.tsx`
- Modify: `quodom-web/app/src/screens/Quodom/DetalleQuodom.tsx`
- Modify: `quodom-web/app/src/components/QuodomCard.tsx`
- Test: `quodom-web/app/src/components/layout/__tests__/MisQuodomsSidebar.test.tsx` (agregar casos)

**Interfaces:**
- Consumes: `DialogoProveedores` de Task 9.
- Produces: nada que consuma otro task.

- [ ] **Step 1: Write the failing test**

Agregar al test del sidebar:

```tsx
  it('tocar Cotizar abre el selector de proveedores en vez de ir directo a WhatsApp', async () => {
    // (montaje con un Quodom listo para enviar, como los casos que ya existen)
    fireEvent.click(await screen.findByRole('button', { name: /cotizar por whatsapp/i }));

    expect(await screen.findByText(/proveedores cerca/i)).toBeInTheDocument();
    // Ya no se abre WhatsApp sin pasar por el selector.
    expect(abrirWhatsapp).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/app && npx vitest run src/components/layout/__tests__/MisQuodomsSidebar.test.tsx`
Expected: FAIL — se abre WhatsApp directo

- [ ] **Step 3: Replace the direct send with the dialog**

En los tres lugares, `enviar(q)` deja de llamar a `quodomApi.whatsapp` y pasa a abrir `<DialogoProveedores idquodom={q.id} ... />`. El refresco (`quodom:changed` + `refresh()`) se dispara cuando el diálogo informa que se envió, no antes: hasta que el usuario elige, el Quodom sigue en `CREADO`.

- [ ] **Step 4: Run the whole app suite**

Run: `cd quodom-web/app && npm test -- --run`
Expected: verde. Varios tests del sidebar y del detalle van a necesitar ajuste porque el botón ya no envía directo: **ajustar las expectativas, no el comportamiento.**

- [ ] **Step 5: Commit**

```bash
git add quodom-web/app/src/components/layout/MisQuodomsSidebar.tsx \
        quodom-web/app/src/screens/Quodom/DetalleQuodom.tsx \
        quodom-web/app/src/components/QuodomCard.tsx \
        quodom-web/app/src/components/layout/__tests__/
git commit -m "feat(app): send through the provider picker from all three places"
```

---

### Task 11: Los que faltan, desde el historial

**Files:**
- Modify: `quodom-web/app/src/screens/Quodom/DetalleQuodom.tsx`
- Test: `quodom-web/app/src/screens/Quodom/__tests__/DetalleQuodom.proveedores.test.tsx`

**Interfaces:**
- Consumes: `proveedores.delQuodom`, `DialogoProveedores`.
- Produces: nada.

- [ ] **Step 1: Write the failing test**

```tsx
// quodom-web/app/src/screens/Quodom/__tests__/DetalleQuodom.proveedores.test.tsx
// (mocks como los demás tests de la pantalla)

  it('un Quodom enviado muestra a cuántos proveedores les mandó', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue({
      proveedores: [
        { ...LE_BLEU, contactadoen: new Date(Date.now() - 3600_000).toISOString() },
        { ...OTRO, contactadoen: null }
      ],
      preciso: true, desde: 'Brown 3185', atribucion: 'Resultados de Google'
    });

    montar({ estado: 'ENVIADO' });

    expect(await screen.findByText(/1 de 2/i)).toBeInTheDocument();
    expect(screen.getByText('Pinturerías Le Bleu')).toBeInTheDocument();
  });

  it('deja mandarle a los que faltan', async () => {
    // ...
    fireEvent.click(await screen.findByRole('button', { name: /whatsapp/i }));
    await waitFor(() => expect(abrirWhatsapp).toHaveBeenCalled());
  });

  it('un Quodom en armado no muestra la sección', async () => {
    montar({ estado: 'CREADO' });
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(/proveedores contactados/i)).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/app && npx vitest run src/screens/Quodom/__tests__/DetalleQuodom.proveedores.test.tsx`
Expected: FAIL — la sección no existe

- [ ] **Step 3: Add the section**

En `DetalleQuodom`, cuando `estado === 'ENVIADO'`: una sección **"Proveedores contactados"** con *"le mandaste a N de M"*, los contactados con su fecha, y los pendientes con sus botones (el mismo renglón de `DialogoProveedores`, extraído a un componente compartido si hace falta — **no copiarlo**).

- [ ] **Step 4: Run the suite**

Run: `cd quodom-web/app && npm test -- --run`
Expected: verde

- [ ] **Step 5: Commit**

```bash
git add quodom-web/app/src/screens/Quodom/
git commit -m "feat(app): pick up the providers still to contact from a sent quodom"
```

---

### Task 12: El chequeo manual, el deploy y la documentación

**Files:**
- Create: `quodom-web/api/scripts/verificar-proveedores.js`
- Modify: `quodom-web/api/.env.example`, `quodom-web/render.yaml`
- Modify: `claude.md` (§3 y §9), `quodom-web/api/CLAUDE.md`, `quodom-web/app/CLAUDE.md`

- [ ] **Step 1: Write the calibration script**

Toma la localidad por parámetro y lee `config/rubrosPlaces.js`, así que **lo que se prueba es lo que corre en producción**. Para cada rubro activo imprime los comercios con nombre, puntuación, reseñas, distancia y teléfono.

```
cd quodom-web/api && node scripts/verificar-proveedores.js "Villa Ballester, Buenos Aires"
```

Mirar: que sean del rubro, que haya al menos tres, y cuántos salen sin teléfono.

- [ ] **Step 2: Declare the env vars**

`.env.example`: `PROVEEDORES_RATE_LIMIT_PER_MINUTE=10`. `render.yaml` no necesita nada nuevo: la clave ya está.

- [ ] **Step 3: Document it**

En `claude.md` §3, el bullet del selector de proveedores. En §9, que la búsqueda es por texto **medido**, con la tabla de términos y el ciclo de calibración. En `api/CLAUDE.md`, el comando nuevo y `npm run migrar-proveedores`. En `app/CLAUDE.md`, `DialogoProveedores`.

- [ ] **Step 4: Run everything**

Run: `cd quodom-web/api && npm test`
Run: `cd quodom-web/app && npm test -- --run && npm run build`

- [ ] **Step 5: Commit**

```bash
git add quodom-web/api/scripts/verificar-proveedores.js quodom-web/api/.env.example \
        claude.md quodom-web/api/CLAUDE.md quodom-web/app/CLAUDE.md
git commit -m "docs: document the provider search and add the calibration script"
```

- [ ] **Step 6: The manual gate**

Con la clave cargada, una persona:

1. Corre el script sobre **tres zonas distintas** — una de CABA, una del Gran Buenos Aires, y una ciudad chica del interior. Lo medido hasta ahora es **una sola zona**, y un término que anda en el conurbano puede no andar en un pueblo.
2. Manda un Quodom de verdad a un proveedor real y confirma que el chat abre con el número correcto.
3. Prueba con una dirección **sin coordenadas** y confirma que el popup dice que mide desde el centro de la localidad.
