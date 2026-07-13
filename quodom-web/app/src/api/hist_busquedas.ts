import { apiFetch } from './client';

export type HistItem = { id: number; valor: string; createdAt: string };

export const historial = {
  list: () => apiFetch<HistItem[]>('/hist_busquedas'),
  add: (valor: string) => apiFetch<{ res: boolean }>('/hist_busquedas/create', { method: 'POST', body: { valor } })
};
