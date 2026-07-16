const { callGemini } = require('../src/helpers/gemini');

describe('gemini helper', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  afterEach(() => {
    global.fetch = originalFetch;
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
      .rejects.toThrow('gemini: timeout after retry');
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
});
