import { quodom as quodomApi } from '../api/quodom';
import { quodomLines } from '../api/quodom_lines';
import { ApiError } from '../api/client';
import type { Quodom } from '../api/types';
import { addGuestLine, type GuestLine } from '../guest/guestQuodom';
import { abiertoDe, abrirQuodom, cerrarQuodom } from './quodomAbierto';

export type AgregarResult =
  | { estado: 'agregado'; idquodom: string | null }
  | { estado: 'elegir_destino'; idrubro: number; candidatos: Quodom[] };

type Opts = { logueado: boolean; idrubro: number };

/**
 * Agrega un producto al Quodom abierto de su rubro, sin preguntar. Sólo cuando
 * el rubro no tiene ninguno abierto no agrega nada y devuelve los candidatos
 * para que el usuario elija (agregarADestino / crearYAgregar).
 */
export async function agregarProducto(line: GuestLine, opts: Opts): Promise<AgregarResult> {
  if (!opts.logueado) {
    addGuestLine(opts.idrubro, line);
    notificarCambio();
    return { estado: 'agregado', idquodom: null };
  }

  const abierto = abiertoDe(opts.idrubro);
  if (abierto) {
    try {
      await agregarAlServidor(abierto, line);
      notificarCambio();
      return { estado: 'agregado', idquodom: abierto };
    } catch (e) {
      // Un error de red o de validación no dice nada sobre el Quodom: se muestra.
      if (!(e instanceof ApiError)) throw e;
      // El abierto ya no existe (borrado o enviado en otra pestaña). Se cae al
      // camino de elegir, que es el mismo que si nunca hubiera habido uno.
      cerrarQuodom(opts.idrubro);
    }
  }

  const candidatos = await quodomApi.activosPorRubro(opts.idrubro);
  return { estado: 'elegir_destino', idrubro: opts.idrubro, candidatos };
}

/** El usuario eligió un Quodom existente: la línea va ahí y queda como el abierto. */
export async function agregarADestino(line: GuestLine, idrubro: number, idquodom: string): Promise<void> {
  await agregarAlServidor(idquodom, line);
  abrirQuodom(idrubro, idquodom);
  notificarCambio();
}

/** El usuario pidió uno nuevo: se crea, recibe la línea y queda como el abierto. */
export async function crearYAgregar(line: GuestLine, idrubro: number, descripcion: string): Promise<string> {
  const creado = await quodomApi.create({ descripcion, idrubro });
  await agregarAlServidor(creado.idquodom, line);
  abrirQuodom(idrubro, creado.idquodom);
  notificarCambio();
  return creado.idquodom;
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
