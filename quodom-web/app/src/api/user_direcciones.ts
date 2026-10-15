import { apiFetch } from './client';
import type { Direccion } from './types';

export type DireccionInput = {
  alias?: string;
  calle?: string;
  numero?: string;
  piso?: string;
  cp?: string;
  localidad?: string;
  direccion?: string;
  observaciones?: string;
  idprovincia?: number;
  default?: boolean;
  // Datos del mapa. El servidor sella la fecha de las coordenadas.
  placeid?: string;
  lat?: number;
  lng?: number;
};

export const userDirecciones = {
  porId: (id: number) =>
    apiFetch<Direccion>('/user_direcciones/' + id),
  default: () =>
    apiFetch<Direccion | null>('/user_direcciones/direcciondefault'),
  create: (body: DireccionInput) =>
    apiFetch<{ res: boolean; message: string }>('/user_direcciones/create', { method: 'POST', body }),
  update: (id: number, body: DireccionInput) =>
    apiFetch<unknown>('/user_direcciones/' + id, { method: 'PUT', body }),
  setPrincipal: (id: number) =>
    apiFetch<unknown>('/user_direcciones/prin/' + id, { method: 'PUT' }),
  eliminar: (id: number) =>
    apiFetch<{ res: boolean; message: string }>('/user_direcciones/' + id, { method: 'DELETE' })
};
