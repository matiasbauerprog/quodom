import { quodom as quodomApi } from '../api/quodom';
import { quodomLines } from '../api/quodom_lines';
import { addGuestLine, type GuestLine } from '../guest/guestQuodom';

export type AgregarResult = { idquodom: string | null };

/**
 * Adds a product to whatever the user's current Quodom is.
 *
 * Guests build the Quodom in localStorage (it migrates on login). Once there is
 * a session the line goes straight to the server, into the "Quodom activo" the
 * backend resolves for us, so it shows up in Mis Quodoms right away.
 */
export async function agregarProducto(
  line: GuestLine,
  opts: { logueado: boolean }
): Promise<AgregarResult> {
  if (!opts.logueado) {
    addGuestLine(line);
    notificarCambio();
    return { idquodom: null };
  }

  const activo = await quodomApi.getLastOrCreate();
  await quodomLines.add({
    idquodom: activo.id,
    idproducto: line.idproducto,
    cantidad: line.cantidad,
    nombreProducto: line.nombreProducto,
    ...(line.atributo1 ? { atributo1: line.atributo1 } : {}),
    ...(line.atributo2 ? { atributo2: line.atributo2 } : {})
  });
  notificarCambio();
  return { idquodom: activo.id };
}

function notificarCambio(): void {
  window.dispatchEvent(new Event('quodom:changed'));
}
