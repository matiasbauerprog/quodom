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
  // Todo rubro disponible tiene su rama, con o sin Quodoms: uno vacío es un
  // destino válido ("soltar acá crea uno nuevo").
  const porRubro = new Map<number, RamaRubro>(
    disponibles.map(id => [id, { idrubro: id, nombre: nombreRubro(id), quodoms: [] }])
  );
  for (const q of lista) {
    if (q.estado !== 'CREADO') continue;
    const rama = porRubro.get(q.idrubro);
    if (!rama) continue;
    if (q.nombrerubro) rama.nombre = q.nombrerubro;
    rama.quodoms.push(q);
  }
  return [...porRubro.values()].sort((a, b) => a.idrubro - b.idrubro);
}
