import { quodom } from '../api/quodom';
import { quodomLines } from '../api/quodom_lines';
import { clearGuestQuodom, getGuestQuodom } from './guestQuodom';

export async function migrateGuestQuodom(): Promise<string | null> {
  const g = getGuestQuodom();
  if (g.lines.length === 0) return null;
  const descripcion = g.descripcion.trim() || 'Mi Quodom';
  const created = await quodom.create({ descripcion });
  for (const l of g.lines) {
    await quodomLines.add({
      idquodom: created.idquodom,
      idproducto: l.idproducto,
      cantidad: l.cantidad,
      nombreProducto: l.nombreProducto,
      atributo1: l.atributo1,
      atributo2: l.atributo2
    });
  }
  clearGuestQuodom();
  return created.idquodom;
}
