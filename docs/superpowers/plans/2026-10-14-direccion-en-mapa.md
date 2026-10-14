# Dirección en el mapa (mitad A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una dirección se cargue eligiéndola del autocompletado de Google y quede guardada con sus coordenadas, llenando los campos que el mensaje de WhatsApp ya usa.

**Architecture:** La app le pide sugerencias y detalles de dirección a **nuestro** API (`/lugares/*`), que es el único que habla con Google y el único que tiene la clave. La traducción de la respuesta de Google a nuestros campos es una función pura, separada del HTTP, igual que la tabla de las 24 provincias. `users_direcciones` gana `placeid`, `lat`, `lng` y `coords_actualizado`; los campos de texto que ya existen se siguen llenando, ahora desde Google, y quedan editables a mano.

**Tech Stack:** Express + Sequelize + SQLite (CommonJS, `api/`), React 18 + Vite + TypeScript + CSS plano (`app/`), Jest + supertest (API), Vitest + happy-dom + Testing Library (app), Places API (New) de Google.

**Spec:** `docs/superpowers/specs/2026-10-14-direccion-en-mapa-y-proveedores-design.md`

## Global Constraints

- **OpenAPI manda.** Todo cambio de API empieza en `api/openapi.yaml` y después va el código. El validador **descarta todo campo que el contrato no declare**, así que una columna nueva que no esté en `DireccionInput` se pierde en silencio. Después de tocar el contrato: `cd app && npm run api-types`.
- **UI en español, código y commits en inglés.**
- **Tests de API: integración con SQLite real en memoria, sin mocks de base de datos.** Lo único que se mockea es el HTTP externo (`places.js`, como ya se hace con `callGemini`).
- **Nunca commitear secretos.** `GOOGLE_MAPS_API_KEY` va con `sync: false` en `render.yaml` y se carga a mano en el dashboard de Render.
- **Trampa de la base (§6):** `api/quodom.sqlite` está trackeada y es la que se despliega; corre en modo WAL y `model.sync()` **nunca hace ALTER** sobre una tabla existente. Después de cambiar el schema hay que correr la migración, hacer `wal_checkpoint(TRUNCATE)`, commitear el `.sqlite`, y **verificar el blob commiteado, no el archivo local**: `git show HEAD:quodom-web/api/quodom.sqlite > /tmp/check.sqlite` y consultar ese archivo.
- **Mobile-first estricto.** Breakpoints: tablet `(min-width: 601px) and (max-width: 1024px)`, desktop `(min-width: 1025px)`. Forma de hoja: `border-top-left-radius: 8px; border-bottom-right-radius: 8px`.
- **Fechas en fixtures: relativas, nunca absolutas** (`new Date(Date.now() - 3600_000)`).
- **No tocar** `F:\backup\Command Soluciones\Quodom\API` ni `...\APP` (referencia de sólo lectura), ni `quodom-new/` (deprecado).
- **Región y lenguaje de Google:** todas las consultas van con `includedRegionCodes: ['ar']` y `languageCode: 'es-419'`. El producto no atiende direcciones de otros países.

## Review Focus

Cinco entradas que la spec implica y que conviene que ningún task deje sin test. Cada una tiene su test asignado al task que es dueño del código.

1. **Dirección sin número de calle.** Google devuelve muchas direcciones sin `street_number` (una esquina, un lugar con nombre). El formulario hoy exige número. Esperable: la dirección se carga igual, `numero` queda vacío y **editable**, y el usuario lo completa. → Task 2 (parser) y Task 7 (que el campo quede editable).
2. **Consulta demasiado corta.** Cada tecla no puede ser una consulta paga. Esperable: con menos de 3 caracteres **no se llama a Google** en absoluto. → Task 3.
3. **La clave no está configurada.** En desarrollo va a pasar siempre. Esperable: el endpoint responde un error que **nombra la variable que falta**, y el formulario sigue permitiendo cargar la dirección a mano. → Task 3 (error nombrado) y Task 7 (el formulario no se rompe).
4. **Google tarda o contesta 503.** Esperable: el campo muestra que no pudo sugerir y el resto del formulario sigue usable; nunca se cuelga ni pierde lo tipeado. → Task 3 (timeout y 503) y Task 7 (la UI degrada).
5. **Un `placeid` inexistente, o de otro país.** Esperable: no se guardan coordenadas basura — si Google no devuelve `location`, el endpoint rechaza; si la provincia no está entre las 24, se guarda sin `idprovincia` en vez de fallar. → Task 2 y Task 5.

---

### Task 1: La tabla de las 24 provincias

Pura, sin HTTP y sin base. Va primera porque el parser de Task 2 la consume.

**Files:**
- Create: `quodom-web/api/src/config/provinciasGoogle.js`
- Test: `quodom-web/api/tests/provincias.google.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `idProvinciaDesdeGoogle(nombre: string | null | undefined): number | null`

- [ ] **Step 1: Write the failing test**

```js
// quodom-web/api/tests/provincias.google.test.js
const { idProvinciaDesdeGoogle, IDS_PROVINCIA } = require('../src/config/provinciasGoogle');

