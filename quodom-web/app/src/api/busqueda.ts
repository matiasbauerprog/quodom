import { apiFetch } from './client';
import type { BusquedaResult } from './types';

export const busqueda = {
  buscar: (b: string) => apiFetch<BusquedaResult[]>('/busqueda?b=' + encodeURIComponent(b))
};
