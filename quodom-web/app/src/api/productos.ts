import { apiFetch } from './client';
import type { Product, ProductWithExiste } from './types';

export const productos = {
  porCategoria: (idcategoria: number) =>
    apiFetch<Product[]>('/productos/categoria/' + idcategoria),
  porId: (id: number) =>
    apiFetch<Product>('/productos/' + id),
  porCategoriaEnQuodom: (idquodom: string, idcategoria: number) =>
    apiFetch<ProductWithExiste[]>('/productos/categoriaQ/' + encodeURIComponent(idquodom) + '/' + idcategoria)
};
