const { callGemini } = require('../src/helpers/gemini');

describe('gemini helper', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  beforeEach(() => {
    // Most cases exercise a single model; the fallback chain has its own test.
    process.env.GEMINI_MODEL_FALLBACKS = '';
  });
  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.GEMINI_MODEL_FALLBACKS;
    delete process.env.GEMINI_TIMEOUT_MS;
    delete process.env.GEMINI_DEADLINE_MS;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

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

  it('throws immediately when GEMINI_API_KEY is not set', async () => {
    delete process.env.GEMINI_API_KEY;
    global.fetch = jest.fn();
    await expect(callGemini({ model: 'gemini-2.5-flash', systemPrompt: 's', contents: [], responseSchema: {} }))
      .rejects.toThrow(/GEMINI_API_KEY not set/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('retries once on AbortError (timeout) and succeeds, but throws normalized error if both time out', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    const abortErr = new Error('The operation was aborted.');
    abortErr.name = 'AbortError';

    // Success on retry:
    global.fetch = jest.fn()
      .mockRejectedValueOnce(abortErr)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] })
      });
    const out = await callGemini({ model: 'gemini-2.5-flash', systemPrompt: 's', contents: [], responseSchema: {} });
    expect(out).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    // Both time out:
    global.fetch = jest.fn().mockRejectedValue(abortErr);
    await expect(callGemini({ model: 'gemini-2.5-flash', systemPrompt: 's', contents: [], responseSchema: {} }))
      .rejects.toThrow(/gemini: timeout after \d+ attempt/);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws when candidates array is empty (safety block, quota exceeded, etc.)', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [] })
    });
    await expect(callGemini({ model: 'gemini-2.5-flash', systemPrompt: 's', contents: [], responseSchema: {} }))
      .rejects.toThrow(/empty or missing text/);
  });

  it('falls back to the next model when the primary is overloaded (503)', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL_FALLBACKS = 'gemini-2.5-flash';
    process.env.GEMINI_ATTEMPTS_PER_MODEL = '1';
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'high demand' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] })
      });

    const out = await callGemini({ model: 'gemini-3.7-flash', systemPrompt: 's', contents: [], responseSchema: {} });

    expect(out).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][0]).toContain('gemini-3.7-flash');
    expect(global.fetch.mock.calls[1][0]).toContain('gemini-2.5-flash');
    delete process.env.GEMINI_ATTEMPTS_PER_MODEL;
  });

  it('does not retry the same model on 429 but does try the next one', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL_FALLBACKS = 'gemini-2.5-flash';
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'quota' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] })
      });

    const out = await callGemini({ model: 'gemini-3.7-flash', systemPrompt: 's', contents: [], responseSchema: {} });

    expect(out).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[1][0]).toContain('gemini-2.5-flash');
  });

  it('skips to the next model when one is retired (404) instead of failing', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL_FALLBACKS = 'gemini-3.5-flash';
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'no longer available' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] })
      });

    const out = await callGemini({ model: 'gemini-2.5-flash', systemPrompt: 's', contents: [], responseSchema: {} });

    expect(out).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[1][0]).toContain('gemini-3.5-flash');
  });

  // Producción no define GEMINI_MODEL_FALLBACKS (render.yaml no la declara), así
  // que corre con este default. Cuando los modelos del default se saturaron, el
  // chat falló entero y no había test que lo notara: el resto de los casos fija
  // la variable a mano y nunca ejercita la cadena que realmente se despliega.
  it('falls back to the deployed default chain when GEMINI_MODEL_FALLBACKS is unset', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    delete process.env.GEMINI_MODEL_FALLBACKS;
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'high demand' })
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'high demand' })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] })
      });

    await callGemini({ model: 'gemini-3-flash-preview', systemPrompt: 's', contents: [], responseSchema: {} });

    const llamados = global.fetch.mock.calls.map(c => decodeURIComponent(String(c[0])));
    expect(llamados[0]).toContain('gemini-3-flash-preview');
    expect(llamados[2]).toContain('gemini-3.7-flash');
  });

  // El bug que dejó el chat muerto aunque hubiera modelos sanos detrás: con el
  // timeout por intento (30s) y el presupuesto total (55s) de producción, dos
  // esperas agotadas consumían todo el tiempo y el bucle cortaba por deadline
  // antes de llamar al segundo modelo. El log lo decía con todas las letras:
  // "timeout after 2 attempt(s) across 3 model(s)". Cada modelo de la cadena
  // tiene que recibir su parte del presupuesto.
  it('tries the rest of the chain when a model times out instead of spending the whole budget on it', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL_FALLBACKS = 'model-b,model-c';
    process.env.GEMINI_TIMEOUT_MS = '200';
    process.env.GEMINI_DEADLINE_MS = '500';

    // Un modelo que no contesta hasta que lo cortan, como la red de verdad. Con
    // mockRejectedValue el tiempo no transcurre y el agotamiento del
    // presupuesto — que es exactamente el bug — no se reproduce.
    const cuelgaHastaQueLoCorten = (signal) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => {
        const e = new Error('The operation was aborted.');
        e.name = 'AbortError';
        reject(e);
      });
    });

    global.fetch = jest.fn((url, opts) =>
      String(url).includes('model-c')
        ? Promise.resolve({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }) })
        : cuelgaHastaQueLoCorten(opts.signal));

    const out = await callGemini({ model: 'model-a', systemPrompt: 's', contents: [], responseSchema: {} });

    expect(out).toEqual({ ok: true });
    const usados = global.fetch.mock.calls.map(c => String(c[0]));
    expect(usados.some(u => u.includes('model-b'))).toBe(true);
    expect(usados.some(u => u.includes('model-c'))).toBe(true);
  });

  // Una propuesta larga se cortó contra el tope de salida y el error dijo
  // "could not parse JSON response", que manda a buscar el problema al lugar
  // equivocado: el JSON estaba bien hasta donde llegó. Google avisa el motivo
  // del final en finishReason y nadie lo miraba.
  it('reports a response cut short by the token limit instead of blaming the JSON', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"type":"proposal","te' }] } }]
      })
    });

    await expect(callGemini({ model: 'gemini-2.5-flash', systemPrompt: 's', contents: [], responseSchema: {} }))
      .rejects.toThrow(/cortó|MAX_TOKENS/i);
  });

  it('names the finishReason when the JSON cannot be parsed for another reason', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: 'no es json' }] } }] })
    });

    await expect(callGemini({ model: 'gemini-2.5-flash', systemPrompt: 's', contents: [], responseSchema: {} }))
      .rejects.toThrow(/SAFETY/);
  });

  it('does not retry on a non-retryable 4xx', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'bad request' });

    await expect(callGemini({ model: 'gemini-2.5-flash', systemPrompt: 's', contents: [], responseSchema: {} }))
      .rejects.toThrow(/HTTP 400/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
