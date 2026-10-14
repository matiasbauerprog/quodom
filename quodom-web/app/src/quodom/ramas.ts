import type { Quodom } from '../api/types';
import type { RamaRubro } from '../components/layout/ArbolQuodoms';
import { nombreRubro } from './rubros';

/**
 * Los Quodoms en armado, agrupados por rubro para el árbol.
 *
 * Esta es la única barrera contra los rubros retirados: el árbol pinta lo que
 * recibe, así que un rubro que ya no está en `disponibles` se descarta acá y
 * nunca llega a ofrecerse como destino. `disponibles` entra por parámetro (en
 * vez de consultarse acá) para que la función siga siendo síncrona y testeable.
 */
export function ramasDeQuodoms(lista: Quodom[], disponibles: number[]): RamaRubro[] {
  const porRubro = new Map<number, RamaRubro>();
  for (const q of lista) {
    if (q.estado !== 'CREADO') continue;
    if (!disponibles.includes(q.idrubro)) continue;
    let rama = porRubro.get(q.idrubro);
    if (!rama) {
      rama = { idrubro: q.idrubro, nombre: q.nombrerubro || nombreRubro(q.idrubro), quodoms: [] };
      porRubro.set(q.idrubro, rama);
    }
    rama.quodoms.push(q);
  }
  return [...porRubro.values()].sort((a, b) => a.idrubro - b.idrubro);
}
