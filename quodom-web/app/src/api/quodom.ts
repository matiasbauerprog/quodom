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
  update: (id: string, body: { descripcion?: string; detalle?: string | null; iddireccion?: number | null }) =>
    apiFetch<Quodom>('/quodom/' + encodeURIComponent(id), { method: 'PUT', body }),
  eliminar: (id: string) =>
    apiFetch<{ res: boolean }>('/quodom/' + encodeURIComponent(id), { method: 'DELETE' }),
  // Los dos parámetros del proveedor viajan juntos o no viajan: el servidor
  // rechaza con 400 la mitad del par, porque un placeid sin teléfono armaría un
  // link sin destinatario creyendo que lo tiene.
  whatsapp: (id: string, opts?: { proveedor: string; tel: string }) =>
    apiFetch<{ res: boolean; link: string }>('/quodom/whatsapp/' + encodeURIComponent(id) +
      (opts ? '?proveedor=' + encodeURIComponent(opts.proveedor) + '&tel=' + encodeURIComponent(opts.tel) : '')),
  repetir: (id: string) =>
    apiFetch<{ res: boolean; idquodom: string }>('/quodom/repetir/' + encodeURIComponent(id), { method: 'POST' })
};
