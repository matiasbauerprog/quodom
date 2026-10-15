import { apiFetch } from './client';
import type { SugerenciaLugar, DireccionDeLugar } from './types';

export const lugares = {
  sugerencias: (q: string, sesion: string) =>
    apiFetch<{ sugerencias: SugerenciaLugar[] }>(
      '/lugares/sugerencias?q=' + encodeURIComponent(q) + '&sesion=' + encodeURIComponent(sesion)),
  direccion: (placeid: string, sesion: string) =>
    apiFetch<DireccionDeLugar>(
      '/lugares/' + encodeURIComponent(placeid) + '?sesion=' + encodeURIComponent(sesion))
};
