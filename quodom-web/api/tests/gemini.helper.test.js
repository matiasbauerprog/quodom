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