describe('idProvinciaDesdeGoogle', () => {
  it('matchea el nombre tal como lo devuelve Google', () => {
    expect(idProvinciaDesdeGoogle('Buenos Aires')).toBe(1);
    expect(idProvinciaDesdeGoogle('Córdoba')).toBe(6);
    expect(idProvinciaDesdeGoogle('Santiago del Estero')).toBe(22);
  });

  // Google alterna acentos y mayúsculas según el idioma pedido; nuestra tabla
  // no puede depender de eso.
  it('ignora acentos, mayúsculas y espacios de más', () => {
    expect(idProvinciaDesdeGoogle('cordoba')).toBe(6);
    expect(idProvinciaDesdeGoogle('  NEUQUÉN  ')).toBe(15);
    expect(idProvinciaDesdeGoogle('Entre Rios')).toBe(8);
  });

  // Las dos que de verdad difieren del nombre de nuestra tabla.
  it('resuelve CABA y Tierra del Fuego, que Google nombra distinto', () => {
    expect(idProvinciaDesdeGoogle('Ciudad Autónoma de Buenos Aires')).toBe(2);
    expect(idProvinciaDesdeGoogle('CABA')).toBe(2);
    expect(idProvinciaDesdeGoogle('Capital Federal')).toBe(2);
    expect(idProvinciaDesdeGoogle('Tierra del Fuego, Antártida e Islas del Atlántico Sur')).toBe(23);
    expect(idProvinciaDesdeGoogle('Tierra del Fuego')).toBe(23);
  });

  it('devuelve null para lo que no es una provincia argentina', () => {
    expect(idProvinciaDesdeGoogle('São Paulo')).toBeNull();
    expect(idProvinciaDesdeGoogle('')).toBeNull();
    expect(idProvinciaDesdeGoogle(null)).toBeNull();
    expect(idProvinciaDesdeGoogle(undefined)).toBeNull();
  });

  // Guarda de completitud: si alguien agrega un alias y se come un id, esto
  // falla. Los ids son los de la tabla `provincias` de la base.
  it('cubre las 24 provincias, sin huecos ni ids de más', () => {
    expect([...IDS_PROVINCIA].sort((a, b) => a - b))
      .toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/api && npx jest tests/provincias.google.test.js`
Expected: FAIL — `Cannot find module '../src/config/provinciasGoogle'`

- [ ] **Step 3: Write minimal implementation**

```js
// quodom-web/api/src/config/provinciasGoogle.js
/**
 * Las 24 provincias de Google contra el `id` de nuestra tabla `provincias`.
 *
 * Es una tabla literal y no un emparejamiento aproximado: con 24 valores
 * conocidos y fijos, adivinar es peor que enumerar. 22 coinciden palabra por
 * palabra con nuestra tabla; las únicas que difieren son CABA (que Google
 * nombra de tres formas distintas según el contexto) y Tierra del Fuego (que
 * lleva el nombre oficial largo).
 *
 * Si no matchea, devuelve null: sólo puede pasar con una dirección de otro
 * país, y una dirección sin `idprovincia` ya es válida en la base.
 */

// Minúsculas, sin acentos y sin espacios de más. Así una sola entrada por
// provincia alcanza, sin importar cómo venga escrita.
function normalizar(s) {
  if (typeof s !== 'string') return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

const POR_NOMBRE = new Map(Object.entries({
  'buenos aires': 1,
  'ciudad autonoma de buenos aires': 2,
  'caba': 2,
  'capital federal': 2,
  'catamarca': 3,
  'chaco': 4,
  'chubut': 5,
  'cordoba': 6,
  'corrientes': 7,
  'entre rios': 8,
  'formosa': 9,
  'jujuy': 10,
  'la pampa': 11,
  'la rioja': 12,
  'mendoza': 13,
  'misiones': 14,
  'neuquen': 15,
  'rio negro': 16,
  'salta': 17,
  'san juan': 18,
  'san luis': 19,
  'santa cruz': 20,
  'santa fe': 21,
  'santiago del estero': 22,
  'tierra del fuego': 23,
  'tierra del fuego, antartida e islas del atlantico sur': 23,
  'tucuman': 24
}));

const IDS_PROVINCIA = new Set(POR_NOMBRE.values());

function idProvinciaDesdeGoogle(nombre) {
  const id = POR_NOMBRE.get(normalizar(nombre));
  return id === undefined ? null : id;
}

module.exports = { idProvinciaDesdeGoogle, IDS_PROVINCIA, normalizar };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quodom-web/api && npx jest tests/provincias.google.test.js`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add quodom-web/api/src/config/provinciasGoogle.js quodom-web/api/tests/provincias.google.test.js
git commit -m "feat(api): map Google province names to our province ids"
```

---

### Task 2: El parser de la dirección de Google

Pura también. Recibe el objeto de un lugar y devuelve nuestros campos. Es dueña de las decisiones de mapeo, que son las que van a necesitar ajuste cuando se vean direcciones reales — por eso vive sola y no adentro del cliente HTTP.

**Files:**
- Create: `quodom-web/api/src/helpers/direccionDeGoogle.js`
- Test: `quodom-web/api/tests/direccionDeGoogle.test.js`

**Interfaces:**
- Consumes: `idProvinciaDesdeGoogle` de `src/config/provinciasGoogle`.
- Produces: `direccionDeGoogle(lugar): { placeid, calle, numero, localidad, partido, idprovincia, cp, lat, lng, direccion }` — `numero`, `localidad`, `partido`, `cp` son `''` cuando faltan; `idprovincia`, `lat` y `lng` son `null` cuando faltan.

- [ ] **Step 1: Write the failing test**

```js
// quodom-web/api/tests/direccionDeGoogle.test.js
const { direccionDeGoogle } = require('../src/helpers/direccionDeGoogle');

// La forma que devuelve Places API (New): addressComponents con longText y types.
function comp(longText, ...types) {
  return { longText, shortText: longText, types };
}

const CORRIENTES_1234 = {
  id: 'ChIJ-caba-1',
  formattedAddress: 'Av. Corrientes 1234, C1043 Cdad. Autónoma de Buenos Aires, Argentina',
  location: { latitude: -34.6037, longitude: -58.3816 },
  addressComponents: [
    comp('1234', 'street_number'),
    comp('Avenida Corrientes', 'route'),
    comp('San Nicolás', 'sublocality', 'sublocality_level_1'),
    comp('Buenos Aires', 'locality'),
    comp('Ciudad Autónoma de Buenos Aires', 'administrative_area_level_1'),
    comp('C1043', 'postal_code')
  ]
};

describe('direccionDeGoogle', () => {
  it('desarma una dirección de CABA en nuestros campos', () => {
    expect(direccionDeGoogle(CORRIENTES_1234)).toEqual({
      placeid: 'ChIJ-caba-1',
      calle: 'Avenida Corrientes',
      numero: '1234',
      localidad: 'San Nicolás',
      partido: '',
      idprovincia: 2,
      cp: 'C1043',
      lat: -34.6037,
      lng: -58.3816,
      direccion: 'Av. Corrientes 1234, C1043 Cdad. Autónoma de Buenos Aires, Argentina'
    });
  });

  // En CABA, `locality` dice "Buenos Aires" para toda la ciudad: el barrio está
  // en `sublocality`. Guardar "Buenos Aires" como localidad no le dice nada al
  // proveedor, y es el dato que viaja en el mensaje de WhatsApp.
  it('en CABA prefiere el barrio (sublocality) sobre la localidad', () => {
    expect(direccionDeGoogle(CORRIENTES_1234).localidad).toBe('San Nicolás');
  });

  it('en el Gran Buenos Aires usa locality y guarda el partido', () => {
    const out = direccionDeGoogle({
      id: 'ChIJ-gba-1',
      formattedAddress: 'Mitre 450, B1642 San Isidro, Provincia de Buenos Aires, Argentina',
      location: { latitude: -34.4707, longitude: -58.5075 },
      addressComponents: [
        comp('450', 'street_number'),
        comp('Bartolomé Mitre', 'route'),
        comp('San Isidro', 'locality'),
        comp('San Isidro', 'administrative_area_level_2'),
        comp('Buenos Aires', 'administrative_area_level_1'),
        comp('B1642', 'postal_code')
      ]
    });
    expect(out.localidad).toBe('San Isidro');
    expect(out.partido).toBe('San Isidro');
    expect(out.idprovincia).toBe(1);
  });

  // Review Focus 1: una esquina o un lugar con nombre no tiene altura.
  // La dirección tiene que poder cargarse igual; el usuario completa el número.
  it('deja el número vacío cuando Google no lo da, sin fallar', () => {
    const out = direccionDeGoogle({
      id: 'ChIJ-esquina',
      formattedAddress: 'Av. Corrientes & Callao, Buenos Aires',
      location: { latitude: -34.6, longitude: -58.39 },
      addressComponents: [
        comp('Avenida Corrientes', 'route'),
        comp('Ciudad Autónoma de Buenos Aires', 'administrative_area_level_1')
      ]
    });
    expect(out.numero).toBe('');
    expect(out.calle).toBe('Avenida Corrientes');
    expect(out.cp).toBe('');
    expect(out.idprovincia).toBe(2);
  });

  // Review Focus 5: fuera de Argentina no hay id de provincia. Se guarda sin
  // provincia en vez de rechazar; la columna es nullable desde siempre.
  it('devuelve idprovincia null cuando la provincia no es argentina', () => {
    const out = direccionDeGoogle({
      id: 'ChIJ-br',
      formattedAddress: 'Av. Paulista 1000, São Paulo, Brasil',
      location: { latitude: -23.56, longitude: -46.65 },
      addressComponents: [comp('São Paulo', 'administrative_area_level_1')]
    });
    expect(out.idprovincia).toBeNull();
  });

  // Review Focus 5: sin coordenadas el lugar es inservible para el selector.
  // El parser no decide: informa lat/lng en null y el endpoint rechaza.
  it('devuelve lat y lng en null cuando falta location', () => {
    const out = direccionDeGoogle({ id: 'ChIJ-x', addressComponents: [] });
    expect(out.lat).toBeNull();
    expect(out.lng).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/api && npx jest tests/direccionDeGoogle.test.js`
Expected: FAIL — `Cannot find module '../src/helpers/direccionDeGoogle'`

- [ ] **Step 3: Write minimal implementation**

```js
// quodom-web/api/src/helpers/direccionDeGoogle.js
/**
 * Traduce un lugar de Places API (New) a los campos de `users_direcciones`.
 *
 * Separado del cliente HTTP a propósito: estas reglas de mapeo son las que hay
 * que ajustar cuando se ven direcciones reales, y pegadas al `fetch` cada
 * ajuste necesitaría simular una respuesta de Google.
 *
 * Los campos de texto se devuelven en '' y no en null porque van a columnas
 * que el mensaje de WhatsApp concatena.
 */
const { idProvinciaDesdeGoogle } = require('../config/provinciasGoogle');

function porTipo(componentes, tipo) {
  const c = (componentes || []).find(x => (x.types || []).includes(tipo));
  return c ? (c.longText || '') : '';
}

function direccionDeGoogle(lugar) {
  const comps = (lugar && lugar.addressComponents) || [];
  const loc = (lugar && lugar.location) || null;

  // En CABA `locality` es "Buenos Aires" para toda la ciudad y el barrio vive
  // en `sublocality`. El barrio es lo que le sirve al proveedor.
  const barrio = porTipo(comps, 'sublocality') || porTipo(comps, 'sublocality_level_1');

  return {
    placeid: (lugar && lugar.id) || '',
    calle: porTipo(comps, 'route'),
    numero: porTipo(comps, 'street_number'),
    localidad: barrio || porTipo(comps, 'locality'),
    partido: porTipo(comps, 'administrative_area_level_2'),
    idprovincia: idProvinciaDesdeGoogle(porTipo(comps, 'administrative_area_level_1')),
    cp: porTipo(comps, 'postal_code'),
    lat: loc && typeof loc.latitude === 'number' ? loc.latitude : null,
    lng: loc && typeof loc.longitude === 'number' ? loc.longitude : null,
    direccion: (lugar && lugar.formattedAddress) || ''
  };
}

module.exports = { direccionDeGoogle };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quodom-web/api && npx jest tests/direccionDeGoogle.test.js`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add quodom-web/api/src/helpers/direccionDeGoogle.js quodom-web/api/tests/direccionDeGoogle.test.js
git commit -m "feat(api): parse a Google place into our address fields"
```

---

### Task 3: El cliente de Places

El único archivo que habla con Google. Copia la forma de `src/helpers/gemini.js`: dueño del `fetch`, timeout propio, clave desde el entorno, y el formato de Google encapsulado para que nadie más lo conozca.

**Files:**
- Create: `quodom-web/api/src/helpers/places.js`
- Test: `quodom-web/api/tests/places.helper.test.js`

**Interfaces:**
- Consumes: nada del plan (sólo `process.env` y `fetch`).
- Produces:
  - `sugerencias({ q, sesion }): Promise<Array<{ placeid: string, texto: string }>>`
  - `detalleDireccion({ placeid, sesion }): Promise<object>` — el lugar crudo de Google, para que lo traduzca `direccionDeGoogle`.
  - `PlacesError` — `Error` con `.codigo` (`'sin_clave' | 'google_error' | 'timeout'`).

- [ ] **Step 1: Write the failing test**

```js
// quodom-web/api/tests/places.helper.test.js
const { sugerencias, detalleDireccion } = require('../src/helpers/places');

describe('places helper', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GOOGLE_MAPS_API_KEY;

  beforeEach(() => { process.env.GOOGLE_MAPS_API_KEY = 'test-key'; });
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = originalKey;
    delete process.env.PLACES_TIMEOUT_MS;
  });

  it('pide sugerencias con la clave, acotadas a Argentina, y las devuelve planas', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestions: [
          { placePrediction: { placeId: 'ChIJ-1', text: { text: 'Av. Corrientes 1234, CABA' } } },
          { placePrediction: { placeId: 'ChIJ-2', text: { text: 'Av. Corrientes 1234, Rosario' } } }
        ]
      })
    });

    const out = await sugerencias({ q: 'corrientes 1234', sesion: 'ses-1' });

    expect(out).toEqual([
      { placeid: 'ChIJ-1', texto: 'Av. Corrientes 1234, CABA' },
      { placeid: 'ChIJ-2', texto: 'Av. Corrientes 1234, Rosario' }
    ]);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('places:autocomplete');
    expect(opts.headers['X-Goog-Api-Key']).toBe('test-key');
    const body = JSON.parse(opts.body);
    expect(body.input).toBe('corrientes 1234');
    expect(body.sessionToken).toBe('ses-1');
    expect(body.includedRegionCodes).toEqual(['ar']);
  });

  // Review Focus 2: cada tecla no puede ser una consulta paga.
  it('con menos de 3 caracteres no llama a Google en absoluto', async () => {
    global.fetch = jest.fn();

    expect(await sugerencias({ q: 'co', sesion: 's' })).toEqual([]);
    expect(await sugerencias({ q: '   ', sesion: 's' })).toEqual([]);
    expect(await sugerencias({ q: '', sesion: 's' })).toEqual([]);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  // Review Focus 3: en desarrollo la clave no va a estar. El error tiene que
  // nombrar la variable, no decir "fetch failed".
  it('sin clave falla nombrando la variable que falta, sin llamar a Google', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    global.fetch = jest.fn();

    await expect(sugerencias({ q: 'corrientes', sesion: 's' }))
      .rejects.toThrow(/GOOGLE_MAPS_API_KEY/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // Review Focus 4.
  it('un 503 de Google se reporta como google_error con el status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 503, text: async () => 'overloaded'
    });

    await expect(sugerencias({ q: 'corrientes', sesion: 's' }))
      .rejects.toMatchObject({ codigo: 'google_error' });
  });

  it('un timeout se reporta como timeout y no cuelga', async () => {
    process.env.PLACES_TIMEOUT_MS = '10';
    global.fetch = jest.fn((url, opts) => new Promise((_, reject) => {
      opts.signal.addEventListener('abort', () => {
        const e = new Error('aborted');
        e.name = 'AbortError';
        reject(e);
      });
    }));

    await expect(sugerencias({ q: 'corrientes', sesion: 's' }))
      .rejects.toMatchObject({ codigo: 'timeout' });
  });

  it('el detalle pide sólo los campos del nivel básico y cierra la sesión', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'ChIJ-1', formattedAddress: 'x', addressComponents: [] })
    });

    const out = await detalleDireccion({ placeid: 'ChIJ-1', sesion: 'ses-1' });

    expect(out.id).toBe('ChIJ-1');
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('/v1/places/ChIJ-1');
    // El sessionToken en el detalle es lo que hace que la tanda de sugerencias
    // no se cobre aparte.
    expect(url).toContain('sessionToken=ses-1');
    // Nada del nivel caro: ni rating, ni teléfono, ni displayName.
    const mask = opts.headers['X-Goog-FieldMask'];
    expect(mask).toContain('addressComponents');
    expect(mask).toContain('location');
    expect(mask).not.toMatch(/rating|phone/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/api && npx jest tests/places.helper.test.js`
Expected: FAIL — `Cannot find module '../src/helpers/places'`

- [ ] **Step 3: Write minimal implementation**

```js
// quodom-web/api/src/helpers/places.js
/**
 * El único archivo que habla con Google Places. Nadie más conoce su formato.
 *
 * Misma forma que `gemini.js`, que es el precedente de un HTTP externo y pago
 * en este repo: dueño del `fetch`, timeout propio, clave desde el entorno.
 *
 * Mitad A usa sólo los dos de direcciones. La búsqueda de proveedores (mitad B)
 * se agrega acá, con su propia máscara de campos.
 */
const BASE = 'https://places.googleapis.com/v1';
const TIMEOUT_POR_DEFECTO = 8000;
const MIN_CARACTERES = 3;

// Sólo lo que hace falta para desarmar una dirección. Pedir un campo del nivel
// caro acá (rating, teléfono, displayName) sube el precio de TODA la consulta.
const CAMPOS_DIRECCION = 'id,formattedAddress,addressComponents,location';

class PlacesError extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = 'PlacesError';
    this.codigo = codigo;
  }
}

