import { apiFetch } from './client';
import type { Proveedor } from './types';

export type RespuestaProveedores = {
  proveedores: Proveedor[];
  preciso: boolean;
  desde: string;
  atribucion: string;
};

export const proveedores = {
  delQuodom: (idquodom: string) =>
    apiFetch<RespuestaProveedores>('/quodom/proveedores/' + encodeURIComponent(idquodom)),
  noEnviado: (idquodom: string, placeid: string, motivo?: 'sin_whatsapp' | 'otro') =>
    apiFetch<{ res: boolean }>('/quodom/proveedores/' + encodeURIComponent(idquodom) + '/no-enviado',
      { method: 'POST', body: { placeid, motivo } })
};
