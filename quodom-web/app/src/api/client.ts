// The session lives in an httpOnly cookie the API sets at sign-in; no script
// can read it, and the browser attaches it on its own. That only works because
// the API is reached through this same origin (/api), never cross-site.
// Before that the token sat in localStorage under this key; drop any leftover.
export function forgetLegacyToken(): void {
  try { localStorage.removeItem('quodom.token'); } catch { /* storage blocked */ }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
};

// Una sola definición de dónde vive el API: las imágenes se piden por URL
// directa y antes tenían su propio default, que quedó apuntando a localhost.
export function apiBase(): string {
  return import.meta.env.VITE_API_URL || '/api';
}

export async function apiFetch<T = unknown>(path: string, options: Options = {}): Promise<T> {
  const base = apiBase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {})
  };
  let res: Response;
  try {
    res = await fetch(base + path, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'same-origin',
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch {
    throw new ApiError('No hay conexión con el servidor.', 0);
  }

  const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
  const payload: any = isJson ? await res.json().catch(() => ({})) : null;

  if (!res.ok) {
    const msg = (payload && payload.message) || 'Error del servidor.';
    throw new ApiError(msg, res.status);
  }
  return payload as T;
}
