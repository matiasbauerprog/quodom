import { quodom as quodomApi } from '../api/quodom';
import { quodomLines } from '../api/quodom_lines';
import type { Quodom } from '../api/types';
import { rubrosDisponibles } from '../quodom/rubrosDisponibles';
import { clearGuestCart, getGuestCart, guestRubrosConLineas } from './guestQuodom';

export type ConflictoRubro = {
  idrubro: number;
  quodomExistente: Quodom;
  lineasInvitado: number;
};

export type AccionRubro = 'crear' | 'integrar' | 'reemplazar';

export type PlanMigracion = {
  conflictos: ConflictoRubro[];
  sinConflicto: number[];
  /** Carritos de un rubro que el catálogo ya no ofrece: no se migran. */
  noDisponibles: number[];
};

/**
 * A Quodom holds one rubro and a user can only have one open per rubro, so the
 * guest carts are migrated rubro by rubro. The ones whose rubro is free are
 * created outright; the rest need the user to pick integrar or reemplazar.
 *
 * A cart of a rubro the catalogue no longer offers can't be migrated at all —
 * `POST /quodom/create` answers 400 `idrubro_invalido` — so it is set aside in
 * `noDisponibles` instead of being attempted. It is never deleted: the cart
 * stays in localStorage and the caller tells the user about it.
 */
export async function planificarMigracion(): Promise<PlanMigracion> {
  const conflictos: ConflictoRubro[] = [];
  const sinConflicto: number[] = [];
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
    if (disponibles && !disponibles.includes(idrubro)) {
      noDisponibles.push(idrubro);
      continue;
    }
    const existente = await quodomApi.activoPorRubro(idrubro);
    if (existente) {
      conflictos.push({ idrubro, quodomExistente: existente, lineasInvitado: getGuestCart(idrubro).lines.length });
    } else {
      sinConflicto.push(idrubro);
    }
  }

  return { conflictos, sinConflicto, noDisponibles };
}

export async function migrarRubro(idrubro: number, accion: AccionRubro): Promise<string | null> {
  const cart = getGuestCart(idrubro);
  if (cart.lines.length === 0) return null;

  let idquodom: string;

  if (accion === 'integrar') {
    const existente = await quodomApi.activoPorRubro(idrubro);
    if (!existente) return await migrarRubro(idrubro, 'crear');
    idquodom = existente.id;
  } else {
    if (accion === 'reemplazar') {
      const existente = await quodomApi.activoPorRubro(idrubro);
      // Reemplazar discards the whole Quodom, not just its lines: DELETE removes
      // header and lines when the estado is CREADO.
      if (existente) await quodomApi.eliminar(existente.id);
    }
    const creado = await quodomApi.create({ descripcion: cart.descripcion.trim() || 'Mi Quodom', idrubro });
    idquodom = creado.idquodom;
  }

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

  clearGuestCart(idrubro);
  window.dispatchEvent(new Event('quodom:changed'));
  return idquodom;
}
