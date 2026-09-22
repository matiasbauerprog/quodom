const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_DEADLINE_MS = 55000;
const DEFAULT_ATTEMPTS_PER_MODEL = 2;
// Fusible de costo, no límite de diseño: tiene que sobrar para la respuesta
// legítima más larga. Con los ejemplos resueltos en el prompt las propuestas
// pasaron de 6 a 17 productos, así que 4096 quedó corto y una corrida de cada
// dos se cortaba a mitad del JSON.
const DEFAULT_MAX_OUTPUT_TOKENS = 8192;
// Newest models get the most traffic and are the first to answer 503 UNAVAILABLE
// on the free tier. Retrying on the next-newest is not enough: el 2026-09-20
// toda la cadena (3.7 -> 3.6 -> 3.5) contestaba 503 a la vez y el chat fallaba
// entero tras 55s. Midiendo los nueve modelos flash habilitados con el payload
// real, el único que respondía era gemini-3-flash-preview. La cadena mezcla
// entonces generaciones distintas en vez de bajar un escalón por vez, y termina
// en un modelo lite, que es el menos disputado.
// Ojo: el primario es un modelo preview y Google puede retirarlo sin aviso; el
// helper trata un 404 como "pasá al siguiente", así que eso degrada, no rompe.
// La cadena es larga a propósito. El free tier lleva cuota POR MODELO, así que
// un 429 en uno no dice nada del siguiente, y tanto el 429 como el 404 y el 503
// fallan en menos de un segundo: sumar candidatos casi no gasta presupuesto y
// multiplica las chances de encontrar uno con cupo. Lo caro es el timeout, y de
// eso se ocupa tiempoParaEsteIntento repartiendo el presupuesto.
const DEFAULT_FALLBACKS = 'gemini-3.7-flash,gemini-flash-lite-latest,gemini-3.5-flash,gemini-3.6-flash';

