# Quodom Web — Plan 3 (Modo IA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Modo IA" — an authenticated chat that uses Gemini to build a Quodom (`type: "question"` for follow-ups, `type: "proposal"` when ready) from a conversation, using only real catalog products.

**Architecture:** New backend endpoint `POST /api/ia/chat` (JWT-protected) does 2-step Gemini calls per user turn: intent detection to filter subcategories, then main chat with the filtered catalog. New frontend screen `/modo-ia` with an ephemeral chat UI. Rate limit + daily counter in DB.

**Tech Stack:** Backend: Express, Sequelize 6 (SQLite), Jest + Supertest. Frontend: React 18 + Vite + TypeScript + Vitest + Testing Library. External: `gemini-2.5-flash` via HTTPS `fetch` (no SDK).

**Spec:** `docs/superpowers/specs/2026-07-15-quodom-modo-ia-design.md`

**Working directory:** All backend paths are relative to `quodom-web/api/`, all frontend paths to `quodom-web/app/` unless noted otherwise. Commands must be run from those directories.

---

## Task 1: Backend — env vars + Gemini HTTP helper

**Files:**
- Modify: `quodom-web/api/.env.example`
- Create: `quodom-web/api/src/helpers/gemini.js`
- Create: `quodom-web/api/tests/gemini.helper.test.js`

- [ ] **Step 1: Add env vars to `.env.example`**

Append to `quodom-web/api/.env.example`:

```
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
IA_MAX_DAILY_MESSAGES=50
IA_MAX_TURNS=20
IA_MAX_USER_MESSAGE_LENGTH=500
IA_RATE_LIMIT_PER_MINUTE=10
```

- [ ] **Step 2: Write the failing test for `helpers/gemini.js`**

Create `quodom-web/api/tests/gemini.helper.test.js`:

```javascript
const { callGemini } = require('../src/helpers/gemini');

describe('gemini helper', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('POSTs to the model URL with the API key and returns parsed JSON', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"ok":true,"n":42}' }] } }]
      })
    });

    const out = await callGemini({
      model: 'gemini-2.5-flash',
      systemPrompt: 'sys',
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
      responseSchema: { type: 'object', properties: { ok: { type: 'boolean' } } }
    });

    expect(out).toEqual({ ok: true, n: 42 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).toContain('gemini-2.5-flash');
    expect(url).toContain('key=test-key');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.systemInstruction.parts[0].text).toBe('sys');
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'hi' }] }]);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema).toBeDefined();
  });

  it('retries once on transient 5xx failure and then succeeds', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'boom' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] })
      });

    const out = await callGemini({ model: 'gemini-2.5-flash', systemPrompt: 's', contents: [], responseSchema: {} });

    expect(out).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws after retry when both attempts fail', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'nope' });

    await expect(callGemini({ model: 'gemini-2.5-flash', systemPrompt: 's', contents: [], responseSchema: {} }))
      .rejects.toThrow(/gemini/i);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws when returned JSON cannot be parsed', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] })
    });

    await expect(callGemini({ model: 'gemini-2.5-flash', systemPrompt: 's', contents: [], responseSchema: {} }))
      .rejects.toThrow(/parse/i);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run from `quodom-web/api/`:

```
npm test -- tests/gemini.helper.test.js
```

Expected: FAIL — "Cannot find module '../src/helpers/gemini'".

- [ ] **Step 4: Implement `helpers/gemini.js`**

Create `quodom-web/api/src/helpers/gemini.js`:

```javascript
const TIMEOUT_MS = 15000;

async function callGemini({ model, systemPrompt, contents, responseSchema }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('gemini: GEMINI_API_KEY not set');
  }

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
    + encodeURIComponent(model) + ':generateContent?key=' + process.env.GEMINI_API_KEY;

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema
    }
  };

  const doFetch = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error('gemini: HTTP ' + res.status + ' ' + text.slice(0, 200));
      }
      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== 'string') throw new Error('gemini: no text in response');
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error('gemini: could not parse JSON response: ' + text.slice(0, 200));
      }
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await doFetch();
  } catch (e) {
    if (String(e.message).startsWith('gemini: HTTP 5') || e.name === 'AbortError') {
      return await doFetch();
    }
    throw e;
  }
}

module.exports = { callGemini };
```

- [ ] **Step 5: Run the test to verify it passes**

Run from `quodom-web/api/`:

```
npm test -- tests/gemini.helper.test.js
```

Expected: PASS — 4 tests.

- [ ] **Step 6: Commit**

```bash
git add quodom-web/api/.env.example quodom-web/api/src/helpers/gemini.js quodom-web/api/tests/gemini.helper.test.js
git commit -m "feat(ia): add Gemini HTTP helper with retry, timeout, JSON schema"
```

---

## Task 2: Backend — `ia_usage` model + rate limit middleware

**Files:**
- Create: `quodom-web/api/src/models/ia_usage.model.js`
- Modify: `quodom-web/api/src/helpers/db.js` (register the new model)
- Create: `quodom-web/api/src/middleware/rateLimit.js`
- Create: `quodom-web/api/tests/rateLimit.middleware.test.js`

- [ ] **Step 1: Write the failing test for `middleware/rateLimit.js`**

Create `quodom-web/api/tests/rateLimit.middleware.test.js`:

```javascript
const rateLimit = require('../src/middleware/rateLimit');

function fakeReqRes(userId) {
  return {
    req: { user: { id: userId } },
    res: {
      _status: 200, _body: null,
      status(s) { this._status = s; return this; },
      json(b) { this._body = b; return this; }
    },
    nextCalled: false,
    next() { this.nextCalled = true; }
  };
}