function clave() {
  const k = process.env.GOOGLE_MAPS_API_KEY;
  if (!k) {
    throw new PlacesError('sin_clave',
      'Falta GOOGLE_MAPS_API_KEY. Cargala en el entorno (en Render va a mano en el dashboard).');
  }
  return k;
}

function timeoutMs() {
  const n = Number(process.env.PLACES_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : TIMEOUT_POR_DEFECTO;
}

async function pedir(url, opts) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      throw new PlacesError('google_error', 'places: HTTP ' + res.status + ' ' + detalle.slice(0, 200));
    }
    return await res.json();
  } catch (e) {
    if (e instanceof PlacesError) throw e;
    if (e.name === 'AbortError') throw new PlacesError('timeout', 'places: timeout');
    throw new PlacesError('google_error', 'places: ' + e.message);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sugerencias de dirección mientras el usuario tipea.
 *
 * El corte en 3 caracteres es control de gasto, no cosmética: sin él, cada
 * tecla es una consulta. El `sesion` es el token que agrupa la tanda con el
 * detalle final para que Google no cobre las sugerencias aparte.
 */
async function sugerencias({ q, sesion }) {
  const texto = (q || '').trim();
  if (texto.length < MIN_CARACTERES) return [];

  const key = clave();
  const data = await pedir(BASE + '/places:autocomplete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
    body: JSON.stringify({
      input: texto,
      sessionToken: sesion,
      includedRegionCodes: ['ar'],
      languageCode: 'es-419'
    })
  });

  return (data.suggestions || [])
    .map(s => s.placePrediction)
    .filter(Boolean)
    .map(p => ({ placeid: p.placeId, texto: (p.text && p.text.text) || '' }));
}

/** El lugar crudo. Lo traduce `direccionDeGoogle`, que es puro y testeable. */
async function detalleDireccion({ placeid, sesion }) {
  const key = clave();
  const url = BASE + '/places/' + encodeURIComponent(placeid)
    + '?languageCode=es-419'
    + (sesion ? '&sessionToken=' + encodeURIComponent(sesion) : '');

  return await pedir(url, {
    method: 'GET',
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': CAMPOS_DIRECCION }
  });
}

module.exports = { sugerencias, detalleDireccion, PlacesError };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quodom-web/api && npx jest tests/places.helper.test.js`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add quodom-web/api/src/helpers/places.js quodom-web/api/tests/places.helper.test.js
git commit -m "feat(api): add the Places client for address autocomplete"
```

---

### Task 4: Las columnas nuevas y la base commiteada

Este task es el único con la trampa de §6. **La verificación del blob no es opcional**: saltearla ya rompió el deploy una vez, con el síntoma de que el server arranca limpio y falla toda lectura.

**Files:**
- Modify: `quodom-web/api/src/models/users_direcciones.model.js`
- Create: `quodom-web/api/src/seed/migrar-direccion-mapa.js`
- Modify: `quodom-web/api/package.json` (un script)
- Modify: `quodom-web/api/quodom.sqlite` (la base commiteada)
- Test: `quodom-web/api/tests/direcciones.mapa.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: las columnas `placeid`, `lat`, `lng`, `coords_actualizado` en `users_direcciones`, que Task 6 persiste y la mitad B lee.

- [ ] **Step 1: Write the failing test**

```js
// quodom-web/api/tests/direcciones.mapa.test.js
const db = require('../src/helpers/db');

beforeAll(async () => { await db.ready; });

