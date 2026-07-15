# Quodom Web — Modo IA (Plan 3) — Diseño

Detalla la sección 7 del spec maestro (`2026-07-12-quodom-web-design.md`). Objetivo: un chat que arma el presupuesto del usuario a partir de una conversación, proponiendo solo productos reales del catálogo.

## 1. Contexto

- Continúa el trabajo de Plan 1 (API Express + SQLite) y Plan 2 (frontend React + Vite + TS), ambos ya en `master`.
- **Proveedor:** Gemini (`gemini-2.5-flash` inicial). Sin SDK — llamadas HTTP directas a `generativelanguage.googleapis.com`. Cambio de modelo por variable de entorno.
- **Requiere login.** El botón "Modo IA" en la home redirige a `/login?from=/modo-ia` para invitados.
- **Ephemeral por diseño:** el chat vive en React state; no persiste entre refresh ni entre dispositivos. Un chat = un armado.

## 2. Arquitectura

### 2.1 Backend nuevo (`quodom-web/api/src/`)

| Archivo | Responsabilidad |
|---|---|
| `controllers/ia.controller.js` | `chat(userId, messages)` — orquesta validaciones, intent detection y llamada principal. |
| `routes/ia.route.js` | `POST /api/ia/chat` con `auth.verifyToken()`. |
| `helpers/gemini.js` | Cliente HTTP mínimo: `callGemini(model, systemPrompt, contents, responseSchema)`. Timeout 15s, 1 retry en fallo transitorio. |
| `models/ia_usage.js` | Sequelize: `{ id, iduser, fecha (DATEONLY), contador, createdAt, updatedAt }`. Índice único `(iduser, fecha)`. |
| `middleware/rateLimit.js` | 10 mensajes/min por `iduser` con `Map<userId, timestamps[]>` en memoria. |

### 2.2 Frontend nuevo (`quodom-web/app/src/`)

| Archivo | Responsabilidad |
|---|---|
| `screens/ModoIA/ModoIA.tsx` | Ruta `/modo-ia`. Estado de mensajes en React, envío al backend, render de burbujas. |
| `screens/ModoIA/MensajeChat.tsx` | Burbuja individual (usuario derecha acento, assistant izquierda blanca). |
| `screens/ModoIA/PropuestaEditable.tsx` | Lista de items con ± cantidad y × eliminar; botón "Agregar al Quodom". |
| `screens/ModoIA/ModoIA.css` | Estilos siguiendo paleta y forma de hoja. |
| `api/ia.ts` | `iaApi.chat(messages)` y tipos TS de request/response. |
| Modificación de `screens/Home/SitioInicial.tsx` | Botón "Modo IA" entre wordmark y buscador; redirect a login si no hay sesión. |

### 2.3 Variables de entorno (`quodom-web/api/.env` y `.env.example`)

```
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
IA_MAX_DAILY_MESSAGES=50
IA_MAX_TURNS=20
IA_MAX_USER_MESSAGE_LENGTH=500
IA_RATE_LIMIT_PER_MINUTE=10
```

## 3. Contrato del endpoint `POST /api/ia/chat`

### 3.1 Request

Header: `Authorization: Bearer <jwt>`

```json
{
  "messages": [
    { "role": "user", "text": "quiero pintar 3 paredes de 4x3m" },
    { "role": "assistant", "text": "¿ya tenés enduído las paredes?" },
    { "role": "user", "text": "sí, están listas" }
  ]
}
```

### 3.2 Response 200

Uno de dos tipos:

```json
// Repregunta
{ "type": "question", "text": "¿de qué color querés pintar?" }
```

```json
// Propuesta editable
{
  "type": "proposal",
  "text": "Con esto pintás las 3 paredes con 2 manos:",
  "items": [
    { "idproducto": 42, "cantidad": 4, "nombreProducto": "Látex interior 4L", "motivo": "cubre 12m² por lata × 2 manos" },
    { "idproducto": 87, "cantidad": 1, "nombreProducto": "Rodillo lana 22cm", "motivo": "aplicación en paredes lisas" }
  ]
}
```

### 3.3 Errores

| HTTP | `error` code | Cuándo |
|---|---|---|
| 400 | `too_long` | Último mensaje del usuario supera `IA_MAX_USER_MESSAGE_LENGTH`. |
| 400 | `too_many_turns` | `messages.length > IA_MAX_TURNS * 2`. |
| 400 | `no_last_user_message` | El último item de `messages` no tiene `role: "user"`. |
| 401 | (por middleware auth) | JWT ausente o inválido. |
| 429 | `limit_exceeded` | El usuario superó `IA_MAX_DAILY_MESSAGES` hoy. |
| 429 | `rate_limit` | El usuario superó `IA_RATE_LIMIT_PER_MINUTE`. |
| 500 | `ia_unavailable` | Gemini falló (5xx, timeout, JSON malformado tras 1 retry). No incrementa contador diario. |

