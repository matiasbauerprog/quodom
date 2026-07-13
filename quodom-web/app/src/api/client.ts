const TOKEN_KEY = 'quodom.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
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

export async function apiFetch<T = unknown>(path: string, options: Options = {}): Promise<T> {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:3999';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {})
  };
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;

  let res: Response;
  try {
    res = await fetch(base + path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch {
    throw new ApiError('No hay conexión con el servidor.', 0);
  }

  const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
  const payload: any = isJson ? await res.json().catch(() => ({})) : null;

  if (!res.ok) {
    if (res.status === 401) clearToken();
    const msg = (payload && payload.message) || 'Error del servidor.';
    throw new ApiError(msg, res.status);
  }
  return payload as T;
}
