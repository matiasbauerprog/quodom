import { quodom as quodomApi } from '../api/quodom';
import type { Quodom } from '../api/types';
import { abrirQuodom } from './quodomAbierto';
import { abrirPanel } from '../components/layout/panelLateral';

/** Lo que se repitió y cómo se llama el nuevo, para `AvisoRepetido`. */
export type Repetido = { idquodom: string; idrubro: number; nombre: string; nombrerubro: string };

/**
 * Crea un Quodom nuevo con las líneas de `q`, lo deja abierto en el árbol de su
 * rubro y lo anuncia. Todos los "Repetir" pasan por acá —campana, pantalla de
 * notificaciones, tarjeta y ventana del historial— para que dejen lo mismo.
 *
 * El anuncio (`quodom:repetido`) es lo que lo hace visible: el pedido nuevo
 * aparecía en el árbol sin que nada lo dijera, en celular el árbol ni se ve, y
 * el usuario no tenía ninguna prueba de que repetir había hecho algo.
 */
export async function repetirPedido(q: Quodom): Promise<string> {
  const r = await quodomApi.repetir(q.id);
  abrirQuodom(q.idrubro, r.idquodom);
  abrirPanel();
  window.dispatchEvent(new Event('quodom:changed'));
  const detail: Repetido = {
    idquodom: r.idquodom,
    idrubro: q.idrubro,
    nombre: q.descripcion || q.nro || 'tu pedido',
    nombrerubro: q.nombrerubro ?? ''
  };
  window.dispatchEvent(new CustomEvent('quodom:repetido', { detail }));
  return r.idquodom;
}
