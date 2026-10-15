import { apiFetch } from './client';
import type { SugerenciaLugar, DireccionDeLugar } from './types';

export const lugares = {
  sugerencias: (q: string, sesion: string) =>
    apiFetch<{ sugerencias: SugerenciaLugar[] }>(
      '/lugares/sugerencias?q=' + encodeURIComponent(q) + '&sesion=' + encodeURIComponent(sesion)),
  direccion: (placeid: string, sesion: string) =>
    apiFetch<DireccionDeLugar>(
      '/lugares/' + encodeURIComponent(placeid) + '?sesion=' + encodeURIComponent(sesion)),
  // Qué dirección hay en un punto, para el pin arrastrable. **Cada llamada es
  // una consulta paga**: se pide al soltar el pin, nunca mientras se arrastra.
  // `lat`/`lng` vuelven como se pidieron y no como Google los emparejó.
  punto: (lat: number, lng: number) =>
    apiFetch<DireccionDeLugar>('/lugares/punto?lat=' + encodeURIComponent(lat) + '&lng=' + encodeURIComponent(lng))
};
