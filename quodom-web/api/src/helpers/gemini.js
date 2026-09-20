const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_DEADLINE_MS = 55000;
const DEFAULT_ATTEMPTS_PER_MODEL = 2;
// Newest models get the most traffic and are the first to answer 503 UNAVAILABLE
// on the free tier. Retrying on the next-newest is not enough: el 2026-09-20
// toda la cadena (3.7 -> 3.6 -> 3.5) contestaba 503 a la vez y el chat fallaba
// entero tras 55s. Midiendo los nueve modelos flash habilitados con el payload
// real, el único que respondía era gemini-3-flash-preview. La cadena mezcla
// entonces generaciones distintas en vez de bajar un escalón por vez, y termina
// en un modelo lite, que es el menos disputado.
// Ojo: el primario es un modelo preview y Google puede retirarlo sin aviso; el
// helper trata un 404 como "pasá al siguiente", así que eso degrada, no rompe.
const DEFAULT_FALLBACKS = 'gemini-3.7-flash,gemini-flash-lite-latest';

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

function isRetryable(e) {
  return e.name === 'AbortError' || e.status === 429 || (e.status >= 500 && e.status <= 599);
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
      responseSchema
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
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== 'string' || text.trim() === '') {
        throw new Error('gemini: empty or missing text in response (candidates: ' + (json?.candidates?.length ?? 0) + ')');
      }
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error('gemini: could not parse JSON response: ' + text.slice(0, 200));
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
    for (let attempt = 1; attempt <= attemptsPerModel; attempt++) {
      const budget = deadline - Date.now();
      if (budget <= 0 && lastErr) break;
      calls += 1;
      try {
        return await doFetch(modelName, Math.max(1000, Math.min(timeoutMs, budget)));
      } catch (e) {
        lastErr = e;
        const skipModel = isModelUnavailable(e);
        if (!skipModel && !isRetryable(e)) throw e;

        const reason = e.name === 'AbortError' ? 'timeout' : e.message;
        const isLastOverall = mi === chain.length - 1 && attempt === attemptsPerModel;
        if (isLastOverall) break;
        // A 429 is a quota/rate ceiling on this model and a 404 means it is gone:
        // waiting will not clear either, but another model may still work.
        if (skipModel || e.status === 429 || attempt === attemptsPerModel) {
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
