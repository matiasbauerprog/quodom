import { quodom as quodomApi } from '../api/quodom';
import { quodomLines } from '../api/quodom_lines';
import { rubrosDisponibles } from '../quodom/rubrosDisponibles';
import { abrirQuodom } from '../quodom/quodomAbierto';
import { clearGuestCart, getGuestCart, guestRubrosConLineas } from './guestQuodom';

export type PlanMigracion = {
  /** Rubros con carrito que se pueden migrar: cada uno pasa a un Quodom nuevo. */
  aMigrar: number[];
  /** Carritos de un rubro que el catálogo ya no ofrece: no se migran. */
  noDisponibles: number[];
};

/**
 * Un Quodom pertenece a un solo rubro, así que los carritos de invitado se
 * migran rubro por rubro. Un rubro puede tener todos los Quodoms abiertos que
 * el usuario quiera, de modo que no hay conflicto que resolver: cada carrito
 * pasa a un Quodom nuevo (y si el usuario quiere unirlos, lo hace después
 * arrastrando).
 *
 * A cart of a rubro the catalogue no longer offers can't be migrated at all —
 * `POST /quodom/create` answers 400 `idrubro_invalido` — so it is set aside in
 * `noDisponibles` instead of being attempted. It is never deleted: the cart
 * stays in localStorage and the caller tells the user about it.
 */
export async function planificarMigracion(): Promise<PlanMigracion> {
  const aMigrar: number[] = [];
  const noDisponibles: number[] = [];

  // Without the catalogue there is no way to tell an offered rubro from a
  // retired one, so fall back to planning them all: each one is migrated in
  // its own try/catch anyway, and the cart survives a failure untouched.
  let disponibles: number[] | null = null;
  try {
    disponibles = await rubrosDisponibles();
  } catch {
    disponibles = null;
  }

  for (const idrubro of guestRubrosConLineas()) {
    if (disponibles && !disponibles.includes(idrubro)) noDisponibles.push(idrubro);
    else aMigrar.push(idrubro);
  }

  return { aMigrar, noDisponibles };
}

/**
 * Crea un Quodom nuevo con el carrito del rubro y lo vacía, pero sólo cuando
 * todas las líneas están confirmadas en el servidor. Si una falla el carrito
 * queda entero para reintentar, y el Quodom a medias se descarta (mejor
 * esfuerzo) para que el reintento no deje un duplicado.
 */
export async function migrarRubro(idrubro: number): Promise<string | null> {
  const cart = getGuestCart(idrubro);
  if (cart.lines.length === 0) return null;

  const creado = await quodomApi.create({ descripcion: cart.descripcion.trim() || 'Mi Quodom', idrubro });
  const idquodom = creado.idquodom;

  try {
    for (const l of cart.lines) {
      await quodomLines.add({
        idquodom,
        idproducto: l.idproducto,
        cantidad: l.cantidad,
        nombreProducto: l.nombreProducto,
        ...(l.atributo1 ? { atributo1: l.atributo1 } : {}),
        ...(l.atributo2 ? { atributo2: l.atributo2 } : {})
      });
    }
  } catch (e) {
    await quodomApi.eliminar(idquodom).catch(() => {});
    throw e;
  }

  clearGuestCart(idrubro);
  // Recién creado con el carrito del propio usuario: el próximo "+" de este
  // rubro va ahí en vez de preguntar lo que ya se sabe.
  abrirQuodom(idrubro, idquodom);
  window.dispatchEvent(new Event('quodom:changed'));
  return idquodom;
}
