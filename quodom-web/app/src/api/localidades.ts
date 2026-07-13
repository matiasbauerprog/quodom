import { apiFetch } from './client';
import type { Localidad } from './types';

export const localidades = {
  porProvincia: (idprovincia: number) =>
    apiFetch<Localidad[]>('/localidades/prov?idprovincia=' + idprovincia)
};
