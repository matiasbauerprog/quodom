import { apiFetch } from './client';
import type { Quodom } from './types';

export const quodom = {
  misQuodom: () => apiFetch<Quodom[]>('/quodom/misQuodom/'),
  porId: (id: string) => apiFetch<Quodom>('/quodom/' + encodeURIComponent(id)),
  porcCompletado: (id: string) => apiFetch<{ porccompletado: number; cantproductos: number }>('/quodom/porccompletado/' + encodeURIComponent(id)),
  create: (body: { descripcion: string; idrubro: number; iddireccion?: number | null }) =>
    apiFetch<{ res: boolean; idquodom: string }>('/quodom/create', { method: 'POST', body }),
  // Los Quodoms en armado de un rubro, del más nuevo al más viejo. Nunca crea.
  activosPorRubro: (idrubro: number) =>
    apiFetch<{ res: boolean; data: Quodom[] }>('/quodom/activos/' + idrubro).then(r => r.data),
  update: (id: string, body: { descripcion?: string; iddireccion?: number | null }) =>
    apiFetch<Quodom>('/quodom/' + encodeURIComponent(id), { method: 'PUT', body }),
  eliminar: (id: string) =>
    apiFetch<{ res: boolean }>('/quodom/' + encodeURIComponent(id), { method: 'DELETE' }),
  whatsapp: (id: string) =>
    apiFetch<{ res: boolean; link: string }>('/quodom/whatsapp/' + encodeURIComponent(id)),
  repetir: (id: string) =>
    apiFetch<{ res: boolean; idquodom: string }>('/quodom/repetir/' + encodeURIComponent(id), { method: 'POST' })
};
