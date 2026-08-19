import { apiFetch } from './client';
import type { Category } from './types';

export const categorias = {
  raiz: () => apiFetch<Category[]>('/categorias'),
  subs: (idPadre: number) => apiFetch<Category[]>('/categorias/Sub/' + idPadre),
  porId: (id: number) => apiFetch<Category>('/categorias/' + id)
};
