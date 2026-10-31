import type { Quodom } from '../api/types';
import type { RamaRubro } from '../components/layout/ArbolQuodoms';
import { nombreRubro } from './rubros';
import { leerUsos, type Usos } from './quodomAbierto';

/**
 * Los Quodoms en armado, agrupados por rubro para el árbol.
 *
 * Esta es la única barrera contra los rubros retirados: el árbol pinta lo que
 * recibe, así que un rubro que ya no está en `disponibles` se descarta acá y
 * nunca llega a ofrecerse como destino. `disponibles` entra por parámetro (en
 * vez de consultarse acá) para que la función siga siendo síncrona y testeable.
 */
export function ramasDeQuodoms(lista: Quodom[], disponibles: number[], usos: Usos = leerUsos()): RamaRubro[] {
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
  // El más usado primero, y debajo el anterior (ver `leerUsos`). Los que nunca
  // se usaron en este navegador quedan al final en el orden del servidor (el
  // más nuevo primero): el sort es estable.
  const uso = (id: string) => usos[id] ?? 0;
  const ultimoUso = (r: RamaRubro) => Math.max(0, ...r.quodoms.map(x => uso(x.id)));
  for (const rama of porRubro.values()) rama.quodoms.sort((a, b) => uso(b.id) - uso(a.id));
  return [...porRubro.values()]
    .sort((a, b) => ultimoUso(b) - ultimoUso(a) || a.idrubro - b.idrubro);
}
