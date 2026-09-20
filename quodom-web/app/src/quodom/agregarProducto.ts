import { quodom as quodomApi } from '../api/quodom';
import { quodomLines } from '../api/quodom_lines';
import { addGuestLine, guestLineCount, type GuestLine } from '../guest/guestQuodom';

export type AgregarResult =
  | { estado: 'agregado'; idquodom: string | null }
  | { estado: 'necesita_confirmacion'; idrubro: number };

type Opts = { logueado: boolean; idrubro: number };

/**
 * Adds a product to the Quodom of its rubro. A Quodom holds a single rubro, so
 * when there is no open one for it nothing is added: the caller has to confirm
 * creating it first (confirmarYAgregar).
 */
export async function agregarProducto(line: GuestLine, opts: Opts): Promise<AgregarResult> {
  if (!opts.logueado) {
    if (guestLineCount(opts.idrubro) === 0 && guestLineCount() > 0) {
      return { estado: 'necesita_confirmacion', idrubro: opts.idrubro };
    }
    addGuestLine(opts.idrubro, line);
    notificarCambio();
    return { estado: 'agregado', idquodom: null };
  }

  const activo = await quodomApi.activoPorRubro(opts.idrubro);
  if (!activo) return { estado: 'necesita_confirmacion', idrubro: opts.idrubro };

  await agregarAlServidor(activo.id, line);
  notificarCambio();
  return { estado: 'agregado', idquodom: activo.id };
}

/** Second half of the flow: the user accepted opening a Quodom for this rubro. */
export async function confirmarYAgregar(
  line: GuestLine,
  opts: Opts & { descripcion: string }
): Promise<{ idquodom: string | null }> {
  if (!opts.logueado) {
    addGuestLine(opts.idrubro, line);
    notificarCambio();
    return { idquodom: null };
  }

  const creado = await quodomApi.create({ descripcion: opts.descripcion, idrubro: opts.idrubro });
  await agregarAlServidor(creado.idquodom, line);
  notificarCambio();
  return { idquodom: creado.idquodom };
}

/**
 * Único lugar donde se arma una línea para el servidor. El Modo IA también lo
 * usa: si el atributo elegido no se manda acá, la línea llega sin formato y el
 * usuario tiene que volver a elegirlo en el detalle del Quodom.
 */
export async function agregarAlServidor(idquodom: string, line: GuestLine): Promise<void> {
  await quodomLines.add({
    idquodom,
    idproducto: line.idproducto,
    cantidad: line.cantidad,
    nombreProducto: line.nombreProducto,
    ...(line.atributo1 ? { atributo1: line.atributo1 } : {}),
    ...(line.atributo2 ? { atributo2: line.atributo2 } : {})
  });
}

function notificarCambio(): void {
  window.dispatchEvent(new Event('quodom:changed'));
}
