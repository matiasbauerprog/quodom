import { quodom as quodomApi } from '../api/quodom';
import { quodomLines } from '../api/quodom_lines';
import type { Quodom } from '../api/types';
import { clearGuestCart, getGuestCart, guestRubrosConLineas } from './guestQuodom';

export type ConflictoRubro = {
  idrubro: number;
  quodomExistente: Quodom;
  lineasInvitado: number;
};

export type AccionRubro = 'crear' | 'integrar' | 'reemplazar';

/**
 * A Quodom holds one rubro and a user can only have one open per rubro, so the
 * guest carts are migrated rubro by rubro. The ones whose rubro is free are
 * created outright; the rest need the user to pick integrar or reemplazar.
 */
export async function planificarMigracion(): Promise<{ conflictos: ConflictoRubro[]; sinConflicto: number[] }> {
  const conflictos: ConflictoRubro[] = [];
  const sinConflicto: number[] = [];

  for (const idrubro of guestRubrosConLineas()) {
    const existente = await quodomApi.activoPorRubro(idrubro);
    if (existente) {
      conflictos.push({ idrubro, quodomExistente: existente, lineasInvitado: getGuestCart(idrubro).lines.length });
    } else {
      sinConflicto.push(idrubro);
    }
  }

  return { conflictos, sinConflicto };
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