Además, dos respuestas **200 orgánicas** (no son errores técnicos, son repreguntas):

- Intent detection no encontró subcategorías relevantes → `{ "type": "question", "text": "¿De qué rubro es tu proyecto?" }`
- Tras filtrar IDs inexistentes en la propuesta quedan 0 items → `{ "type": "question", "text": "No encontré productos del catálogo para eso. ¿Podés contarme más de qué tipo de proyecto es?" }`

## 4. Flujo interno del `chat(userId, messages)`

```
1) Validar messages (largo, roles, último es user).
2) Chequear rate limit (10/min) y contador diario (50/día).
3) Intent detection:
   - Cargar todas las subcategorías (idcategoria, nombrecategoria, rubro padre).
   - Llamar a Gemini con systemPrompt corto + último mensaje del usuario.
   - responseSchema: { idsSubcategoria: number[] }
4) SELECT productos WHERE idcategoria IN (idsSubcategoria).
   - Si array vacío → incrementar ia_usage y devolver
     { type: "question", text: "¿De qué rubro es tu proyecto?" }
5) Chat principal:
   - systemPrompt con instrucciones y JSON del catálogo filtrado.
   - contents = messages mapeados a formato Gemini { role: "user"|"model", parts: [{text}] }.
   - responseSchema del tipo union { type, text, items? }.
6) Filtrar items.idproducto contra la DB (drop de alucinaciones).
   - Si type=proposal y quedan 0 items → convertir en
     { type: "question", text: "No encontré productos del catálogo para eso. ¿Podés contarme más de qué tipo de proyecto es?" }
7) Incrementar ia_usage (iduser, hoy) contador += 1.
8) Devolver respuesta.
```

**Regla de incremento del contador diario:**
- **Sí incrementa** siempre que el endpoint devuelva 200 (question, proposal o cualquier variante amable). El costo real de Gemini ya se consumió.
- **No incrementa** en 4xx (validaciones), 429 (límites), ni 500 `ia_unavailable` — el usuario no debe "pagar" cupo por fallas nuestras o rechazos previos a la llamada.

**Otras precisiones:**
- El `systemPrompt` del paso 5 dice: "Sos el asistente de Quodom. Respondés SIEMPRE en español, en JSON. Si necesitás más info, devolvé `{type:'question', text}`. Cuando tengas suficiente para armar el presupuesto, devolvé `{type:'proposal', text, items:[{idproducto, cantidad, motivo}]}`. Usá SOLO productos de esta lista: ..."
- Los `idproducto` inválidos se descartan silenciosamente. No se le informa al modelo — la próxima llamada tampoco los verá porque el catálogo se re-filtra.
- Timeout global del endpoint: 30s (15s por llamada × 2).

## 5. UX de `/modo-ia`

### 5.1 Layout

```
┌─────────────────────────────┐
│  ←  Modo IA            ↺    │  AppBarBack + botón "nueva conversación"
├─────────────────────────────┤
│  💬 Hola. Contame tu        │  mensaje de bienvenida hardcoded
│     proyecto y armo el      │  (no consume cupo)
│     presupuesto.            │
│                             │
│              ┌────────────┐ │  burbuja usuario (derecha, #706F9A)
│              │ Quiero     │ │
│              │ pintar mi  │ │
│              │ cocina     │ │
│              └────────────┘ │
│                             │
│  ┌────────────────────────┐ │  burbuja assistant (izquierda, blanca)
│  │ ¿Ya está enduida?      │ │
│  └────────────────────────┘ │
│                             │
│  ┌────────────────────────┐ │  burbuja propuesta
│  │ 📋 Te propongo:        │ │
│  │ 4× Látex 4L      [−+×] │ │
│  │ 1× Rodillo       [−+×] │ │
│  │ [Agregar al Quodom]    │ │  btn #2DAB66
│  └────────────────────────┘ │
├─────────────────────────────┤
│ [ Escribí acá...     ][►]   │  input + enviar
└─────────────────────────────┘
```

### 5.2 Comportamiento

- **Mensaje inicial:** hardcoded al montar, no request. No cuenta al cupo.
- **Enviar:** deshabilitado si `busy || text.trim().length < 2`. Placeholder cambia a "Pensando…" mientras espera.
- **Auto-scroll:** al último mensaje tras cada cambio en la lista.
- **Propuesta editable:** ± cantidad (min 1), × elimina item. Con 0 items el botón "Agregar" se deshabilita.
- **Al confirmar:**
  1. `POST /quodom` con `descripcion: "Presupuesto IA — YYYY-MM-DD HH:mm"`.
  2. `POST /quodom_lines` en loop por cada item (idproducto, cantidad).
  3. `navigate('/quodom?id=' + newId)`.