describe('users_direcciones con datos del mapa', () => {
  it('tiene las columnas del mapa', async () => {
    const [cols] = await db.sequelize.query('PRAGMA table_info(users_direcciones)');
    const nombres = cols.map(c => c.name);
    expect(nombres).toContain('placeid');
    expect(nombres).toContain('lat');
    expect(nombres).toContain('lng');
    expect(nombres).toContain('coords_actualizado');
  });

  it('guarda y devuelve las coordenadas como números', async () => {
    const d = await db.user_direcciones.create({
      userid: 'u-mapa', calle: 'Corrientes', numero: '1234',
      placeid: 'ChIJ-abc', lat: -34.6037, lng: -58.3816,
      coords_actualizado: new Date()
    });
    const leida = await db.user_direcciones.findByPk(d.id);
    expect(leida.placeid).toBe('ChIJ-abc');
    expect(leida.lat).toBeCloseTo(-34.6037, 4);
    expect(leida.lng).toBeCloseTo(-58.3816, 4);
  });

  // Una dirección cargada a mano, sin pasar por el mapa, sigue siendo válida:
  // es el camino de hoy y el que queda cuando no hay clave de Google.
  it('acepta una dirección sin placeid ni coordenadas', async () => {
    const d = await db.user_direcciones.create({
      userid: 'u-mano', calle: 'Mitre', numero: '450'
    });
    expect(d.id).toBeGreaterThan(0);
    expect(d.lat).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/api && npx jest tests/direcciones.mapa.test.js`
Expected: FAIL — la primera prueba no encuentra `placeid` en `PRAGMA table_info`

- [ ] **Step 3: Write minimal implementation**

En `quodom-web/api/src/models/users_direcciones.model.js`, dentro de `attributes`, después de `observaciones`:

```js
        observaciones: { type: DataTypes.STRING, allowNull: true },
        // Datos del mapa. `placeid` es el identificador de Google y es el único
        // dato de Places que se puede guardar sin límite de tiempo; las
        // coordenadas son caché de 30 días y se vuelven a resolver desde él.
        // Todo nullable: una dirección cargada a mano sigue siendo válida.
        placeid: { type: DataTypes.STRING, allowNull: true },
        lat: { type: DataTypes.FLOAT, allowNull: true },
        lng: { type: DataTypes.FLOAT, allowNull: true },
        coords_actualizado: { type: DataTypes.DATE, allowNull: true },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd quodom-web/api && npx jest tests/direcciones.mapa.test.js`
Expected: PASS, 3 tests. La base de los tests es `:memory:`, así que `model.sync()` crea la tabla entera y las columnas aparecen solas.

- [ ] **Step 5: Write the migration script for the committed database**

Los tests pasan y la base real **todavía no tiene las columnas**: `model.sync()` nunca hace `ALTER` sobre una tabla que ya existe. Copia exacta del patrón de `src/seed/migrar-empresa.js`.

```js
// quodom-web/api/src/seed/migrar-direccion-mapa.js
/**
 * Agrega a `users_direcciones` las columnas del mapa.
 *
 * Hace falta un script porque `model.sync()` crea una tabla que falta pero
 * NUNCA hace ALTER sobre una que ya existe: sin esto la base sigue sin las
 * columnas y guardar una dirección falla, con el modelo diciendo que están.
 *
 * `ALTER TABLE ... ADD COLUMN` no toca las filas existentes, así que ninguna
 * dirección se pierde: las viejas quedan con placeid y coordenadas en null,
 * que es un estado válido. Es idempotente: si la columna ya está, la saltea.
 */
require('dotenv').config();
const db = require('../helpers/db');

const COLUMNAS = [
  ['placeid', 'VARCHAR(255)'],
  ['lat', 'FLOAT'],
  ['lng', 'FLOAT'],
  ['coords_actualizado', 'DATETIME']
];

async function main() {
  await db.ready;

  const [cols] = await db.sequelize.query('PRAGMA table_info(users_direcciones)');
  const existentes = new Set(cols.map(c => c.name));

  for (const [nombre, tipo] of COLUMNAS) {
    if (existentes.has(nombre)) {
      console.log('  ' + nombre + ': ya estaba');
      continue;
    }
    await db.sequelize.query('ALTER TABLE users_direcciones ADD COLUMN "' + nombre + '" ' + tipo);
    console.log('  ' + nombre + ': agregada');
  }

  // La base corre en WAL y sólo quodom.sqlite se commitea: sin el checkpoint,
  // el archivo que se sube puede no tener estos cambios adentro.
  const [[wal]] = await db.sequelize.query('PRAGMA wal_checkpoint(TRUNCATE)');
  console.log('WAL checkpointed into quodom.sqlite:', JSON.stringify(wal));

  await db.sequelize.close();
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('Migrar-direccion-mapa failed:', err); process.exit(1); });
```

En `quodom-web/api/package.json`, junto a los otros `migrar-*`:

```json
    "migrar-direccion-mapa": "node src/seed/migrar-direccion-mapa.js",
```

- [ ] **Step 6: Run the migration against the real database**

Run: `cd quodom-web/api && npm run migrar-direccion-mapa`
Expected: las cuatro columnas "agregada" y una línea de `WAL checkpointed`.

- [ ] **Step 7: Verify the COMMITTED blob, not the working tree (§6)**

Stageá la base y verificá el blob que git va a subir. Mirar el archivo local **no prueba nada**.

```bash
cd "F:/backup/Command Soluciones/Quodom/Quodom"
git add quodom-web/api/quodom.sqlite
git show :quodom-web/api/quodom.sqlite > /tmp/check.sqlite
cd quodom-web/api && node -e "
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('/tmp/check.sqlite');
db.all('PRAGMA table_info(users_direcciones)', (e, r) => {
  if (e) { console.error('ERR', e.message); process.exit(1); }
  const n = r.map(x => x.name);
  const faltan = ['placeid','lat','lng','coords_actualizado'].filter(c => !n.includes(c));
  console.log('columnas:', n.join(', '));
  console.log(faltan.length ? 'FALTAN: ' + faltan.join(', ') : 'OK: las cuatro columnas estan en el blob');
  db.all('SELECT COUNT(*) c FROM productos', (e2, r2) => {
    console.log('productos:', e2 ? 'ERR' : r2[0].c, '(tienen que ser 644)');
  });
});"
```

Expected: `OK: las cuatro columnas estan en el blob` y `productos: 644`.
Si falta alguna, **no commitear**: volver al Step 6.

- [ ] **Step 8: Run the whole API suite**

Run: `cd quodom-web/api && npm test`
Expected: todas las suites verdes. Agregar una columna nullable no debería tocar ningún test existente; si alguno falla, arreglarlo antes de commitear.

- [ ] **Step 9: Commit**

```bash
git add quodom-web/api/src/models/users_direcciones.model.js \
        quodom-web/api/src/seed/migrar-direccion-mapa.js \
        quodom-web/api/package.json \
        quodom-web/api/quodom.sqlite \
        quodom-web/api/tests/direcciones.mapa.test.js
git commit -m "feat(api): store place id and coordinates on an address"
```

---

### Task 5: Los endpoints `/lugares`

El contrato primero, como manda §2: el validador descarta todo campo que `openapi.yaml` no declare.

**Files:**
- Modify: `quodom-web/api/openapi.yaml` (schemas y dos paths)
- Create: `quodom-web/api/src/controllers/lugares.controller.js`
- Create: `quodom-web/api/src/routes/lugares.route.js`
- Modify: `quodom-web/api/src/server.js:65` (montar la ruta junto a las demás)
- Test: `quodom-web/api/tests/lugares.test.js`

**Interfaces:**
- Consumes: `sugerencias`, `detalleDireccion`, `PlacesError` de `src/helpers/places`; `direccionDeGoogle` de `src/helpers/direccionDeGoogle`.
- Produces: `GET /lugares/sugerencias?q=&sesion=` → `{ sugerencias: [{ placeid, texto }] }`; `GET /lugares/{placeid}?sesion=` → `DireccionDeLugar`.

- [ ] **Step 1: Write the failing test**

```js
// quodom-web/api/tests/lugares.test.js
jest.mock('../src/helpers/places');

const request = require('supertest');
const app = require('../src/server');
const db = require('../src/helpers/db');
const { sessionToken } = require('./helpers/session');
const places = require('../src/helpers/places');
const { PlacesError } = jest.requireActual('../src/helpers/places');

let token;

beforeAll(async () => {
  await db.ready;
  await request(app).post('/users/signup').send({
    username: 'lugar', email: 'lugar@test.com', nombre: 'Lu', password: 'secreto123',
    codArea: '11', telefono: '55551111'
  });
  const login = await request(app).post('/users/signin')
    .send({ username: 'lugar@test.com', password: 'secreto123' });
  token = sessionToken(login);
});

beforeEach(() => jest.resetAllMocks());

const auth = req => req.set('Authorization', 'Bearer ' + token);

describe('GET /lugares/sugerencias', () => {
  it('devuelve las sugerencias de Google', async () => {
    places.sugerencias.mockResolvedValue([{ placeid: 'ChIJ-1', texto: 'Corrientes 1234, CABA' }]);

    const res = await auth(request(app).get('/lugares/sugerencias?q=corrientes&sesion=s1'));

    expect(res.status).toBe(200);
    expect(res.body.sugerencias).toEqual([{ placeid: 'ChIJ-1', texto: 'Corrientes 1234, CABA' }]);
    expect(places.sugerencias).toHaveBeenCalledWith({ q: 'corrientes', sesion: 's1' });
  });

  it('exige sesión', async () => {
    const res = await request(app).get('/lugares/sugerencias?q=corrientes&sesion=s1');
    expect(res.status).toBe(401);
  });

  // Review Focus 3: el error tiene que nombrar lo que falta, no ser un 500 mudo.
  it('sin clave configurada responde 503 nombrando la variable', async () => {
    places.sugerencias.mockRejectedValue(
      new PlacesError('sin_clave', 'Falta GOOGLE_MAPS_API_KEY. Cargala en el entorno.'));

    const res = await auth(request(app).get('/lugares/sugerencias?q=corrientes&sesion=s1'));

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('sin_clave');
    expect(res.body.message).toMatch(/GOOGLE_MAPS_API_KEY/);
  });

  // Review Focus 4.
  it('un timeout de Google responde 503 y no 500', async () => {
    places.sugerencias.mockRejectedValue(new PlacesError('timeout', 'places: timeout'));

    const res = await auth(request(app).get('/lugares/sugerencias?q=corrientes&sesion=s1'));

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('timeout');
  });
});

describe('GET /lugares/:placeid', () => {
  it('devuelve la dirección desarmada con sus coordenadas', async () => {
    places.detalleDireccion.mockResolvedValue({
      id: 'ChIJ-1',
      formattedAddress: 'Av. Corrientes 1234, CABA, Argentina',
      location: { latitude: -34.6037, longitude: -58.3816 },
      addressComponents: [
        { longText: '1234', types: ['street_number'] },
        { longText: 'Avenida Corrientes', types: ['route'] },
        { longText: 'San Nicolás', types: ['sublocality'] },
        { longText: 'Ciudad Autónoma de Buenos Aires', types: ['administrative_area_level_1'] }
      ]
    });

    const res = await auth(request(app).get('/lugares/ChIJ-1?sesion=s1'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      placeid: 'ChIJ-1', calle: 'Avenida Corrientes', numero: '1234',
      localidad: 'San Nicolás', idprovincia: 2, lat: -34.6037, lng: -58.3816
    });
  });

  // Review Focus 5: sin coordenadas el lugar no sirve para buscar proveedores.
  // Rechazar es mejor que guardar una dirección que después miente.
  it('rechaza un lugar sin coordenadas', async () => {
    places.detalleDireccion.mockResolvedValue({ id: 'ChIJ-x', addressComponents: [] });

    const res = await auth(request(app).get('/lugares/ChIJ-x?sesion=s1'));

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('lugar_sin_coordenadas');
  });

  // Review Focus 5: fuera de Argentina no hay provincia nuestra, pero la
  // dirección se devuelve igual: la columna es nullable.
  it('devuelve idprovincia null para una provincia que no es argentina', async () => {
    places.detalleDireccion.mockResolvedValue({
      id: 'ChIJ-br',
      formattedAddress: 'Av. Paulista 1000, São Paulo',
      location: { latitude: -23.56, longitude: -46.65 },
      addressComponents: [{ longText: 'São Paulo', types: ['administrative_area_level_1'] }]
    });

    const res = await auth(request(app).get('/lugares/ChIJ-br?sesion=s1'));

    expect(res.status).toBe(200);
    expect(res.body.idprovincia).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/api && npx jest tests/lugares.test.js`
Expected: FAIL — 404 en todos los casos; la ruta no existe.

- [ ] **Step 3: Add the contract to openapi.yaml**

En `components.schemas`, después de `DireccionInput` (línea ~236):

```yaml
    SugerenciaLugar:
      type: object
      required: [placeid, texto]
      properties:
        placeid: { type: string }
        texto: { type: string }
    DireccionDeLugar:
      type: object
      required: [placeid, calle, numero, localidad, partido, cp, direccion]
      properties:
        placeid: { type: string }
        calle: { type: string }
        numero: { type: string }
        localidad: { type: string }
        partido: { type: string }
        idprovincia: { type: integer, nullable: true }
        cp: { type: string }
        lat: { type: number }
        lng: { type: number }
        direccion: { type: string }
```

En `components.responses`, después de `EnvioBloqueado`, una respuesta nueva — la van a usar estos dos endpoints y la búsqueda de proveedores de la mitad B:

```yaml
    ServicioExterno:
      description: >
        Un servicio de afuera (Google Places) no está disponible, o falta su
        clave. No es un error del pedido: reintentar más tarde puede andar.
      content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
```

En `paths`, junto a `/localidades/prov` (línea ~397), respetando el orden alfabético que ya tiene el archivo. **Los nombres de las respuestas reutilizables son los que ya existen en el archivo** (`Unauthorized`, `TooMany`), no inventar otros:

```yaml
  /lugares/sugerencias:
    get:
      summary: Sugerencias de dirección mientras se tipea (Google Places)
      security: [{ bearerAuth: [] }]
      parameters:
        - { name: q, in: query, required: true, schema: { type: string } }
        - { name: sesion, in: query, required: true, schema: { type: string } }
      responses:
        '200':
          description: Las sugerencias. Lista vacía si la consulta es muy corta.
          content:
            application/json:
              schema:
                type: object
                required: [sugerencias]
                properties:
                  sugerencias:
                    type: array
                    items: { $ref: '#/components/schemas/SugerenciaLugar' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '429': { $ref: '#/components/responses/TooMany' }
        '503': { $ref: '#/components/responses/ServicioExterno' }
  /lugares/{placeid}:
    get:
      summary: La dirección elegida, desarmada en nuestros campos
      security: [{ bearerAuth: [] }]
      parameters:
        - { name: placeid, in: path, required: true, schema: { type: string } }
        - { name: sesion, in: query, required: false, schema: { type: string } }
      responses:
        '200':
          description: La dirección
          content:
            application/json:
              schema: { $ref: '#/components/schemas/DireccionDeLugar' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '422':
          description: El lugar no tiene coordenadas y no sirve para buscar proveedores
          content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
        '429': { $ref: '#/components/responses/TooMany' }
        '503': { $ref: '#/components/responses/ServicioExterno' }
```

Dos tests son la red de seguridad de este step: `openapi.coverage.test.js` falla si una ruta del server no está en el contrato, y `openapi.validation.test.js` si una respuesta no valida contra él.

- [ ] **Step 4: Write the controller and the route**

```js
// quodom-web/api/src/controllers/lugares.controller.js
const places = require('../helpers/places');
const { direccionDeGoogle } = require('../helpers/direccionDeGoogle');
const { httpError } = require('../helpers/http-error');

module.exports = { sugerencias, direccion };

async function sugerencias(q, sesion) {
  return { sugerencias: await places.sugerencias({ q, sesion }) };
}

async function direccion(placeid, sesion) {
  const lugar = await places.detalleDireccion({ placeid, sesion });
  const d = direccionDeGoogle(lugar);

  // Sin coordenadas la dirección no sirve para lo único que agregan los
  // datos del mapa: buscar proveedores alrededor. Guardarla igual la haría
  // ver cargada y mentir después, cuando ya nadie mire este paso.
  if (d.lat === null || d.lng === null) {
    throw httpError(422, 'lugar_sin_coordenadas', 'El lugar elegido no tiene coordenadas.');
  }
  return d;
}
```

> **Por qué `httpError` y no un `Error` con `.status` encima.** El manejador de
> errores serializa con `const { status, ...body } = err`, y en un `Error` la
> propiedad `message` **no es enumerable**: spreading un `Error` pierde el
> mensaje y la respuesta sale sin `message` ni `error`. `httpError` devuelve un
> objeto plano, que es lo que el manejador espera — lo fija
> `tests/http-error.test.js`.

```js
// quodom-web/api/src/routes/lugares.route.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const Controler = require('../controllers/lugares.controller');

// Cada consulta se le paga a Google, así que el tope no es antiabuso sino
// control de gasto: un bug de la app que dispare sugerencias en bucle se
// frena acá y no en la factura.
const MAX_RPM = () => Number(process.env.LUGARES_RATE_LIMIT_PER_MINUTE) || 40;

router.get('/sugerencias', auth.verifyToken(),
  (req, res, next) => rateLimit.perUserPerMinute(MAX_RPM())(req, res, next), getSugerencias);
router.get('/:placeid', auth.verifyToken(),
  (req, res, next) => rateLimit.perUserPerMinute(MAX_RPM())(req, res, next), getDireccion);

module.exports = router;

function getSugerencias(req, res, next) {
  Controler.sugerencias(req.query.q, req.query.sesion)
    .then(data => res.json(data))
    .catch(e => next(mapear(e)));
}

function getDireccion(req, res, next) {
  Controler.direccion(req.params.placeid, req.query.sesion)
    .then(data => res.json(data))
    .catch(e => next(mapear(e)));
}

// Un problema de Google es 503 y no 500: es un servicio de afuera que no está
// disponible, no un error nuestro. El código viaja para que la app pueda
// distinguir "falta la clave" de "Google tardó".
//
// Se convierte a httpError (objeto plano) en vez de ponerle .status al Error:
// el manejador serializa con spread, y el `message` de un Error no es
// enumerable, así que la respuesta saldría sin mensaje.
function mapear(e) {
  if (e && e.name === 'PlacesError') {
    return httpError(503, e.codigo || 'google_error', e.message);
  }
  return e;
}
```

La cabecera de la ruta necesita además:

```js
const { httpError } = require('../helpers/http-error');
```

En `quodom-web/api/src/server.js`, junto a las otras rutas (línea ~65):

```js
app.use('/lugares', require('./routes/lugares.route'));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd quodom-web/api && npx jest tests/lugares.test.js`
Expected: PASS, 7 tests

- [ ] **Step 6: Run the contract tests**

Run: `cd quodom-web/api && npx jest tests/openapi.coverage.test.js tests/openapi.validation.test.js tests/openapi.docs.test.js`
Expected: PASS. Si cobertura falla, la ruta nueva no está en el contrato; si validación falla, una respuesta no coincide con el schema.

- [ ] **Step 7: Commit**

```bash
git add quodom-web/api/openapi.yaml \
        quodom-web/api/src/controllers/lugares.controller.js \
        quodom-web/api/src/routes/lugares.route.js \
        quodom-web/api/src/server.js \
        quodom-web/api/tests/lugares.test.js
git commit -m "feat(api): serve address suggestions and details from Places"
```

---

### Task 6: Guardar el placeid y las coordenadas

Las columnas existen (Task 4) y la dirección se puede consultar (Task 5), pero `create`/`update` todavía descartan los campos nuevos: **el validador borra todo lo que `DireccionInput` no declare**. Este task cierra eso.

**Files:**
- Modify: `quodom-web/api/openapi.yaml` (`DireccionInput` y `Direccion`)
- Modify: `quodom-web/api/src/controllers/user_direcciones.controller.js` (`create` y `update`)
- Test: `quodom-web/api/tests/direcciones.test.js` (agregar casos al archivo que ya existe)

**Interfaces:**
- Consumes: las columnas de Task 4.
- Produces: `POST /user_direcciones/create` y `PUT /user_direcciones/:id` aceptan `placeid`, `lat`, `lng`; `coords_actualizado` lo pone el servidor.

- [ ] **Step 1: Write the failing test**

Agregar al final del `describe('direcciones', ...)` de `tests/direcciones.test.js`:

```js
  it('guarda placeid y coordenadas, y les pone la fecha el servidor', async () => {
    const res = await request(app).post('/user_direcciones/create')
      .set('Authorization', 'Bearer ' + token)
      .send({
        alias: 'Obra', calle: 'Mitre', numero: '450', cp: 'B1642',
        localidad: 'San Isidro', idprovincia: 1,
        placeid: 'ChIJ-obra', lat: -34.4707, lng: -58.5075
      });
    expect(res.status).toBe(200);

    const dirs = await request(app).get('/users/dire/').set('Authorization', 'Bearer ' + token);
    const obra = dirs.body.find(d => d.alias === 'Obra');
    expect(obra.placeid).toBe('ChIJ-obra');
    expect(obra.lat).toBeCloseTo(-34.4707, 4);
    expect(obra.lng).toBeCloseTo(-58.5075, 4);

    // La fecha la pone el servidor: si viniera del cliente, un reloj atrasado
    // dejaría coordenadas vencidas pareciendo frescas.
    const fila = await db.user_direcciones.findByPk(obra.id);
    expect(fila.coords_actualizado).toBeInstanceOf(Date);
  });

  it('una dirección cargada a mano, sin mapa, sigue guardándose', async () => {
    const res = await request(app).post('/user_direcciones/create')
      .set('Authorization', 'Bearer ' + token)
      .send({ alias: 'Mano', calle: 'Rivadavia', numero: '100', idprovincia: 1 });
    expect(res.status).toBe(200);

    const dirs = await request(app).get('/users/dire/').set('Authorization', 'Bearer ' + token);
    const mano = dirs.body.find(d => d.alias === 'Mano');
    expect(mano.placeid == null).toBe(true);
    expect(mano.lat == null).toBe(true);
  });

  it('actualizar sólo las coordenadas refresca la fecha', async () => {
    const dirs = await request(app).get('/users/dire/').set('Authorization', 'Bearer ' + token);
    const obra = dirs.body.find(d => d.alias === 'Obra');
    const antes = (await db.user_direcciones.findByPk(obra.id)).coords_actualizado;

    await new Promise(r => setTimeout(r, 5));
    const res = await request(app).put('/user_direcciones/' + obra.id)
      .set('Authorization', 'Bearer ' + token)
      .send({ calle: 'Mitre', numero: '450', idprovincia: 1, placeid: 'ChIJ-obra2', lat: -34.5, lng: -58.5 });
    expect(res.status).toBe(200);

    const despues = (await db.user_direcciones.findByPk(obra.id)).coords_actualizado;
    expect(despues.getTime()).toBeGreaterThan(antes.getTime());
  });
```

Si `db` no está importado en ese archivo, ya lo está: la cabecera hace `const db = require('../src/helpers/db')`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd quodom-web/api && npx jest tests/direcciones.test.js`
Expected: FAIL — `obra.placeid` es `undefined`: el validador descartó los campos porque el contrato no los declara.

- [ ] **Step 3: Declare the fields in the contract**

En `openapi.yaml`, en `DireccionInput` (línea ~225):

```yaml
        idprovincia: { type: integer }
        default: { type: boolean }
        # Datos del mapa. Sin declararlos acá el validador los descarta y la
        # dirección se guarda sin coordenadas, en silencio.
        placeid: { type: string }
        lat: { type: number }
        lng: { type: number }
```

Y en `Direccion` (línea ~206), para que la respuesta valide:

```yaml
        observaciones: { type: string, nullable: true }
        placeid: { type: string, nullable: true }
        lat: { type: number, nullable: true }
        lng: { type: number, nullable: true }
        coords_actualizado: { type: string, format: date-time, nullable: true }
```

- [ ] **Step 4: Stamp the date on the server**

En `src/controllers/user_direcciones.controller.js`, en `create` y en `update`, después del bloque que resuelve el nombre de la provincia:

```js
    // La fecha de las coordenadas la pone el servidor y no el cliente: es la
    // que decide cuándo vencen los 30 días de caché que permite Google, y un
    // reloj de cliente atrasado dejaría coordenadas viejas pareciendo frescas.
    if (params.lat != null && params.lng != null) {
        params.coords_actualizado = new Date();
    }
```

> **Lo que este task deja a medias a propósito.** La mitad A **sella** la fecha
> pero no refresca nada: nada acá vuelve a resolver las coordenadas cuando
> pasan los 30 días. Es correcto y no es un hueco — las coordenadas se leen por
> primera vez en la mitad B, al buscar proveedores, y ahí es donde corresponde
> chequear `coords_actualizado` y re-resolver desde `placeid`. Refrescarlas acá
> sería gastar consultas en direcciones que quizá nadie use.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd quodom-web/api && npx jest tests/direcciones.test.js`
Expected: PASS, 10 tests (los 7 que ya estaban más los 3 nuevos)

- [ ] **Step 6: Regenerate the app types and run the whole API suite**

Run: `cd quodom-web/app && npm run api-types`
Run: `cd quodom-web/api && npm test`
Expected: suite completa verde. `api-types` deja `app/src/api/schema.d.ts` al día; el test `api-types` de la app falla si quedó viejo.

- [ ] **Step 7: Commit**

```bash
git add quodom-web/api/openapi.yaml \
        quodom-web/api/src/controllers/user_direcciones.controller.js \
        quodom-web/api/tests/direcciones.test.js \
        quodom-web/app/src/api/schema.d.ts
git commit -m "feat(api): persist place id and coordinates when saving an address"
```

---

### Task 7: El campo de autocompletado en la app

Un componente, usado por las dos pantallas de direcciones. **Los campos de abajo quedan visibles y editables**: es lo que salva los tres casos en que Google no alcanza — una dirección sin altura, la clave sin configurar, y Google caído.

**Files:**
- Create: `quodom-web/app/src/api/lugares.ts`
- Create: `quodom-web/app/src/components/CampoDireccionMapa.tsx`
- Create: `quodom-web/app/src/components/CampoDireccionMapa.css`
- Modify: `quodom-web/app/src/screens/Direcciones/AgregarDireccion.tsx`
- Modify: `quodom-web/app/src/screens/Direcciones/ModificarDireccion.tsx`
- Modify: `quodom-web/app/src/api/user_direcciones.ts` (`DireccionInput`)
- Test: `quodom-web/app/src/components/__tests__/CampoDireccionMapa.test.tsx`

**Interfaces:**
- Consumes: `GET /lugares/sugerencias` y `GET /lugares/{placeid}` de Task 5.
- Produces: `<CampoDireccionMapa onElegir={(d: DireccionDeLugar) => void} />`, donde `DireccionDeLugar` es `{ placeid, calle, numero, localidad, partido, idprovincia, cp, lat, lng, direccion }`.

- [ ] **Step 1: Write the API client**

```ts
// quodom-web/app/src/api/lugares.ts
import { apiFetch } from './client';

export type SugerenciaLugar = { placeid: string; texto: string };

export type DireccionDeLugar = {
  placeid: string;
  calle: string;
  numero: string;
  localidad: string;
  partido: string;
  idprovincia: number | null;
  cp: string;
  lat: number;
  lng: number;
  direccion: string;
};

export const lugares = {
  sugerencias: (q: string, sesion: string) =>
    apiFetch<{ sugerencias: SugerenciaLugar[] }>(
      '/lugares/sugerencias?q=' + encodeURIComponent(q) + '&sesion=' + encodeURIComponent(sesion)),
  direccion: (placeid: string, sesion: string) =>
    apiFetch<DireccionDeLugar>(
      '/lugares/' + encodeURIComponent(placeid) + '?sesion=' + encodeURIComponent(sesion))
};
```

Y en `app/src/api/user_direcciones.ts`, agregar al type `DireccionInput`:

```ts
  placeid?: string;
  lat?: number;
  lng?: number;
```

- [ ] **Step 2: Write the failing test**

```tsx
// quodom-web/app/src/components/__tests__/CampoDireccionMapa.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CampoDireccionMapa } from '../CampoDireccionMapa';
import { lugares } from '../../api/lugares';

vi.mock('../../api/lugares', () => ({
  lugares: { sugerencias: vi.fn(), direccion: vi.fn() }
}));

const MITRE = {
  placeid: 'ChIJ-1', calle: 'Bartolomé Mitre', numero: '450', localidad: 'San Isidro',
  partido: 'San Isidro', idprovincia: 1, cp: 'B1642', lat: -34.47, lng: -58.5,
  direccion: 'Mitre 450, San Isidro'
};

beforeEach(() => {
  vi.mocked(lugares.sugerencias).mockReset();
  vi.mocked(lugares.direccion).mockReset();
  vi.useRealTimers();
});

const campo = () => screen.getByLabelText(/buscá tu dirección/i);

describe('CampoDireccionMapa', () => {
  it('sugiere al tipear y entrega la dirección elegida', async () => {
    vi.mocked(lugares.sugerencias).mockResolvedValue({
      sugerencias: [{ placeid: 'ChIJ-1', texto: 'Mitre 450, San Isidro' }]
    });
    vi.mocked(lugares.direccion).mockResolvedValue(MITRE);
    const onElegir = vi.fn();

    render(<CampoDireccionMapa onElegir={onElegir} />);
    fireEvent.change(campo(), { target: { value: 'mitre 450' } });

    fireEvent.click(await screen.findByRole('option', { name: /Mitre 450, San Isidro/ }));

    await waitFor(() => expect(onElegir).toHaveBeenCalledWith(MITRE));
  });

  // Review Focus 2, del lado del cliente: el debounce es lo que evita una
  // consulta paga por tecla.
  it('no consulta con menos de 3 caracteres', async () => {
    render(<CampoDireccionMapa onElegir={vi.fn()} />);

    fireEvent.change(campo(), { target: { value: 'mi' } });

    await new Promise(r => setTimeout(r, 450));
    expect(lugares.sugerencias).not.toHaveBeenCalled();
  });

  it('agrupa las teclas en una sola consulta', async () => {
    vi.mocked(lugares.sugerencias).mockResolvedValue({ sugerencias: [] });

    render(<CampoDireccionMapa onElegir={vi.fn()} />);
    fireEvent.change(campo(), { target: { value: 'mit' } });
    fireEvent.change(campo(), { target: { value: 'mitre' } });
    fireEvent.change(campo(), { target: { value: 'mitre 4' } });

    await waitFor(() => expect(lugares.sugerencias).toHaveBeenCalledTimes(1));
    expect(lugares.sugerencias).toHaveBeenCalledWith('mitre 4', expect.any(String));
  });

  // Review Focus 3 y 4: si el buscador no anda, el usuario tiene que poder
  // seguir. El aviso lo dice y no bloquea nada.
  it('si el buscador falla lo avisa sin romper el formulario', async () => {
    vi.mocked(lugares.sugerencias).mockRejectedValue(new Error('503'));

    render(<CampoDireccionMapa onElegir={vi.fn()} />);
    fireEvent.change(campo(), { target: { value: 'mitre 450' } });

    expect(await screen.findByText(/no pudimos buscar/i)).toBeInTheDocument();
    expect(campo()).toHaveValue('mitre 450');
  });

  it('usa el mismo token de sesión para toda la tanda de tecleo', async () => {
    vi.mocked(lugares.sugerencias).mockResolvedValue({ sugerencias: [] });

    render(<CampoDireccionMapa onElegir={vi.fn()} />);
    fireEvent.change(campo(), { target: { value: 'mitre' } });
    await waitFor(() => expect(lugares.sugerencias).toHaveBeenCalledTimes(1));
    fireEvent.change(campo(), { target: { value: 'mitre 450' } });
    await waitFor(() => expect(lugares.sugerencias).toHaveBeenCalledTimes(2));

    const [, s1] = vi.mocked(lugares.sugerencias).mock.calls[0];
    const [, s2] = vi.mocked(lugares.sugerencias).mock.calls[1];
    expect(s1).toBe(s2);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd quodom-web/app && npx vitest run src/components/__tests__/CampoDireccionMapa.test.tsx`
Expected: FAIL — no se puede importar `../CampoDireccionMapa`

- [ ] **Step 4: Write the component**

```tsx
// quodom-web/app/src/components/CampoDireccionMapa.tsx
import { useEffect, useRef, useState } from 'react';
import { lugares, type DireccionDeLugar, type SugerenciaLugar } from '../api/lugares';
import './CampoDireccionMapa.css';

const MINIMO = 3;
const ESPERA_MS = 350;

/**
 * Busca la dirección en el mapa y la entrega desarmada.
 *
 * Dos reglas que son de costo y no de estética: no consulta con menos de 3
 * caracteres, y agrupa el tecleo en una sola consulta cada 350ms. Cada
 * consulta se le paga a Google; sin esto, escribir una dirección son veinte.
 *
 * El `sesion` es un token que agrupa la tanda de sugerencias con el detalle
 * final para que Google no las cobre aparte. Se renueva recién cuando el
 * usuario elige una dirección, porque ahí termina la tanda.
 */
export function CampoDireccionMapa({ onElegir }: { onElegir: (d: DireccionDeLugar) => void }) {
  const [texto, setTexto] = useState('');
  const [opciones, setOpciones] = useState<SugerenciaLugar[]>([]);
  const [error, setError] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const sesion = useRef(nuevaSesion());

  useEffect(() => {
    const q = texto.trim();
    if (q.length < MINIMO) { setOpciones([]); setError(false); return; }

    let vivo = true;
    const timer = setTimeout(() => {
      setBuscando(true);
      lugares.sugerencias(q, sesion.current)
        .then(r => { if (vivo) { setOpciones(r.sugerencias); setError(false); } })
        .catch(() => { if (vivo) { setOpciones([]); setError(true); } })
        .finally(() => { if (vivo) setBuscando(false); });
    }, ESPERA_MS);

    return () => { vivo = false; clearTimeout(timer); };
  }, [texto]);

  async function elegir(s: SugerenciaLugar) {
    try {
      const d = await lugares.direccion(s.placeid, sesion.current);
      // La tanda terminó: la próxima búsqueda empieza una sesión nueva.
      sesion.current = nuevaSesion();
      setOpciones([]);
      setTexto(s.texto);
      onElegir(d);
    } catch {
      setError(true);
    }
  }

  return (
    <div className="cdm">
      <label className="field">
        <span>Buscá tu dirección</span>
        <input
          className="input"
          value={texto}
          autoComplete="off"
          placeholder="Calle y altura, o el nombre del lugar"
          onChange={e => setTexto(e.target.value)}
        />
      </label>

      {buscando && <p className="cdm-estado">Buscando…</p>}

      {error && (
        <p className="cdm-estado cdm-error" role="status">
          No pudimos buscar en el mapa. Completá los campos de abajo a mano.
        </p>
      )}

      {opciones.length > 0 && (
        <ul className="cdm-lista" role="listbox">
          {opciones.map(s => (
            <li key={s.placeid}>
              <button type="button" role="option" aria-selected="false"
                className="cdm-opcion" onClick={() => elegir(s)}>
                {s.texto}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function nuevaSesion() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return String(Date.now()) + '-' + Math.random().toString(36).slice(2);
}
```

```css
/* quodom-web/app/src/components/CampoDireccionMapa.css */
.cdm { position: relative; display: flex; flex-direction: column; gap: var(--sp-2); }

.cdm-estado { margin: 0; font-size: var(--fs-small); color: #6E6E6E; }
.cdm-error { color: #8A5A00; }

.cdm-lista {
  list-style: none;
  margin: 0;
  padding: 0;
  background: #fff;
  border: 1px solid #E2E2E2;
  border-top-left-radius: var(--radius-hoja-tl);
  border-bottom-right-radius: var(--radius-hoja-br);
  overflow: hidden;
}

.cdm-opcion {
  display: block;
  width: 100%;
  padding: var(--sp-3);
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--fs-small);
  text-align: left;
  cursor: pointer;
  /* Objetivo táctil cómodo: esto se usa con el pulgar. */
  min-height: 44px;
}
.cdm-opcion:hover, .cdm-opcion:focus-visible { background: #F1F1F1; }

.cdm-lista li + li .cdm-opcion { border-top: 1px solid #F1F1F1; }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd quodom-web/app && npx vitest run src/components/__tests__/CampoDireccionMapa.test.tsx`
Expected: PASS, 5 tests

- [ ] **Step 6: Wire it into both address screens**

En `AgregarDireccion.tsx`, importar el componente y montarlo **arriba de los campos que ya existen**, dentro del `<form>`:

```tsx
import { CampoDireccionMapa } from '../../components/CampoDireccionMapa';
import type { DireccionDeLugar } from '../../api/lugares';
```

```tsx
        <CampoDireccionMapa onElegir={aplicarDelMapa} />
```

Y la función que copia lo del mapa a los campos del formulario:

```tsx
  // Los campos quedan editables después de aplicarlos. Google no siempre trae
  // la altura (una esquina, un lugar con nombre) y el piso nunca lo trae, así
  // que el formulario sigue siendo el que manda: el mapa lo rellena, no lo
  // reemplaza.
  function aplicarDelMapa(d: DireccionDeLugar) {
    setF(prev => ({
      ...prev,
      calle: d.calle,
      numero: d.numero,
      localidad: d.localidad,
      cp: d.cp,
      direccion: d.direccion,
      idprovincia: d.idprovincia ?? undefined,
      placeid: d.placeid,
      lat: d.lat,
      lng: d.lng
    }));
  }
```

Hacer lo mismo en `ModificarDireccion.tsx`, respetando que ahí el estado puede ser `null` mientras carga (`setF(prev => prev ? { ...prev, ... } : prev)`).

**Dejar los campos de calle, número, localidad y provincia tal como están**: visibles, requeridos y editables. Son el camino cuando el mapa no alcanza — y el único cuando no hay clave de Google.

- [ ] **Step 7: Run the whole app suite and the typecheck**

Run: `cd quodom-web/app && npm test -- --run`
Run: `cd quodom-web/app && npm run build`
Expected: todas las suites verdes y el build sin errores de tipos.

- [ ] **Step 8: Commit**

```bash
git add quodom-web/app/src/api/lugares.ts \
        quodom-web/app/src/api/user_direcciones.ts \
        quodom-web/app/src/components/CampoDireccionMapa.tsx \
        quodom-web/app/src/components/CampoDireccionMapa.css \
        quodom-web/app/src/components/__tests__/CampoDireccionMapa.test.tsx \
        quodom-web/app/src/screens/Direcciones/AgregarDireccion.tsx \
        quodom-web/app/src/screens/Direcciones/ModificarDireccion.tsx
git commit -m "feat(app): pick an address from the map and keep the fields editable"
```

---

### Task 8: El chequeo manual, el deploy y la documentación

Lo que ningún test puede decidir: si las direcciones reales se geocodifican bien. Es la verificación que la spec pone como condición para empezar la mitad B.

**Files:**
- Create: `quodom-web/api/scripts/verificar-direcciones.js`
- Modify: `quodom-web/render.yaml` (la variable con `sync: false`)
- Modify: `quodom-web/api/.env.example` (si existe; si no, crearlo con sólo los nombres)
- Modify: `claude.md` (§3 y §8)
- Modify: `quodom-web/app/CLAUDE.md`

**Interfaces:**
- Consumes: `places.js` y `direccionDeGoogle.js`.
- Produces: nada que consuma otro task. Cierra la mitad A.

- [ ] **Step 1: Write the manual verification script**

No es un test y no corre con la suite: usa la clave de verdad y **gasta**.

```js
// quodom-web/api/scripts/verificar-direcciones.js
/**
 * Chequeo MANUAL de la geocodificación. No es un test y no corre con la suite.
 *
 * Usa la clave de verdad y cuesta unas consultas por corrida. Existe porque
 * ningún test puede decir si una dirección real cae en el punto correcto: el
 * test no sabe dónde queda Mitre 450. Y ese es el riesgo central de la mitad A
 * — si el punto está mal, el selector de proveedores no falla, miente.
 *
 *   cd quodom-web/api && node scripts/verificar-direcciones.js
 *
 * Mirar, por cada caso: que la primera sugerencia sea la obvia, que la
 * provincia resuelva al id correcto, y que lat/lng caigan donde deben
 * (pegar las coordenadas en Google Maps y confirmar a ojo).
 */
require('dotenv').config();
const { sugerencias, detalleDireccion } = require('../src/helpers/places');
const { direccionDeGoogle } = require('../src/helpers/direccionDeGoogle');

const CASOS = [
  'Avenida Corrientes 1234, CABA',
  'Bartolomé Mitre 450, San Isidro',
  'San Martín 1000, Rosario, Santa Fe',
  '25 de Mayo 100, Tandil',
  'Avenida San Martín 500, Ushuaia'
];

async function main() {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.error('Falta GOOGLE_MAPS_API_KEY en el entorno.');
    process.exit(1);
  }

  for (const caso of CASOS) {
    console.log('\n=== ' + caso + ' ===');
    const sesion = 'verif-' + Date.now();
    try {
      const opciones = await sugerencias({ q: caso, sesion });
      if (opciones.length === 0) { console.log('  SIN SUGERENCIAS'); continue; }

      opciones.slice(0, 3).forEach((o, i) => console.log('  ' + (i + 1) + '. ' + o.texto));

      const d = direccionDeGoogle(await detalleDireccion({ placeid: opciones[0].placeid, sesion }));
      console.log('  -> calle: ' + d.calle + ' ' + d.numero);
      console.log('  -> localidad: ' + d.localidad + (d.partido ? ' (partido: ' + d.partido + ')' : ''));
      console.log('  -> idprovincia: ' + d.idprovincia + (d.idprovincia === null ? '  <-- REVISAR' : ''));
      console.log('  -> cp: ' + (d.cp || '(vacío)'));
      console.log('  -> punto: ' + d.lat + ', ' + d.lng);
      console.log('  -> mapa: https://www.google.com/maps?q=' + d.lat + ',' + d.lng);
    } catch (e) {
      console.log('  ERROR ' + (e.codigo || '') + ': ' + e.message);
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Declare the key in render.yaml, without its value**

En `quodom-web/render.yaml`, en las `envVars` del web service, al lado de `GEMINI_API_KEY`:

```yaml
      - key: GOOGLE_MAPS_API_KEY
        sync: false
```

`sync: false` es lo que hace que el valor **no viva en el repo** y se cargue a mano en el dashboard de Render. Mismo trato que la clave de Gemini. **No commitear el valor en ningún archivo.**

- [ ] **Step 3: Document the three traps in claude.md**

En `claude.md`, en §3, después del bullet del perfil, agregar:

```markdown
- **La dirección nace en el mapa** (2026-10-14): el formulario busca con el autocompletado de Google y los campos se llenan solos, pero **quedan editables y siguen siendo los que manda**: Google no siempre trae la altura (una esquina) y nunca trae el piso, y sin `GOOGLE_MAPS_API_KEY` el buscador no anda y la carga a mano es el único camino. Se guardan `placeid`, `lat`, `lng` y `coords_actualizado`. **El autocompletado llena los campos de texto, no los reemplaza**: el mensaje de WhatsApp lee la dirección de la vista `v_InfoCompradors`, no de las coordenadas, y el renglón se omite en silencio cuando falta. La provincia se traduce con la tabla literal de 24 renglones de `config/provinciasGoogle.js`, no con un emparejamiento aproximado. Spec: `docs/superpowers/specs/2026-10-14-direccion-en-mapa-y-proveedores-design.md`.
```

Y en §8, al final, una sección nueva:

```markdown
## 9. Google Places: lo que se puede guardar, y lo que cuesta

`api/src/helpers/places.js` es el único archivo que habla con Google, igual que `gemini.js` con Gemini. Tres reglas que no son preferencias:

- **Las llamadas salen del servidor, nunca del navegador.** La clave se cobra por uso y en el bundle se lee.
- **De Places sólo se puede archivar el identificador del lugar** (sin límite) y **las coordenadas** (30 días). Nombre, puntuación y teléfono **no se guardan**: se piden cada vez que se muestran. Por eso la dirección guarda `placeid` y las coordenadas se tratan como caché con `coords_actualizado`.
- **El precio lo fija el campo más caro de la máscara.** Pedir `rating` o un teléfono sube el precio de TODA la consulta. La máscara de direcciones (`CAMPOS_DIRECCION`) tiene sólo campos del nivel básico a propósito: agregarle uno caro multiplica la factura de un endpoint que se llama mientras el usuario tipea.

Y el corte de 3 caracteres con el debounce de 350ms del campo de direcciones es **control de gasto**, no estética: sin eso, escribir una dirección son veinte consultas pagas.

La calidad de la geocodificación **no la puede verificar un test**: `node scripts/verificar-direcciones.js` corre cinco direcciones reales con la clave de verdad e imprime a qué punto caen. Correrlo después de tocar `direccionDeGoogle.js` o `provinciasGoogle.js`.
```

- [ ] **Step 4: Document the component in the app doc**

En `quodom-web/app/CLAUDE.md`, en la sección de componentes:

```markdown
- **`CampoDireccionMapa`** — busca la dirección en el mapa y la entrega desarmada. El corte en 3 caracteres y el debounce de 350ms son control de gasto (cada consulta se le paga a Google), y el token de `sesion` agrupa la tanda con el detalle final para que Google no la cobre aparte: se renueva recién cuando el usuario elige. **Rellena los campos del formulario, no los reemplaza** — quedan editables porque Google no siempre trae la altura y nunca el piso, y sin clave configurada la carga a mano es el único camino.
```

- [ ] **Step 5: Run everything**

Run: `cd quodom-web/api && npm test`
Run: `cd quodom-web/app && npm test -- --run`
Run: `cd quodom-web/app && npm run build`
Expected: todo verde, build sin errores.

- [ ] **Step 6: Commit**

```bash
git add quodom-web/api/scripts/verificar-direcciones.js \
        quodom-web/render.yaml \
        claude.md \
        quodom-web/app/CLAUDE.md
git commit -m "docs: document the Places rules and add the geocoding check script"
```

- [ ] **Step 7: The manual gate before half B**

Esto lo hace una persona, con la clave cargada, y **es la condición que la spec pone para empezar la mitad B**:

1. `cd quodom-web/api && node scripts/verificar-direcciones.js` — revisar los cinco casos: que la primera sugerencia sea la obvia, que `idprovincia` nunca sea `null` en un caso argentino, y que las coordenadas caigan donde deben (abrir el link de mapa que imprime).
2. En la app, cargar **tu dirección real** desde el formulario y confirmar que los campos se llenan bien y que se guarda.
3. Si algo cae mal, el arreglo va en `direccionDeGoogle.js` o `provinciasGoogle.js` — las dos son puras y tienen tests, así que el caso que falló se agrega como test antes de corregirlo.

No empezar la mitad B hasta que esto esté mirado: un punto mal geocodificado no se ve como error más adelante, se ve como una lista de proveedores perfectamente ordenada alrededor del lugar equivocado.
