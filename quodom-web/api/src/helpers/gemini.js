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