function envInt(name, fallback) {
  const v = parseInt(process.env[name] || '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function modelChain(primary) {
  const raw = process.env.GEMINI_MODEL_FALLBACKS;
  const fallbacks = (raw === undefined ? DEFAULT_FALLBACKS : raw)
    .split(',').map(s => s.trim()).filter(Boolean);
  const chain = [];
  for (const m of [primary, ...fallbacks]) {
    if (m && !chain.includes(m)) chain.push(m);
  }
  return chain;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Exponential backoff with jitter: ~0.6s, ~1.2s, ~2.4s (capped at 4s).
function backoffMs(attempt) {
  const base = Math.min(600 * Math.pow(2, attempt - 1), 4000);
  return Math.round(base * (0.75 + Math.random() * 0.5));
}

/**
 * Cuánto esperar a un modelo sin dejar sin tiempo a los que vienen detrás. El
 * timeout configurado es un techo, no una reserva: si se lo queda entero el
 * primero, el presupuesto total se agota antes de llegar a la cadena de
 * respaldo y los modelos sanos nunca se prueban. Se reparte lo que queda entre
 * los modelos que faltan, con un piso para que un presupuesto casi agotado no
 * degenere en llamadas que nacen muertas.
 */
function tiempoParaEsteIntento(budget, modelosRestantes, timeoutMs) {
  const parte = Math.floor(budget / Math.max(1, modelosRestantes));
  const piso = Math.min(1000, timeoutMs);
  return Math.max(piso, Math.min(timeoutMs, parte));
}

function isRetryable(e) {
  return e.reintentable === true || e.name === 'AbortError' || e.status === 429 || (e.status >= 500 && e.status <= 599);
}

// A model can be retired or gated for the account: that is not worth retrying on
// the same model, but the rest of the chain may still work.
function isModelUnavailable(e) {
  return e.status === 404;
}

async function callGemini({ model, systemPrompt, contents, responseSchema }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('gemini: GEMINI_API_KEY not set');
  }

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
      // Cortafuegos de costo, no un límite de diseño. Una vez el modelo entró
      // en un bucle degenerado dentro de un campo de texto y siguió escribiendo
      // hasta el tope del modelo; con esto ese desborde cuesta acotado. Tiene
      // que sobrar para la respuesta más larga legítima (una propuesta de una
      // docena de productos), así que se ajusta sólo con evidencia.
      maxOutputTokens: envInt('GEMINI_MAX_OUTPUT_TOKENS', DEFAULT_MAX_OUTPUT_TOKENS)
    }
  };

  const doFetch = async (modelName, timeoutMs) => {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
      + encodeURIComponent(modelName) + ':generateContent?key=' + encodeURIComponent(process.env.GEMINI_API_KEY);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error('gemini: HTTP ' + res.status + ' ' + text.slice(0, 200));
        err.status = res.status;
        throw err;
      }
      const json = await res.json();
      const candidato = json?.candidates?.[0];
      // Por qué terminó la respuesta. STOP es el final normal; MAX_TOKENS dice
      // que se cortó contra el tope y el JSON queda a mitad de camino, que sin
      // este chequeo se lee como "el modelo devolvió basura" y manda a
      // investigar al lugar equivocado.
      const finishReason = candidato?.finishReason;
      if (finishReason === 'MAX_TOKENS') {
        const err = new Error('gemini: la respuesta se cortó por el tope de salida (finishReason MAX_TOKENS); '
          + 'subí GEMINI_MAX_OUTPUT_TOKENS o pedile una respuesta más corta');
        // Reintentable: el largo de la respuesta varía entre corridas, así que
        // otro intento puede entrar. El tope de intentos lo acota igual.
        err.reintentable = true;
        throw err;
      }
      const text = candidato?.content?.parts?.[0]?.text;
      if (typeof text !== 'string' || text.trim() === '') {
        throw new Error('gemini: empty or missing text in response (candidates: ' + (json?.candidates?.length ?? 0) + ')');
      }
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error('gemini: could not parse JSON response (finishReason '
          + (finishReason || 'desconocido') + '): ' + text.slice(0, 200));
      }
    } finally {
      clearTimeout(timer);
    }
  };

  const chain = modelChain(model);
  const attemptsPerModel = envInt('GEMINI_ATTEMPTS_PER_MODEL', DEFAULT_ATTEMPTS_PER_MODEL);
  const timeoutMs = envInt('GEMINI_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
  const deadline = Date.now() + envInt('GEMINI_DEADLINE_MS', DEFAULT_DEADLINE_MS);

  let lastErr = null;
  let calls = 0;

  for (let mi = 0; mi < chain.length; mi++) {
    const modelName = chain[mi];
    const esUltimoModelo = mi === chain.length - 1;
    for (let attempt = 1; attempt <= attemptsPerModel; attempt++) {
      const budget = deadline - Date.now();
      if (budget <= 0 && lastErr) break;
      calls += 1;
      try {
        return await doFetch(modelName, tiempoParaEsteIntento(budget, chain.length - mi, timeoutMs));
      } catch (e) {
        lastErr = e;
        const skipModel = isModelUnavailable(e);
        if (!skipModel && !isRetryable(e)) throw e;

        const esTimeout = e.name === 'AbortError';
        const reason = esTimeout ? 'timeout' : e.message;
        const isLastOverall = esUltimoModelo && attempt === attemptsPerModel;
        if (isLastOverall) break;
        // A 429 is a quota/rate ceiling on this model and a 404 means it is gone:
        // waiting will not clear either, but another model may still work. A
        // timeout says the same thing: a model that went silent under load does
        // not usually answer the immediate retry, and insisting spends the
        // budget that the healthy models behind it still need.
        if (skipModel || e.status === 429 || (esTimeout && !esUltimoModelo) || attempt === attemptsPerModel) {
          console.warn('gemini: ' + modelName + ' failed (' + reason + '), falling back to next model');
          break;
        }
        if (Date.now() >= deadline) break;
        const wait = backoffMs(attempt);
        console.warn('gemini: ' + modelName + ' failed (' + reason + '), retrying in ' + wait + 'ms');
        await sleep(wait);
      }
    }
    if (Date.now() >= deadline) break;
  }

  if (lastErr && lastErr.name === 'AbortError') {
    throw new Error('gemini: timeout after ' + calls + ' attempt(s) across ' + chain.length + ' model(s)');
  }
  throw lastErr || new Error('gemini: request failed');
}

module.exports = { callGemini };
