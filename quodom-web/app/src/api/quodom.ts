import { apiFetch } from './client';
import type { Quodom } from './types';

export const quodom = {
  misQuodom: () => apiFetch<Quodom[]>('/quodom/misQuodom/'),
  porId: (id: string) => apiFetch<Quodom>('/quodom/' + encodeURIComponent(id)),
  porcCompletado: (id: string) => apiFetch<{ porccompletado: number; cantproductos: number }>('/quodom/porccompletado/' + encodeURIComponent(id)),
  create: (body: { descripcion: string; iddireccion?: number | null }) =>
    apiFetch<{ res: boolean; idquodom: string }>('/quodom/create', { method: 'POST', body }),
  // Newest Quodom still in 'CREADO', or a fresh one when there is none: the
  // "Quodom activo" a logged-in user keeps adding products to.
  getLastOrCreate: (descripcion = 'Mi Quodom') =>
    apiFetch<{ res: boolean; data: Quodom }>('/quodom/getLastQuodom/', { method: 'POST', body: { descripcion } })
      .then(r => r.data),
  update: (id: string, body: { descripcion?: string; iddireccion?: number | null }) =>
    apiFetch<Quodom>('/quodom/' + encodeURIComponent(id), { method: 'PUT', body }),
  eliminar: (id: string) =>
    apiFetch<{ res: boolean }>('/quodom/' + encodeURIComponent(id), { method: 'DELETE' }),
  whatsapp: (id: string) =>
    apiFetch<{ res: boolean; link: string }>('/quodom/whatsapp/' + encodeURIComponent(id)),
  repetir: (id: string) =>
    apiFetch<{ res: boolean; idquodom: string }>('/quodom/repetir/' + encodeURIComponent(id), { method: 'POST' })
};
