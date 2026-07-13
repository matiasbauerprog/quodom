import { apiFetch } from './client';
import type { Notificacion } from './types';

export const notificaciones = {
  list: () => apiFetch<Notificacion[]>('/oper_notificaciones'),
  count: () => apiFetch<number>('/oper_notificaciones/count'),
  marcarLeida: (id: number) => apiFetch<{ res: boolean }>('/oper_notificaciones/' + id, { method: 'PUT', body: { leida: 1 } })
};
