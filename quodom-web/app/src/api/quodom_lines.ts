import { apiFetch } from './client';
import type { QuodomLine, Atributo } from './types';

export const quodomLines = {
  porQuodom: (idquodom: string) =>
    apiFetch<QuodomLine[]>('/quodom_lines/' + encodeURIComponent(idquodom)),
  porId: (id: number) =>
    apiFetch<QuodomLine>('/quodom_lines/lines/' + id),
  atributos: (idproducto: number, nombreatributo: string) =>
    apiFetch<Atributo[]>('/quodom_lines/atributos?idproducto=' + idproducto + '&nombreatributo=' + encodeURIComponent(nombreatributo)),
  add: (body: { idquodom: string; idproducto: number; cantidad: number; nombreProducto: string; atributo1?: string; atributo2?: string }) =>
    apiFetch<{ res: boolean; id: number }>('/quodom_lines/add', { method: 'POST', body }),
  update: (id: number, body: { cantidad?: number; atributo1?: string; atributo2?: string }) =>
    apiFetch<{ res: boolean }>('/quodom_lines/' + id, { method: 'PUT', body }),
  eliminar: (id: number) =>
    apiFetch<{ res: boolean }>('/quodom_lines/' + id, { method: 'DELETE' })
};
