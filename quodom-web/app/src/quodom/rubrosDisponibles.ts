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
export async function rubrosDisponibles(): Promise<number[]> {
  const raiz = await categorias.raiz();
  return raiz.map(c => c.id);
}

export async function rubroDisponible(idrubro: number): Promise<boolean> {
  return (await rubrosDisponibles()).includes(idrubro);
}