- **Errores del backend:** se renderizan como burbuja assistant con el `message` del backend. No hay toasts.
- **Botón "nueva conversación" (↺ en AppBar):** confirm "¿Empezar de nuevo?" → limpia el estado y muestra solo el mensaje de bienvenida.

### 5.3 Entrada

- Botón "🤖 Modo IA" en `SitioInicial.tsx`, entre el wordmark QUODOM y el buscador.
- Sin sesión → redirige a `/login?from=/modo-ia`; después del login vuelve solo.
- No aparece en menú lateral ni sidebar (por ahora).

## 6. Tests

### 6.1 Backend — `quodom-web/api/tests/ia.test.js`

- `helpers/gemini.js` se **mockea** con `jest.mock()` en cada archivo de test. Cero llamadas reales, cero costo, determinísticos.
- Casos cubiertos:
  - 200 devuelve `type: "question"` cuando Gemini responde question.
  - 200 devuelve `type: "proposal"` con items válidos.
  - 200 filtra items con `idproducto` inexistente y sigue con los válidos.
  - 200 con 0 items válidos post-filtrado → `type: "question"` (mensaje amable).
  - 200 con 0 subcategorías detectadas por intent → `type: "question"` (¿de qué rubro?). Solo hace 1 llamada a Gemini (no llega al chat principal).
  - 401 sin JWT (por middleware).
  - 400 con último mensaje > 500 chars.
  - 400 sin mensajes o último con role != "user".
  - 400 con más de 40 messages.
  - 429 `limit_exceeded` tras 50 requests exitosos el mismo día.
  - 429 `rate_limit` tras 11 requests en menos de 1 minuto (test acelera reloj o mockea `Date.now`).
  - 500 `ia_unavailable` cuando el mock tira → contador diario NO incrementa.
  - El contador `ia_usage` incrementa por (iduser, fecha).

Todo con SQLite en memoria y JWT real generado en el setup, como el resto de la suite.

### 6.2 Frontend — `quodom-web/app/src/screens/ModoIA/__tests__/`

- `ModoIA.test.tsx`:
  - Renderiza mensaje de bienvenida al montar.
  - Envía mensaje mockeando `iaApi.chat`, muestra respuesta assistant.
  - Deshabilita botón enviar durante `busy`.
  - Errores del backend se muestran como burbuja assistant.
- `PropuestaEditable.test.tsx`:
  - Renderiza items.
  - ± actualiza cantidad (min 1).
  - × elimina item.
  - Botón "Agregar" deshabilitado con 0 items.
  - Click ejecuta callback con los items actuales.

### 6.3 Verificación manual (checklist final)

1. Login → `/modo-ia` → "quiero pintar mi cocina" → recibe question o proposal.
2. Refresh → chat vuelve a arrancar (esperado).
3. Confirmar propuesta → navega a `/quodom?id=X` con las líneas cargadas.
4. Bajar `IA_MAX_DAILY_MESSAGES=2` en `.env`, restart, mandar 3 mensajes → tercero responde 429 con mensaje amable.
5. Sin login: home → click "Modo IA" → redirect a `/login?from=/modo-ia`; tras loguearse, vuelve al chat.
6. Mensaje de 501 chars → cliente lo trunca o backend responde 400 con mensaje claro.

## 7. Fuera de scope de Plan 3

Reservado para un posible Plan 4:

- Persistencia de conversaciones en DB.
- Streaming de respuestas (typing effect).
- Historial "Mis conversaciones IA".
- Sugerencias de mensajes predefinidos ("quiero pintar…", "quiero construir…").
- Multi-lenguaje.
- Regeneración de propuesta ("dame otra opción").
- Function calling (herramientas custom para Gemini).

## 8. Descomposición en tareas

Detallada en el plan de implementación (writing-plans). Overview:

1. Backend: env + `helpers/gemini.js`.
2. Backend: modelo `ia_usage` + `middleware/rateLimit.js`.
3. Backend: intent detection en `ia.controller.js`.
4. Backend: endpoint `POST /api/ia/chat` completo con tests.
5. Frontend: `api/ia.ts` + botón "Modo IA" en home.
6. Frontend: pantalla `ModoIA.tsx` (chat base sin propuesta).
7. Frontend: `PropuestaEditable` + integración con `POST /quodom` y `POST /quodom_lines`.
8. Verificación manual + polish + merge a `master`.
