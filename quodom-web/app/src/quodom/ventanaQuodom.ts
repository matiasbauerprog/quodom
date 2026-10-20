import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Location } from 'react-router-dom';

/**
 * El detalle de un Quodom se abre en una ventana encima de la pantalla en la
 * que uno está, no en una pantalla propia: repetir desde el historial, la
 * campana o las notificaciones sacaba al usuario de donde estaba, y para un
 * nombre, unos productos y un botón una pantalla entera sobraba.
 *
 * Vive en la URL (`?quodom=<id>`) y no en estado: así el botón Atrás del
 * celular la cierra en vez de sacar de la app, y un link al pedido sigue
 * andando. `nombrar=1` la abre con el nombre seleccionado (recién repetido).
 */
export const PARAM_VENTANA = 'quodom';
export const PARAM_NOMBRAR = 'nombrar';

/** Marca en `location.state`: la ventana la abrimos nosotros, así que cerrarla es volver atrás. */
export const ESTADO_VENTANA = { ventanaQuodom: true };

type Opciones = { nombrar?: boolean };

export function hrefVentana(location: Pick<Location, 'pathname' | 'search'>, idquodom: string, opts: Opciones = {}): string {
  const p = new URLSearchParams(location.search);
  p.set(PARAM_VENTANA, idquodom);
  if (opts.nombrar) p.set(PARAM_NOMBRAR, '1'); else p.delete(PARAM_NOMBRAR);
  return location.pathname + '?' + p.toString();
}

export function sinVentana(search: string): string {
  const p = new URLSearchParams(search);
  p.delete(PARAM_VENTANA);
  p.delete(PARAM_NOMBRAR);
  const s = p.toString();
  return s ? '?' + s : '';
}

/**
 * Para una pantalla que reescribe su propia URL (el inicio normaliza
 * `?rubro=` a `?rubro=&sub=`): sin copiar estos dos, la normalización borraba
 * la ventana en el instante en que se abría sobre un rubro.
 */
export function conVentana(nuevos: Record<string, string>, actuales: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams(nuevos);
  for (const k of [PARAM_VENTANA, PARAM_NOMBRAR]) {
    const v = actuales.get(k);
    if (v !== null) p.set(k, v);
  }
  return p;
}

/** Abre el detalle de un Quodom encima de la pantalla actual. */
export function useAbrirQuodom() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (idquodom: string, opts?: Opciones) => navigate(hrefVentana(location, idquodom, opts), { state: ESTADO_VENTANA }),
    [navigate, location]
  );
}
