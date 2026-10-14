import { categorias } from '../api/categorias';

/**
 * The rubros the catalogue offers today. `GET /categorias` already filters by
 * the backend's RUBROS_ACTIVOS list (`api/src/config/rubros.js`), so whatever
 * it returns is exactly what `POST /quodom/create` will accept — every other
 * rubro answers 400 `idrubro_invalido`.
 *
 * Old guest carts and old Quodoms of a retired rubro still exist, so anything
 * that offers an action on them has to ask first instead of assuming.
 */
// La consulta se comparte: el panel la pide en cada clic del árbol y los rubros
// casi nunca cambian. Se cachea la promesa y no el valor, así dos pedidos
// simultáneos comparten un solo fetch; un fallo se descarta para que la
// llamada siguiente reintente en vez de repetir el error para siempre.
let enCurso: Promise<number[]> | null = null;

export function rubrosDisponibles(): Promise<number[]> {
  if (!enCurso) {
    const p = categorias.raiz().then(raiz => raiz.map(c => c.id));
    enCurso = p;
    p.catch(() => { if (enCurso === p) enCurso = null; });
  }
  return enCurso;
}

/** Sólo para tests: olvida lo cacheado. */
export function reiniciarCacheRubros(): void {
  enCurso = null;
}

export async function rubroDisponible(idrubro: number): Promise<boolean> {
  return (await rubrosDisponibles()).includes(idrubro);
}