describe('rateLimit middleware', () => {
  beforeEach(() => { rateLimit._reset(); });

  it('allows requests under the limit', () => {
    const mw = rateLimit.perUserPerMinute(3);
    const ctx = fakeReqRes(1);
    for (let i = 0; i < 3; i++) {
      const c = fakeReqRes(1);
      mw(c.req, c.res, () => { c.nextCalled = true; });
      expect(c.nextCalled).toBe(true);
    }
  });

  it('blocks the request that exceeds the limit within the window', () => {
    const mw = rateLimit.perUserPerMinute(2);
    for (let i = 0; i < 2; i++) {
      const c = fakeReqRes(1);
      mw(c.req, c.res, () => { c.nextCalled = true; });
      expect(c.nextCalled).toBe(true);
    }
    const c3 = fakeReqRes(1);
    mw(c3.req, c3.res, () => { c3.nextCalled = true; });
    expect(c3.nextCalled).toBe(false);
    expect(c3.res._status).toBe(429);
    expect(c3.res._body.error).toBe('rate_limit');
  });

  it('tracks users independently', () => {
    const mw = rateLimit.perUserPerMinute(1);
    const a = fakeReqRes(1);
    mw(a.req, a.res, () => { a.nextCalled = true; });
    const b = fakeReqRes(2);
    mw(b.req, b.res, () => { b.nextCalled = true; });
    expect(a.nextCalled).toBe(true);
    expect(b.nextCalled).toBe(true);
  });

  it('forgets timestamps older than the window', () => {
    const originalNow = Date.now;
    Date.now = jest.fn(() => 1_000_000);
    const mw = rateLimit.perUserPerMinute(1);
    const c1 = fakeReqRes(1);
    mw(c1.req, c1.res, () => { c1.nextCalled = true; });
    expect(c1.nextCalled).toBe(true);

    Date.now = jest.fn(() => 1_000_000 + 61_000);
    const c2 = fakeReqRes(1);
    mw(c2.req, c2.res, () => { c2.nextCalled = true; });
    expect(c2.nextCalled).toBe(true);

    Date.now = originalNow;
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `quodom-web/api/`:

```
npm test -- tests/rateLimit.middleware.test.js
```

Expected: FAIL — "Cannot find module '../src/middleware/rateLimit'".

- [ ] **Step 3: Implement `middleware/rateLimit.js`**

Create `quodom-web/api/src/middleware/rateLimit.js`:

```javascript
const WINDOW_MS = 60_000;
const buckets = new Map();

function perUserPerMinute(limit) {
  return function rateLimitMiddleware(req, res, next) {
    const userId = req.user && req.user.id;
    if (!userId) return next();

    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    const arr = (buckets.get(userId) || []).filter(t => t > cutoff);

    if (arr.length >= limit) {
      return res.status(429).json({
        res: false,
        error: 'rate_limit',
        message: 'Muchos mensajes muy rápido. Esperá un momento y probá de nuevo.'
      });
    }

    arr.push(now);
    buckets.set(userId, arr);
    return next();
  };
}

function _reset() {
  buckets.clear();
}

module.exports = { perUserPerMinute, _reset };
```

- [ ] **Step 4: Write the failing test for `ia_usage` model**

Create `quodom-web/api/tests/ia_usage.model.test.js`:

```javascript
const db = require('../src/helpers/db');

describe('ia_usage model', () => {
  beforeAll(async () => { await db.ready; });

  it('is registered on db and creates rows', async () => {
    expect(db.ia_usage).toBeDefined();
    const row = await db.ia_usage.create({ iduser: 1, fecha: '2026-07-15', contador: 1 });
    expect(row.contador).toBe(1);
  });

  it('enforces unique (iduser, fecha)', async () => {
    await db.ia_usage.create({ iduser: 2, fecha: '2026-07-15', contador: 1 });
    await expect(db.ia_usage.create({ iduser: 2, fecha: '2026-07-15', contador: 1 }))
      .rejects.toThrow();
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run from `quodom-web/api/`:

```
npm test -- tests/ia_usage.model.test.js
```

Expected: FAIL — `db.ia_usage` is undefined.

- [ ] **Step 6: Implement the `ia_usage` model**

Create `quodom-web/api/src/models/ia_usage.model.js`:

```javascript
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('ia_usage', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  iduser: { type: DataTypes.INTEGER, allowNull: false },
  fecha: { type: DataTypes.DATEONLY, allowNull: false },
  contador: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  tableName: 'ia_usage',
  indexes: [
    { unique: true, fields: ['iduser', 'fecha'] }
  ]
});
```

- [ ] **Step 7: Register the model in `helpers/db.js`**

In `quodom-web/api/src/helpers/db.js`, inside `initialize()` after the line that assigns `db.series = ...`, add:

```javascript
    db.ia_usage = require('../models/ia_usage.model')(sequelize);
```

And add `db.ia_usage` to the `tableModels` array (the one iterated for `model.sync()`).

- [ ] **Step 8: Run both new test files to verify they pass**

Run from `quodom-web/api/`:

```
npm test -- tests/rateLimit.middleware.test.js tests/ia_usage.model.test.js
```

Expected: PASS — both files green.

- [ ] **Step 9: Run the full backend test suite to verify no regressions**

Run from `quodom-web/api/`:

```
npm test
```

Expected: all previously passing tests still green.

- [ ] **Step 10: Commit**

```bash
git add quodom-web/api/src/models/ia_usage.model.js quodom-web/api/src/helpers/db.js quodom-web/api/src/middleware/rateLimit.js quodom-web/api/tests/rateLimit.middleware.test.js quodom-web/api/tests/ia_usage.model.test.js
git commit -m "feat(ia): add ia_usage model and per-user rate limit middleware"
```

---

## Task 3: Backend — IA controller (intent detection + chat orchestration)

**Files:**
- Create: `quodom-web/api/src/controllers/ia.controller.js`
- Create: `quodom-web/api/tests/ia.controller.test.js`

- [ ] **Step 1: Write the failing test for the controller (intent path)**

Create `quodom-web/api/tests/ia.controller.test.js`:

```javascript
jest.mock('../src/helpers/gemini');
const { callGemini } = require('../src/helpers/gemini');
const db = require('../src/helpers/db');
const ia = require('../src/controllers/ia.controller');

beforeAll(async () => {
  await db.ready;
  await db.Category.bulkCreate([
    { id: 10, nombrecategoria: 'Pinturería', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 11, nombrecategoria: 'Pinturas', idcategoriapadre: 10, activa: true, orden: 1 },
    { id: 12, nombrecategoria: 'Rodillos', idcategoriapadre: 10, activa: true, orden: 2 }
  ], { ignoreDuplicates: true });
  await db.Products.bulkCreate([
    { id: 200, nombreproducto: 'Látex interior 4L', categoria: 11, categoriaPadre: 10, atributo1: 'Color', atributo2: null },
    { id: 201, nombreproducto: 'Rodillo lana 22cm', categoria: 12, categoriaPadre: 10, atributo1: null, atributo2: null }
  ], { ignoreDuplicates: true });
});

beforeEach(() => { callGemini.mockReset(); });

describe('ia.chat', () => {
  it('returns { type: "question" } when Gemini responds with a question', async () => {
    callGemini
      .mockResolvedValueOnce({ idsSubcategoria: [11] })
      .mockResolvedValueOnce({ type: 'question', text: '¿de qué color?' });

    const out = await ia.chat(1, [{ role: 'user', text: 'quiero pintar' }]);

    expect(out).toEqual({ type: 'question', text: '¿de qué color?' });
    expect(callGemini).toHaveBeenCalledTimes(2);
  });

  it('returns { type: "proposal" } and filters items with unknown idproducto', async () => {
    callGemini
      .mockResolvedValueOnce({ idsSubcategoria: [11, 12] })
      .mockResolvedValueOnce({
        type: 'proposal',
        text: 'Te propongo:',
        items: [
          { idproducto: 200, cantidad: 4, motivo: 'cubre 12m²' },
          { idproducto: 999, cantidad: 1, motivo: 'ghost' },
          { idproducto: 201, cantidad: 1, motivo: 'aplicación' }
        ]
      });

    const out = await ia.chat(1, [{ role: 'user', text: 'quiero pintar 3 paredes' }]);

    expect(out.type).toBe('proposal');
    expect(out.items).toHaveLength(2);
    const ids = out.items.map(i => i.idproducto).sort();
    expect(ids).toEqual([200, 201]);
    // Enriched with nombreProducto from the DB (frontend needs it):
    expect(out.items[0].nombreProducto).toBeDefined();
  });

  it('returns question when 0 subcategorías detected (skips main call)', async () => {
    callGemini.mockResolvedValueOnce({ idsSubcategoria: [] });

    const out = await ia.chat(1, [{ role: 'user', text: 'blablabla' }]);

    expect(out.type).toBe('question');
    expect(out.text).toMatch(/rubro/i);
    expect(callGemini).toHaveBeenCalledTimes(1);
  });

  it('returns question when proposal has 0 valid items after filtering', async () => {
    callGemini
      .mockResolvedValueOnce({ idsSubcategoria: [11] })
      .mockResolvedValueOnce({
        type: 'proposal',
        text: 'Te propongo:',
        items: [{ idproducto: 8888, cantidad: 1, motivo: 'x' }]
      });

    const out = await ia.chat(1, [{ role: 'user', text: 'test' }]);

    expect(out.type).toBe('question');
    expect(out.text).toMatch(/no encontré/i);
  });

  it('propagates errors from gemini as-is (caller decides HTTP status)', async () => {
    callGemini.mockRejectedValueOnce(new Error('gemini: HTTP 500 boom'));

    await expect(ia.chat(1, [{ role: 'user', text: 'test' }])).rejects.toThrow(/gemini/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `quodom-web/api/`:

```
npm test -- tests/ia.controller.test.js
```

Expected: FAIL — "Cannot find module '../src/controllers/ia.controller'".

- [ ] **Step 3: Implement the controller**

Create `quodom-web/api/src/controllers/ia.controller.js`:

```javascript
const db = require('../helpers/db');
const { callGemini } = require('../helpers/gemini');

const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    idsSubcategoria: { type: 'array', items: { type: 'integer' } }
  },
  required: ['idsSubcategoria']
};

const CHAT_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['question', 'proposal'] },
    text: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          idproducto: { type: 'integer' },
          cantidad: { type: 'integer' },
          motivo: { type: 'string' }
        },
        required: ['idproducto', 'cantidad']
      }
    }
  },
  required: ['type', 'text']
};

async function chat(userId, messages) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const subcats = await db.Category.findAll({
    where: { idcategoriapadre: { [db.Sequelize.Op.gt]: 0 }, activa: true },
    attributes: ['id', 'nombrecategoria', 'idcategoriapadre']
  });
  const rubros = await db.Category.findAll({
    where: { idcategoriapadre: 0, activa: true },
    attributes: ['id', 'nombrecategoria']
  });
  const rubroById = new Map(rubros.map(r => [r.id, r.nombrecategoria]));
  const subcatList = subcats.map(s => ({
    id: s.id,
    nombre: s.nombrecategoria,
    rubro: rubroById.get(s.idcategoriapadre) || ''
  }));

  const lastUser = messages[messages.length - 1];

  const intent = await callGemini({
    model,
    systemPrompt:
      'Sos un clasificador. Recibís el mensaje de un usuario que quiere armar un presupuesto de compra ' +
      'y una lista de subcategorías con su rubro padre. Devolvé un JSON con los IDs de subcategorías ' +
      'relevantes al mensaje. Si ninguna aplica, devolvé un array vacío. ' +
      'Subcategorías disponibles: ' + JSON.stringify(subcatList),
    contents: [{ role: 'user', parts: [{ text: lastUser.text }] }],
    responseSchema: INTENT_SCHEMA
  });

  const ids = Array.isArray(intent.idsSubcategoria) ? intent.idsSubcategoria : [];
  if (ids.length === 0) {
    return { type: 'question', text: '¿De qué rubro es tu proyecto? Contame un poco más para poder ayudarte.' };
  }

  const productos = await db.Products.findAll({
    where: { categoria: { [db.Sequelize.Op.in]: ids } },
    attributes: ['id', 'nombreproducto', 'atributo1', 'atributo2', 'categoria']
  });

  if (productos.length === 0) {
    return { type: 'question', text: '¿De qué rubro es tu proyecto? Contame un poco más para poder ayudarte.' };
  }

  const productoIndex = new Map(productos.map(p => [p.id, p]));
  const productList = productos.map(p => ({
    idproducto: p.id,
    nombre: p.nombreproducto,
    atributo1: p.atributo1 || null,
    atributo2: p.atributo2 || null
  }));

  const geminiContents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text }]
  }));

  const reply = await callGemini({
    model,
    systemPrompt:
      'Sos el asistente de Quodom. Ayudás al usuario a armar un presupuesto de compra. Respondés SIEMPRE en español y en JSON. ' +
      'Si te falta información, devolvé { "type":"question", "text":"..." } con UNA sola repregunta clara. ' +
      'Cuando tengas suficiente información, devolvé { "type":"proposal", "text":"...", "items":[{"idproducto":<id>,"cantidad":<n>,"motivo":"<por qué>"}] }. ' +
      'REGLA CRÍTICA: los idproducto deben ser exclusivamente de esta lista. No inventes IDs ni nombres. ' +
      'Productos disponibles: ' + JSON.stringify(productList),
    contents: geminiContents,
    responseSchema: CHAT_SCHEMA
  });

  if (reply.type === 'proposal') {
    const rawItems = Array.isArray(reply.items) ? reply.items : [];
    const filtered = [];
    for (const it of rawItems) {
      const p = productoIndex.get(it.idproducto);
      if (!p) continue;
      filtered.push({
        idproducto: p.id,
        cantidad: Math.max(1, Number(it.cantidad) || 1),
        motivo: typeof it.motivo === 'string' ? it.motivo : '',
        nombreProducto: p.nombreproducto
      });
    }
    if (filtered.length === 0) {
      return {
        type: 'question',
        text: 'No encontré productos del catálogo para eso. ¿Podés contarme más de qué tipo de proyecto es?'
      };
    }
    return { type: 'proposal', text: reply.text, items: filtered };
  }

  return { type: 'question', text: reply.text };
}

async function incrementDaily(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const [row, created] = await db.ia_usage.findOrCreate({
    where: { iduser: userId, fecha: today },
    defaults: { iduser: userId, fecha: today, contador: 1 }
  });
  if (!created) {
    row.contador += 1;
    await row.save();
  }
  return row.contador;
}

async function getDailyCount(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const row = await db.ia_usage.findOne({ where: { iduser: userId, fecha: today } });
  return row ? row.contador : 0;
}

module.exports = { chat, incrementDaily, getDailyCount };
```

- [ ] **Step 4: Run the test to verify it passes**

Run from `quodom-web/api/`:

```
npm test -- tests/ia.controller.test.js
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add quodom-web/api/src/controllers/ia.controller.js quodom-web/api/tests/ia.controller.test.js
git commit -m "feat(ia): add IA controller with intent detection and product filtering"
```

---

## Task 4: Backend — `POST /api/ia/chat` route + endpoint integration test

**Files:**
- Create: `quodom-web/api/src/routes/ia.route.js`
- Modify: `quodom-web/api/src/server.js` (register route)
- Create: `quodom-web/api/tests/ia.endpoint.test.js`

- [ ] **Step 1: Write the failing endpoint test**

Create `quodom-web/api/tests/ia.endpoint.test.js`:

```javascript
jest.mock('../src/helpers/gemini');
const request = require('supertest');
const { callGemini } = require('../src/helpers/gemini');
const app = require('../src/server');
const db = require('../src/helpers/db');
const rateLimit = require('../src/middleware/rateLimit');

let token;

beforeAll(async () => {
  await db.ready;
  await db.Category.bulkCreate([
    { id: 20, nombrecategoria: 'Rubro X', idcategoriapadre: 0, activa: true, orden: 1 },
    { id: 21, nombrecategoria: 'Sub X', idcategoriapadre: 20, activa: true, orden: 1 }
  ], { ignoreDuplicates: true });
  await db.Products.bulkCreate([
    { id: 500, nombreproducto: 'P500', categoria: 21, categoriaPadre: 20 }
  ], { ignoreDuplicates: true });
  await db.series.findOrCreate({ where: { codigo: 'QUODOM' }, defaults: { codigo: 'QUODOM', utilizado: 0, sigla: 'QD-' } });

  const user = { username: 'ia', email: 'ia@test.com', nombre: 'IA', password: 'secreto123', codArea: '11', telefono: '55554444' };
  await request(app).post('/users/signup').send(user);
  const login = await request(app).post('/users/signin').send({ username: 'ia', password: 'secreto123' });
  token = login.body.token;
});

beforeEach(() => {
  callGemini.mockReset();
  rateLimit._reset();
});

describe('POST /api/ia/chat', () => {
  it('rejects without a JWT with 401', async () => {
    const res = await request(app).post('/api/ia/chat').send({ messages: [{ role: 'user', text: 'hi' }] });
    expect(res.status).toBe(401);
  });

  it('returns 200 with type=question', async () => {
    callGemini
      .mockResolvedValueOnce({ idsSubcategoria: [21] })
      .mockResolvedValueOnce({ type: 'question', text: '¿cuántos?' });

    const res = await request(app).post('/api/ia/chat')
      .set('Authorization', 'Bearer ' + token)
      .send({ messages: [{ role: 'user', text: 'hola' }] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ type: 'question', text: '¿cuántos?' });
  });

  it('returns 200 with type=proposal (filtered items)', async () => {
    callGemini
      .mockResolvedValueOnce({ idsSubcategoria: [21] })
      .mockResolvedValueOnce({
        type: 'proposal', text: 'Te propongo:',
        items: [{ idproducto: 500, cantidad: 2, motivo: 'ok' }, { idproducto: 9999, cantidad: 1, motivo: 'ghost' }]
      });

    const res = await request(app).post('/api/ia/chat')
      .set('Authorization', 'Bearer ' + token)
      .send({ messages: [{ role: 'user', text: 'quiero 2' }] });

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('proposal');
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ idproducto: 500, cantidad: 2, nombreProducto: 'P500' });
  });

  it('rejects last user message > IA_MAX_USER_MESSAGE_LENGTH with 400', async () => {
    const long = 'x'.repeat(1000);
    const res = await request(app).post('/api/ia/chat')
      .set('Authorization', 'Bearer ' + token)
      .send({ messages: [{ role: 'user', text: long }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('too_long');
  });

  it('rejects when messages.length > IA_MAX_TURNS*2', async () => {
    const many = [];
    for (let i = 0; i < 50; i++) many.push({ role: i % 2 === 0 ? 'user' : 'assistant', text: 'x' });
    const res = await request(app).post('/api/ia/chat')
      .set('Authorization', 'Bearer ' + token)
      .send({ messages: many });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('too_many_turns');
  });

  it('rejects when last message is not from user', async () => {
    const res = await request(app).post('/api/ia/chat')
      .set('Authorization', 'Bearer ' + token)
      .send({ messages: [{ role: 'user', text: 'a' }, { role: 'assistant', text: 'b' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('no_last_user_message');
  });

  it('returns 429 rate_limit after 11 requests in a minute', async () => {
    // Set env for the test explicitly (setup-env sets defaults, but be explicit here).
    process.env.IA_RATE_LIMIT_PER_MINUTE = '10';
    callGemini.mockResolvedValue({ idsSubcategoria: [21] });
    // 10 pass...
    for (let i = 0; i < 10; i++) {
      callGemini.mockResolvedValueOnce({ idsSubcategoria: [21] }).mockResolvedValueOnce({ type: 'question', text: 'q' });
      const r = await request(app).post('/api/ia/chat')
        .set('Authorization', 'Bearer ' + token)
        .send({ messages: [{ role: 'user', text: 'x' }] });
      expect(r.status).toBe(200);
    }
    // 11th blocked
    const r11 = await request(app).post('/api/ia/chat')
      .set('Authorization', 'Bearer ' + token)
      .send({ messages: [{ role: 'user', text: 'x' }] });
    expect(r11.status).toBe(429);
    expect(r11.body.error).toBe('rate_limit');
  });

  it('returns 429 limit_exceeded when daily counter is at the max', async () => {
    process.env.IA_MAX_DAILY_MESSAGES = '2';
    process.env.IA_RATE_LIMIT_PER_MINUTE = '999';
    rateLimit._reset();
    // Seed the counter to the max for today for this user
    const userId = (await db.User.findOne({ where: { username: 'ia' } })).id;
    const today = new Date().toISOString().slice(0, 10);
    await db.ia_usage.destroy({ where: { iduser: userId, fecha: today } });
    await db.ia_usage.create({ iduser: userId, fecha: today, contador: 2 });

    const res = await request(app).post('/api/ia/chat')
      .set('Authorization', 'Bearer ' + token)
      .send({ messages: [{ role: 'user', text: 'x' }] });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('limit_exceeded');
  });

  it('returns 500 ia_unavailable when gemini throws and does NOT increment counter', async () => {
    process.env.IA_MAX_DAILY_MESSAGES = '999';
    process.env.IA_RATE_LIMIT_PER_MINUTE = '999';
    rateLimit._reset();
    callGemini.mockRejectedValueOnce(new Error('gemini: HTTP 500 boom'));

    const userId = (await db.User.findOne({ where: { username: 'ia' } })).id;
    const today = new Date().toISOString().slice(0, 10);
    await db.ia_usage.destroy({ where: { iduser: userId, fecha: today } });

    const res = await request(app).post('/api/ia/chat')
      .set('Authorization', 'Bearer ' + token)
      .send({ messages: [{ role: 'user', text: 'x' }] });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('ia_unavailable');

    const row = await db.ia_usage.findOne({ where: { iduser: userId, fecha: today } });
    expect(row).toBeNull();
  });

  it('increments the daily counter on a successful 200', async () => {
    process.env.IA_MAX_DAILY_MESSAGES = '999';
    process.env.IA_RATE_LIMIT_PER_MINUTE = '999';
    rateLimit._reset();
    callGemini
      .mockResolvedValueOnce({ idsSubcategoria: [21] })
      .mockResolvedValueOnce({ type: 'question', text: '¿?' });

    const userId = (await db.User.findOne({ where: { username: 'ia' } })).id;
    const today = new Date().toISOString().slice(0, 10);
    await db.ia_usage.destroy({ where: { iduser: userId, fecha: today } });

    const res = await request(app).post('/api/ia/chat')
      .set('Authorization', 'Bearer ' + token)
      .send({ messages: [{ role: 'user', text: 'x' }] });
    expect(res.status).toBe(200);

    const row = await db.ia_usage.findOne({ where: { iduser: userId, fecha: today } });
    expect(row.contador).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `quodom-web/api/`:

```
npm test -- tests/ia.endpoint.test.js
```

Expected: FAIL — every test returns 404 or 401 because the route does not exist yet.

- [ ] **Step 3: Implement the route**

Create `quodom-web/api/src/routes/ia.route.js`:

```javascript
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const Controler = require('../controllers/ia.controller');

const MAX_TURNS = () => parseInt(process.env.IA_MAX_TURNS || '20', 10);
const MAX_USER_MSG = () => parseInt(process.env.IA_MAX_USER_MESSAGE_LENGTH || '500', 10);
const MAX_DAILY = () => parseInt(process.env.IA_MAX_DAILY_MESSAGES || '50', 10);
const MAX_RPM = () => parseInt(process.env.IA_RATE_LIMIT_PER_MINUTE || '10', 10);

router.post(
  '/chat',
  auth.verifyToken(),
  (req, res, next) => rateLimit.perUserPerMinute(MAX_RPM())(req, res, next),
  chat
);

module.exports = router;

async function chat(req, res, next) {
  try {
    const messages = Array.isArray(req.body && req.body.messages) ? req.body.messages : null;
    if (!messages || messages.length === 0) {
      return res.status(400).json({ res: false, error: 'no_last_user_message', message: 'Falta el mensaje del usuario.' });
    }
    if (messages.length > MAX_TURNS() * 2) {
      return res.status(400).json({ res: false, error: 'too_many_turns', message: 'Esta conversación llegó al máximo de turnos. Empezá una nueva.' });
    }
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'user' || typeof last.text !== 'string') {
      return res.status(400).json({ res: false, error: 'no_last_user_message', message: 'El último mensaje debe ser del usuario.' });
    }
    if (last.text.length > MAX_USER_MSG()) {
      return res.status(400).json({ res: false, error: 'too_long', message: 'Tu mensaje es muy largo (máx ' + MAX_USER_MSG() + ' caracteres).' });
    }

    const currentCount = await Controler.getDailyCount(req.user.id);
    if (currentCount >= MAX_DAILY()) {
      return res.status(429).json({ res: false, error: 'limit_exceeded', message: 'Alcanzaste el límite diario (' + MAX_DAILY() + ' mensajes). Volvé mañana o usá el buscador.' });
    }

    let reply;
    try {
      reply = await Controler.chat(req.user.id, messages);
    } catch (e) {
      return res.status(500).json({ res: false, error: 'ia_unavailable', message: 'El asistente no está disponible por ahora. Probá de nuevo en un momento.' });
    }

    await Controler.incrementDaily(req.user.id);
    return res.json(reply);
  } catch (e) {
    next(e);
  }
}
```

- [ ] **Step 4: Register the route in `server.js`**

Open `quodom-web/api/src/server.js`. Find where existing routes are mounted (search for lines like `app.use('/quodom', require('./routes/quodom.route'));`). Immediately after the block of `app.use` route registrations, add:

```javascript
app.use('/api/ia', require('./routes/ia.route'));
```

- [ ] **Step 5: Ensure `tests/setup-env.js` sets default IA env vars**

Open `quodom-web/api/tests/setup-env.js` and ensure these lines are present (add any that are missing):

```javascript
process.env.IA_MAX_DAILY_MESSAGES = process.env.IA_MAX_DAILY_MESSAGES || '999';
process.env.IA_MAX_TURNS = process.env.IA_MAX_TURNS || '20';
process.env.IA_MAX_USER_MESSAGE_LENGTH = process.env.IA_MAX_USER_MESSAGE_LENGTH || '500';
process.env.IA_RATE_LIMIT_PER_MINUTE = process.env.IA_RATE_LIMIT_PER_MINUTE || '999';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';
process.env.GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
```

- [ ] **Step 6: Run the endpoint test to verify it passes**

Run from `quodom-web/api/`:

```
npm test -- tests/ia.endpoint.test.js
```

Expected: PASS — all 10 tests green.

- [ ] **Step 7: Run the full backend test suite**

Run from `quodom-web/api/`:

```
npm test
```

Expected: all tests (existing + new) pass.

- [ ] **Step 8: Commit**

```bash
git add quodom-web/api/src/routes/ia.route.js quodom-web/api/src/server.js quodom-web/api/tests/ia.endpoint.test.js quodom-web/api/tests/setup-env.js
git commit -m "feat(ia): add POST /api/ia/chat endpoint with validation, rate limit and daily counter"
```

---

## Task 5: Frontend — API client + types + "Modo IA" button on home

**Files:**
- Create: `quodom-web/app/src/api/ia.ts`
- Modify: `quodom-web/app/src/screens/Home/SitioInicial.tsx`
- Modify: `quodom-web/app/src/screens/Home/SitioInicial.css`

- [ ] **Step 1: Create the API client**

Create `quodom-web/app/src/api/ia.ts`:

```typescript
import { apiFetch } from './client';

export type IaMessage = { role: 'user' | 'assistant'; text: string };

export type IaProposalItem = {
  idproducto: number;
  cantidad: number;
  motivo: string;
  nombreProducto: string;
};

export type IaResponse =
  | { type: 'question'; text: string }
  | { type: 'proposal'; text: string; items: IaProposalItem[] };

export const iaApi = {
  chat: (messages: IaMessage[]) =>
    apiFetch<IaResponse>('/api/ia/chat', { method: 'POST', body: { messages } })
};
```

- [ ] **Step 2: Add the "Modo IA" button to the home**

In `quodom-web/app/src/screens/Home/SitioInicial.tsx`, import `useAuth` and add the button. Below is the FULL file after the change (replace the entire file content):

```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { categorias } from '../../api/categorias';
import type { Category } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { RubroIcon } from '../../components/icons/RubroIcon';
import { MasBuscados } from './MasBuscados';
import { useAuth } from '../../auth/AuthContext';
import './SitioInicial.css';

export function SitioInicial() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cats, setCats] = useState<Category[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    setCats(null); setErr(null);
    categorias.raiz()
      .then(d => { if (alive) setCats(d); })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error al cargar categorías.'); });
    return () => { alive = false; };
  }, [nonce]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term.length < 2) return;
    navigate('/busqueda?q=' + encodeURIComponent(term));
  }

  function goModoIA() {
    if (!user) {
      navigate('/login', { state: { from: '/modo-ia' } });
      return;
    }
    navigate('/modo-ia');
  }

  if (err) return <div className="container"><ErrorState message={err} onRetry={() => setNonce(n => n + 1)} /></div>;

  return (
    <section className="container home-inicial">
      <h1 className="home-wordmark">QUODOM</h1>
      <button type="button" className="btn home-modo-ia" onClick={goModoIA}>
        <span aria-hidden="true">🤖</span>
        <span>Modo IA — armá tu Quodom conversando</span>
      </button>
      <form className="home-search" onSubmit={onSearch}>
        <span className="home-search-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        </span>
        <input className="input home-search-input" type="search" placeholder="¿Qué necesitás?" value={q} onChange={e => setQ(e.target.value)} />
      </form>
      {!cats ? <Loader /> : (
        <div className="cat-grid">
          {cats.map(c => (
            <Link key={c.id} to={'/categoria/' + c.id} className="cat-card">
              <RubroIcon id={c.id} size={72} />
              <span className="cat-card-name">{c.nombrecategoria}</span>
            </Link>
          ))}
        </div>
      )}
      <MasBuscados />
    </section>
  );
}
```

- [ ] **Step 3: Add matching CSS**

Open `quodom-web/app/src/screens/Home/SitioInicial.css` and append at the end:

```css
.home-modo-ia {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  max-width: 480px;
  margin: 0 auto var(--sp-3) auto;
  background: var(--color-acento);
  color: #fff;
  font-family: var(--font-prompt);
  font-weight: 600;
  padding: 12px 16px;
}
.home-modo-ia:hover { filter: brightness(1.05); }
```

- [ ] **Step 4: Verify typecheck passes**

Run from `quodom-web/app/`:

```
npm run typecheck
```

Expected: no TS errors.

- [ ] **Step 5: Commit**

```bash
git add quodom-web/app/src/api/ia.ts quodom-web/app/src/screens/Home/SitioInicial.tsx quodom-web/app/src/screens/Home/SitioInicial.css
git commit -m "feat(ia): add iaApi client and 'Modo IA' button on home with login redirect"
```

---

## Task 6: Frontend — `ModoIA` screen (chat base without proposal rendering)

**Files:**
- Create: `quodom-web/app/src/screens/ModoIA/ModoIA.tsx`
- Create: `quodom-web/app/src/screens/ModoIA/ModoIA.css`
- Create: `quodom-web/app/src/screens/ModoIA/MensajeChat.tsx`
- Modify: `quodom-web/app/src/router/routes.tsx` (register `/modo-ia`)
- Create: `quodom-web/app/src/screens/ModoIA/__tests__/ModoIA.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `quodom-web/app/src/screens/ModoIA/__tests__/ModoIA.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModoIA } from '../ModoIA';
import { iaApi } from '../../../api/ia';

vi.mock('../../../api/ia', () => ({
  iaApi: { chat: vi.fn() }
}));

function renderWith() {
  return render(<MemoryRouter><ModoIA /></MemoryRouter>);
}

describe('ModoIA (base chat)', () => {
  beforeEach(() => { (iaApi.chat as unknown as ReturnType<typeof vi.fn>).mockReset(); });

  it('renders the hardcoded welcome message on mount', () => {
    renderWith();
    expect(screen.getByText(/contame tu proyecto/i)).toBeInTheDocument();
  });

  it('disables the send button when input is empty or busy', () => {
    renderWith();
    const send = screen.getByRole('button', { name: /enviar/i });
    expect(send).toBeDisabled();

    const input = screen.getByPlaceholderText(/escrib/i);
    fireEvent.change(input, { target: { value: 'hola' } });
    expect(send).toBeEnabled();
  });

  it('sends the message and renders the assistant reply', async () => {
    (iaApi.chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ type: 'question', text: '¿de qué color?' });
    renderWith();

    const input = screen.getByPlaceholderText(/escrib/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'quiero pintar' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(screen.getByText('¿de qué color?')).toBeInTheDocument());
    expect(screen.getByText('quiero pintar')).toBeInTheDocument();
    expect(iaApi.chat).toHaveBeenCalledWith([{ role: 'user', text: 'quiero pintar' }]);
  });

  it('renders backend errors as an assistant bubble', async () => {
    const err = new Error('Alcanzaste el límite diario.');
    (iaApi.chat as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(err);
    renderWith();

    const input = screen.getByPlaceholderText(/escrib/i);
    fireEvent.change(input, { target: { value: 'hola' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(screen.getByText(/alcanzaste el límite/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `quodom-web/app/`:

```
npm test -- src/screens/ModoIA/__tests__/ModoIA.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `MensajeChat.tsx`**

Create `quodom-web/app/src/screens/ModoIA/MensajeChat.tsx`:

```tsx
export type MensajeRole = 'user' | 'assistant';

export function MensajeChat({ role, text }: { role: MensajeRole; text: string }) {
  return (
    <article className={'mia-msg mia-msg-' + role}>
      <p>{text}</p>
    </article>
  );
}
```

- [ ] **Step 4: Implement `ModoIA.tsx`**

Create `quodom-web/app/src/screens/ModoIA/ModoIA.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { AppBarBack } from '../../components/layout/AppBarBack';
import { iaApi, type IaMessage, type IaResponse } from '../../api/ia';
import { ApiError } from '../../api/client';
import { MensajeChat } from './MensajeChat';
import './ModoIA.css';

const WELCOME = 'Hola. Contame tu proyecto y armo el presupuesto.';

type UiMessage = { role: 'user' | 'assistant'; text: string };

export function ModoIA() {
  const [messages, setMessages] = useState<UiMessage[]>([{ role: 'assistant', text: WELCOME }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [_lastProposal, setLastProposal] = useState<IaResponse | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  function resetChat() {
    if (!confirm('¿Empezar una nueva conversación?')) return;
    setMessages([{ role: 'assistant', text: WELCOME }]);
    setInput('');
    setLastProposal(null);
  }

  async function send() {
    const text = input.trim();
    if (busy || text.length < 2) return;

    const next: UiMessage[] = [...messages, { role: 'user', text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const history: IaMessage[] = next
        .filter(m => !(m === next[0] && m.text === WELCOME))
        .map(m => ({ role: m.role, text: m.text }));
      const reply = await iaApi.chat(history);
      if (reply.type === 'proposal') {
        setLastProposal(reply);
        setMessages(m => [...m, { role: 'assistant', text: reply.text }]);
      } else {
        setMessages(m => [...m, { role: 'assistant', text: reply.text }]);
      }
    } catch (e) {
      const msg = e instanceof ApiError || e instanceof Error ? e.message : 'Hubo un problema. Probá de nuevo.';
      setMessages(m => [...m, { role: 'assistant', text: msg }]);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <>
      <AppBarBack title="Modo IA" rightSlot={
        <button type="button" className="mia-reset" aria-label="Nueva conversación" onClick={resetChat}>↺</button>
      } />
      <section className="container mia">
        <div className="mia-messages">
          {messages.map((m, i) => (<MensajeChat key={i} role={m.role} text={m.text} />))}
          {busy && <p className="mia-typing">Pensando…</p>}
          <div ref={bottomRef} />
        </div>
        <div className="mia-inputbar">
          <input
            className="input mia-input"
            placeholder="Escribí acá…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={500}
            disabled={busy}
          />
          <button
            className="btn btn-exito mia-send"
            onClick={send}
            disabled={busy || input.trim().length < 2}
          >
            {busy ? '…' : 'Enviar'}
          </button>
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 5: Add `rightSlot` prop to `AppBarBack`**

The current `AppBarBack` (in `quodom-web/app/src/components/layout/AppBarBack.tsx`) does not accept a right-side slot. Replace the FULL file with:

```tsx
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import './AppBarBack.css';

export function AppBarBack({ title, rightSlot }: { title: string; rightSlot?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="appbar-back">
      <button className="appbar-back-btn" aria-label="Volver" onClick={() => navigate(-1)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <h2 className="appbar-back-title">{title}</h2>
      {rightSlot ? <div className="appbar-back-right">{rightSlot}</div> : null}
    </header>
  );
}
```

Append to `quodom-web/app/src/components/layout/AppBarBack.css`:

```css
.appbar-back-right { margin-left: auto; display: flex; align-items: center; }
```

- [ ] **Step 6: Implement `ModoIA.css`**

Create `quodom-web/app/src/screens/ModoIA/ModoIA.css`:

```css
.mia {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 56px);
  padding: 12px 16px 0 16px;
}
.mia-messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding-bottom: var(--sp-3);
}
.mia-msg {
  max-width: 82%;
  padding: 10px 12px;
  border-top-left-radius: 8px;
  border-bottom-right-radius: 8px;
  background: var(--color-tarjeta);
  color: var(--color-texto);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}
.mia-msg p { margin: 0; white-space: pre-wrap; }
.mia-msg-user {
  align-self: flex-end;
  background: var(--color-acento);
  color: #fff;
}
.mia-msg-assistant { align-self: flex-start; }
.mia-typing { align-self: flex-start; color: var(--color-texto); opacity: 0.7; font-style: italic; }

.mia-inputbar {
  display: flex;
  gap: 8px;
  padding: 8px 0 12px 0;
  position: sticky;
  bottom: 0;
  background: var(--color-fondo);
}
.mia-input { flex: 1; }
.mia-send { flex: 0 0 auto; }

.mia-reset {
  background: none;
  border: none;
  color: inherit;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
}
```

- [ ] **Step 7: Register the route**

In `quodom-web/app/src/router/routes.tsx`, add an import at the top:

```tsx
import { ModoIA } from '../screens/ModoIA/ModoIA';
```

And add this line inside the `Layout` children array (place it between the `/busqueda` route and the `/quodom` route):

```tsx
{ path: '/modo-ia', element: <ProtectedRoute><ModoIA /></ProtectedRoute> },
```

- [ ] **Step 8: Run the test to verify it passes**

Run from `quodom-web/app/`:

```
npm test -- src/screens/ModoIA/__tests__/ModoIA.test.tsx
```

Expected: PASS — 4 tests.

- [ ] **Step 9: Verify typecheck and full frontend test suite**

Run from `quodom-web/app/`:

```
npm run typecheck && npm test
```

Expected: no TS errors; all tests pass.

- [ ] **Step 10: Commit**

```bash
git add quodom-web/app/src/screens/ModoIA/ quodom-web/app/src/router/routes.tsx quodom-web/app/src/components/layout/
git commit -m "feat(ia): add /modo-ia screen with chat, welcome message and reset"
```

---

## Task 7: Frontend — `PropuestaEditable` + "Agregar al Quodom" flow

**Files:**
- Create: `quodom-web/app/src/screens/ModoIA/PropuestaEditable.tsx`
- Modify: `quodom-web/app/src/screens/ModoIA/ModoIA.tsx` (integrate)
- Modify: `quodom-web/app/src/screens/ModoIA/ModoIA.css` (add proposal styles)
- Create: `quodom-web/app/src/screens/ModoIA/__tests__/PropuestaEditable.test.tsx`

- [ ] **Step 1: Write the failing test for `PropuestaEditable`**

Create `quodom-web/app/src/screens/ModoIA/__tests__/PropuestaEditable.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropuestaEditable } from '../PropuestaEditable';
import type { IaProposalItem } from '../../../api/ia';

const items: IaProposalItem[] = [
  { idproducto: 1, cantidad: 2, motivo: 'a', nombreProducto: 'Prod A' },
  { idproducto: 2, cantidad: 1, motivo: 'b', nombreProducto: 'Prod B' }
];

describe('PropuestaEditable', () => {
  it('renders all items and their quantities', () => {
    render(<PropuestaEditable items={items} onConfirm={() => {}} />);
    expect(screen.getByText('Prod A')).toBeInTheDocument();
    expect(screen.getByText('Prod B')).toBeInTheDocument();
    expect(screen.getByLabelText(/cantidad de prod a/i)).toHaveValue(2);
  });

  it('increments and decrements quantity (min 1)', () => {
    render(<PropuestaEditable items={items} onConfirm={() => {}} />);
    const dec = screen.getByLabelText(/quitar uno de prod a/i);
    const inc = screen.getByLabelText(/sumar uno a prod a/i);
    fireEvent.click(inc); fireEvent.click(inc);
    expect(screen.getByLabelText(/cantidad de prod a/i)).toHaveValue(4);
    fireEvent.click(dec); fireEvent.click(dec); fireEvent.click(dec); fireEvent.click(dec);
    expect(screen.getByLabelText(/cantidad de prod a/i)).toHaveValue(1);
  });

  it('removes an item with the × button', () => {
    render(<PropuestaEditable items={items} onConfirm={() => {}} />);
    fireEvent.click(screen.getByLabelText(/quitar prod b/i));
    expect(screen.queryByText('Prod B')).not.toBeInTheDocument();
  });

  it('disables the confirm button when there are no items', () => {
    render(<PropuestaEditable items={[items[0]]} onConfirm={() => {}} />);
    fireEvent.click(screen.getByLabelText(/quitar prod a/i));
    expect(screen.getByRole('button', { name: /agregar al quodom/i })).toBeDisabled();
  });

  it('calls onConfirm with the current item list', () => {
    const spy = vi.fn();
    render(<PropuestaEditable items={items} onConfirm={spy} />);
    fireEvent.click(screen.getByLabelText(/sumar uno a prod a/i));
    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));
    expect(spy).toHaveBeenCalledWith([
      { idproducto: 1, cantidad: 3, motivo: 'a', nombreProducto: 'Prod A' },
      { idproducto: 2, cantidad: 1, motivo: 'b', nombreProducto: 'Prod B' }
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `quodom-web/app/`:

```
npm test -- src/screens/ModoIA/__tests__/PropuestaEditable.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `PropuestaEditable.tsx`**

Create `quodom-web/app/src/screens/ModoIA/PropuestaEditable.tsx`:

```tsx
import { useState } from 'react';
import type { IaProposalItem } from '../../api/ia';

export function PropuestaEditable({
  items: initial,
  onConfirm,
  busy = false
}: {
  items: IaProposalItem[];
  onConfirm: (items: IaProposalItem[]) => void;
  busy?: boolean;
}) {
  const [items, setItems] = useState<IaProposalItem[]>(initial);

  function setCantidad(idx: number, cantidad: number) {
    setItems(items.map((it, i) => i === idx ? { ...it, cantidad: Math.max(1, cantidad) } : it));
  }
  function remove(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  return (
    <article className="mia-proposal">
      <ul className="mia-proposal-list">
        {items.map((it, idx) => (
          <li key={it.idproducto} className="mia-proposal-item">
            <div className="mia-proposal-name">
              <strong>{it.nombreProducto}</strong>
              {it.motivo ? <span className="mia-proposal-motivo">{it.motivo}</span> : null}
            </div>
            <div className="mia-proposal-qty">
              <button type="button" aria-label={'Quitar uno de ' + it.nombreProducto} onClick={() => setCantidad(idx, it.cantidad - 1)}>−</button>
              <input
                type="number"
                min={1}
                aria-label={'Cantidad de ' + it.nombreProducto}
                value={it.cantidad}
                onChange={e => setCantidad(idx, Number(e.target.value) || 1)}
              />
              <button type="button" aria-label={'Sumar uno a ' + it.nombreProducto} onClick={() => setCantidad(idx, it.cantidad + 1)}>+</button>
              <button type="button" aria-label={'Quitar ' + it.nombreProducto} className="mia-proposal-remove" onClick={() => remove(idx)}>×</button>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn-exito"
        disabled={busy || items.length === 0}
        onClick={() => onConfirm(items)}
      >
        {busy ? 'Agregando…' : 'Agregar al Quodom'}
      </button>
    </article>
  );
}
```

- [ ] **Step 4: Add proposal styles**

Append to `quodom-web/app/src/screens/ModoIA/ModoIA.css`:

```css
.mia-proposal {
  align-self: stretch;
  background: var(--color-tarjeta);
  padding: 12px;
  border-top-left-radius: 8px;
  border-bottom-right-radius: 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mia-proposal-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.mia-proposal-item { display: flex; justify-content: space-between; gap: 8px; padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.06); }
.mia-proposal-item:last-child { border-bottom: none; }
.mia-proposal-name { display: flex; flex-direction: column; gap: 2px; }
.mia-proposal-motivo { font-size: 12px; color: rgba(0,0,0,0.6); }
.mia-proposal-qty { display: flex; align-items: center; gap: 4px; }
.mia-proposal-qty button { width: 28px; height: 28px; }
.mia-proposal-qty input { width: 48px; text-align: center; }
.mia-proposal-remove { color: #b00; }
```

- [ ] **Step 5: Integrate `PropuestaEditable` into `ModoIA.tsx`**

Modify `quodom-web/app/src/screens/ModoIA/ModoIA.tsx`. Below is the FULL file after the changes (replace the entire content):

```tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBarBack } from '../../components/layout/AppBarBack';
import { iaApi, type IaMessage, type IaProposalItem } from '../../api/ia';
import { quodom as quodomApi } from '../../api/quodom';
import { quodomLines } from '../../api/quodom_lines';
import { ApiError } from '../../api/client';
import { MensajeChat } from './MensajeChat';
import { PropuestaEditable } from './PropuestaEditable';
import './ModoIA.css';

const WELCOME = 'Hola. Contame tu proyecto y armo el presupuesto.';

type UiMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; proposal?: IaProposalItem[] };

export function ModoIA() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<UiMessage[]>([{ role: 'assistant', text: WELCOME }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  function resetChat() {
    if (!confirm('¿Empezar una nueva conversación?')) return;
    setMessages([{ role: 'assistant', text: WELCOME }]);
    setInput('');
  }

  async function send() {
    const text = input.trim();
    if (busy || text.length < 2) return;

    const next: UiMessage[] = [...messages, { role: 'user', text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const history: IaMessage[] = next
        .filter(m => !(m === next[0] && m.text === WELCOME))
        .map(m => ({ role: m.role, text: m.text }));
      const reply = await iaApi.chat(history);
      if (reply.type === 'proposal') {
        setMessages(m => [...m, { role: 'assistant', text: reply.text, proposal: reply.items }]);
      } else {
        setMessages(m => [...m, { role: 'assistant', text: reply.text }]);
      }
    } catch (e) {
      const msg = e instanceof ApiError || e instanceof Error ? e.message : 'Hubo un problema. Probá de nuevo.';
      setMessages(m => [...m, { role: 'assistant', text: msg }]);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  async function confirmProposal(items: IaProposalItem[]) {
    setConfirming(true);
    try {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const descripcion = 'Presupuesto IA — ' + now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
        + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
      const created = await quodomApi.create({ descripcion });
      for (const it of items) {
        await quodomLines.add({
          idquodom: created.idquodom,
          idproducto: it.idproducto,
          cantidad: it.cantidad,
          nombreProducto: it.nombreProducto
        });
      }
      navigate('/quodom?id=' + encodeURIComponent(created.idquodom));
    } catch (e) {
      const msg = e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo crear el Quodom.';
      setMessages(m => [...m, { role: 'assistant', text: msg }]);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <>
      <AppBarBack title="Modo IA" rightSlot={
        <button type="button" className="mia-reset" aria-label="Nueva conversación" onClick={resetChat}>↺</button>
      } />
      <section className="container mia">
        <div className="mia-messages">
          {messages.map((m, i) => (
            <div key={i}>
              <MensajeChat role={m.role} text={m.text} />
              {'proposal' in m && m.proposal && (
                <PropuestaEditable items={m.proposal} onConfirm={confirmProposal} busy={confirming} />
              )}
            </div>
          ))}
          {busy && <p className="mia-typing">Pensando…</p>}
          <div ref={bottomRef} />
        </div>
        <div className="mia-inputbar">
          <input
            className="input mia-input"
            placeholder="Escribí acá…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={500}
            disabled={busy || confirming}
          />
          <button
            className="btn btn-exito mia-send"
            onClick={send}
            disabled={busy || confirming || input.trim().length < 2}
          >
            {busy ? '…' : 'Enviar'}
          </button>
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 6: Confirm `quodomLines.add` signature is unchanged**

Read `quodom-web/app/src/api/quodom_lines.ts`. Confirm the `add` method's signature still matches `{ idquodom: string; idproducto: number; cantidad: number; nombreProducto: string; atributo1?: string; atributo2?: string }`. If it has changed, adapt the loop in Step 5's `confirmProposal` accordingly (the intent is: one POST per line, with `nombreProducto` provided).

- [ ] **Step 7: Run both frontend test files to verify they pass**

Run from `quodom-web/app/`:

```
npm test -- src/screens/ModoIA/__tests__/
```

Expected: PASS — 4 tests in `ModoIA.test.tsx` + 5 tests in `PropuestaEditable.test.tsx`.

- [ ] **Step 8: Run typecheck and full frontend test suite**

Run from `quodom-web/app/`:

```
npm run typecheck && npm test
```

Expected: no TS errors; all tests pass.

- [ ] **Step 9: Commit**

```bash
git add quodom-web/app/src/screens/ModoIA/PropuestaEditable.tsx quodom-web/app/src/screens/ModoIA/__tests__/PropuestaEditable.test.tsx quodom-web/app/src/screens/ModoIA/ModoIA.tsx quodom-web/app/src/screens/ModoIA/ModoIA.css
git commit -m "feat(ia): add editable proposal component and 'Agregar al Quodom' flow"
```

---

## Task 8: Manual verification + polish + merge to master

**Files:**
- No new files. Only manual verification and small fixes if issues surface.

- [ ] **Step 1: Confirm the Gemini key is present in `quodom-web/api/.env`**

Verify (from `quodom-web/api/`):

```
node -e "require('dotenv').config(); console.log('KEY_SET=' + !!process.env.GEMINI_API_KEY, 'MODEL=' + process.env.GEMINI_MODEL)"
```

Expected: `KEY_SET=true MODEL=gemini-2.5-flash` (or the model you set).

- [ ] **Step 2: Start the backend and the frontend in two terminals**

Terminal 1, from `quodom-web/api/`:

```
npm run dev
```

Expected: `Server listening on port 3999`.

Terminal 2, from `quodom-web/app/`:

```
npm run dev
```

Expected: Vite dev server on `http://localhost:5173`.

- [ ] **Step 3: Manual test — happy path**

Open `http://localhost:5173`, sign in with an existing account. On the home, click "Modo IA". You should land on `/modo-ia` and see the welcome message.

Type: `quiero pintar 3 paredes de 4 por 3 metros`. Press Enter.

Expected: Assistant either asks a clarifying question, OR shows a proposal card with editable items. Repeat until you get a proposal.

- [ ] **Step 4: Manual test — confirm proposal creates a Quodom**

With a proposal on screen, adjust quantities, then click "Agregar al Quodom".

Expected: You are navigated to `/quodom?id=<new-id>`. The detail page shows the proposed lines with correct quantities.

- [ ] **Step 5: Manual test — guest redirect**

Log out. From the home, click "Modo IA".

Expected: You are redirected to `/login` with `state.from === '/modo-ia'`. After logging back in, you land on `/modo-ia`.

- [ ] **Step 6: Manual test — daily limit**

Edit `quodom-web/api/.env`: set `IA_MAX_DAILY_MESSAGES=2`. Restart the backend. From `/modo-ia`, send 3 short messages.

Expected: The third message returns a friendly assistant bubble saying you reached the daily limit.

Reset `.env` to `IA_MAX_DAILY_MESSAGES=50` (or your production value) when done.

- [ ] **Step 7: Manual test — refresh does NOT persist**

Send a message, get a reply, then refresh the page (F5).

Expected: The chat resets to the welcome message. This is the intended behavior (ephemeral by design).

- [ ] **Step 8: Run the full test suites one more time**

From `quodom-web/api/`:

```
npm test
```

From `quodom-web/app/`:

```
npm run typecheck && npm test
```

Expected: all green in both.

- [ ] **Step 9: Commit any polish fixes discovered during manual verification**

If you fixed anything during manual testing, commit those changes now with a message that describes the fix. Skip this step if nothing needed fixing.

- [ ] **Step 10: Update `MEMORY.md` if any user-facing behavior deserves a memory**

Only if a non-obvious decision surfaced during the manual verification (e.g., "Modo IA counter increments even on empty-subcategoría paths" is a subtle rule worth remembering). Otherwise skip.

- [ ] **Step 11: Present merge options to the user**

Do NOT merge without the user's explicit go-ahead. Ask:

> Plan 3 complete on `master` (or on the feature branch, whichever was chosen). All backend + frontend tests pass and manual verification is clean. Merge/tag/next step?

Wait for user's decision before proceeding.

---

## Notes for the implementer

- **Backend uses Jest**, not Vitest. Frontend uses Vitest. Do not mix.
- **Controllers throw strings** in this codebase (see `quodom.controller.js`). The IA controller intentionally throws real `Error` objects because the route wraps them in a try/catch and converts to `ia_unavailable` — that's the pattern the endpoint expects.
- **Never `git add -A` or `git add .`.** The working tree has unrelated dirty files (`quodom-new/`, `APP/`, `.superpowers/`, etc.). Every commit lists exact paths.
- **`.env` is gitignored.** Only `.env.example` is committed.
- **UI text in Spanish, code/commits in English.** Follow the codebase convention.
- **Do not touch `F:\backup\Command Soluciones\Quodom\API` or `...\APP`.** Read-only reference.
