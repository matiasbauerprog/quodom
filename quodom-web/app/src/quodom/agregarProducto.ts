import { quodom as quodomApi } from '../api/quodom';
import { quodomLines } from '../api/quodom_lines';
import { ApiError } from '../api/client';
import type { Quodom } from '../api/types';
import { addGuestLine, type GuestLine } from '../guest/guestQuodom';
import { abiertoDe, abrirQuodom, cerrarQuodom, marcarUso } from './quodomAbierto';

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
    anunciarAgregado(line, opts.idrubro, null);
    return { estado: 'agregado', idquodom: null };
  }

  const abierto = await conAbierto(opts.idrubro, id => agregarAlServidor(id, line));
  if (abierto) {
    notificarCambio();
    anunciarAgregado(line, opts.idrubro, abierto);
    return { estado: 'agregado', idquodom: abierto };
  }

  const candidatos = await quodomApi.activosPorRubro(opts.idrubro);
  return { estado: 'elegir_destino', idrubro: opts.idrubro, candidatos };
}

/**
 * Corre `agregar` contra el Quodom abierto del rubro y devuelve su id, o null si
 * no hay ninguno. Es la regla que comparten el "+" de una línea y el volcado de
 * un lote (useDestinoLote): un error de red no dice nada sobre el Quodom y se
 * propaga; un ApiError sí puede decir que ya no existe (borrado o enviado en
 * otra pestaña), y entonces se olvida y el llamador cae al camino de elegir,
 * igual que si nunca hubiera habido uno abierto.
 */
export async function conAbierto(idrubro: number, agregar: (idquodom: string) => Promise<void>): Promise<string | null> {
  const abierto = abiertoDe(idrubro);
  if (!abierto) return null;
  try {
    await agregar(abierto);
    marcarUso(abierto);
    return abierto;
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    cerrarQuodom(idrubro);
    return null;
  }
}

/** El usuario eligió un Quodom existente: la línea va ahí y queda como el abierto. */
export async function agregarADestino(line: GuestLine, idrubro: number, idquodom: string): Promise<void> {
  await agregarAlServidor(idquodom, line);
  abrirQuodom(idrubro, idquodom);
  notificarCambio();
  anunciarAgregado(line, idrubro, idquodom);
}

/** El usuario pidió uno nuevo: se crea, recibe la línea y queda como el abierto. */
export async function crearYAgregar(line: GuestLine, idrubro: number, descripcion: string): Promise<string> {
  const creado = await quodomApi.create({ descripcion, idrubro });
  await agregarAlServidor(creado.idquodom, line);
  abrirQuodom(idrubro, creado.idquodom);
  notificarCambio();
  anunciarAgregado(line, idrubro, creado.idquodom);
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

/** Lo que se agregó y adónde (`null`: el carrito de invitado del rubro). */
export type Agregado = { nombre: string; idrubro: number; idquodom: string | null };

/**
 * Anuncia una línea que entró. Con el panel cerrado no se ve el árbol, así que
 * sin esto agregar —con +, con el diálogo o soltando— no dejaba ningún rastro
 * visible; el panel lo muestra como un aviso debajo de su pestaña.
 */
function anunciarAgregado(line: GuestLine, idrubro: number, idquodom: string | null): void {
  const detail: Agregado = { nombre: line.nombreProducto, idrubro, idquodom };
  window.dispatchEvent(new CustomEvent('quodom:agregado', { detail }));
}
