import { apiFetch } from './client';
import type { Provincia } from './types';

export const provincias = {
  list: () => apiFetch<Provincia[]>('/provincias')
};
