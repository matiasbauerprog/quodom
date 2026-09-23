import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../src/api/client';

const originalFetch = globalThis.fetch;

describe('api client', () => {
  beforeEach(() => {
    localStorage.clear();
    globalThis.fetch = vi.fn();
  });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('sends JSON body and returns parsed json on success', async () => {
    (globalThis.fetch as any).mockResolvedValue(new Response(
      JSON.stringify({ id: 1, name: 'foo' }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    ));
    const data = await apiFetch<{ id: number; name: string }>('/foo', { method: 'POST', body: { x: 1 } });
    expect(data).toEqual({ id: 1, name: 'foo' });
    const req = (globalThis.fetch as any).mock.calls[0];
    expect(req[0]).toBe('/api/foo');
    expect(req[1].headers['Content-Type']).toBe('application/json');
    expect(req[1].body).toBe(JSON.stringify({ x: 1 }));
  });

  it('lets the browser carry the session cookie and never reads a token from storage', async () => {
    localStorage.setItem('quodom.token', 'legacy.token');
    (globalThis.fetch as any).mockResolvedValue(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    await apiFetch('/x');
    const req = (globalThis.fetch as any).mock.calls[0];
    expect(req[1].credentials).toBe('same-origin');
    expect(req[1].headers.Authorization).toBeUndefined();
  });

  it('throws ApiError with backend message on 400', async () => {
    (globalThis.fetch as any).mockResolvedValue(new Response(
      JSON.stringify({ res: false, message: 'Usuario incorrecto.' }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    ));
    await expect(apiFetch('/signin', { method: 'POST', body: { u: 1 } }))
      .rejects.toMatchObject({ name: 'ApiError', status: 400, message: 'Usuario incorrecto.' });
  });

  it('throws ApiError with the status on 401', async () => {
    (globalThis.fetch as any).mockResolvedValue(new Response(
      JSON.stringify({ message: 'jwt expired' }),
      { status: 401, headers: { 'content-type': 'application/json' } }
    ));
    await expect(apiFetch('/x')).rejects.toMatchObject({ name: 'ApiError', status: 401 });
  });

  it('throws a network ApiError when fetch rejects', async () => {
    (globalThis.fetch as any).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(apiFetch('/x')).rejects.toMatchObject({ status: 0, message: expect.stringContaining('conexión') });
  });
});
