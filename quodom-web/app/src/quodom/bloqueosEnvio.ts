import type { Quodom } from '../api/types';

export type MotivoBloqueo = 'atributo' | 'direccion';

export type BloqueoEnvio = {
  motivo: MotivoBloqueo;
  /** Qué le falta, para mostrar al lado del botón. */
  texto: string;
  /** Qué tiene que hacer el usuario para desbloquearlo. */
  accion: string;
};

/** La línea que frena el envío: qué producto y qué grupo de atributo le falta. */
export type FaltaAtributo = { producto: string; atributo: string };

type Resumen = Pick<Quodom, 'cantproductos'> & { porccompletado?: number };

type LineaAtributos = {
  nombreAtributo1?: string | null;
  atributo1?: string | null;
  nombreAtributo2?: string | null;
  atributo2?: string | null;
};

const FALTA_ATRIBUTO: BloqueoEnvio = {
  motivo: 'atributo',
  texto: 'Falta elegir la medida de algún producto.',
  accion: 'Abrí el Quodom y completá lo que falta.'
};

const FALTA_DIRECCION: BloqueoEnvio = {
  motivo: 'direccion',
  texto: 'Falta tu dirección.',
  accion: 'Cargar dirección'
};

/**
 * El mismo orden de prioridad que el backend (409 falta_atributo antes que
 * falta_direccion en `GET /quodom/whatsapp/:id`), así el aviso del botón
 * coincide con lo que el servidor iba a contestar.
 */
function bloqueo(faltanAtributos: boolean, tieneDireccion: boolean): BloqueoEnvio | null {
  if (faltanAtributos) return FALTA_ATRIBUTO;
  if (!tieneDireccion) return FALTA_DIRECCION;
  return null;
}

function sinElegir(valor?: string | null): boolean {
  return !valor || valor.trim() === '';
}

function lineaIncompleta(l: LineaAtributos): boolean {
  return (!!l.nombreAtributo1 && sinElegir(l.atributo1))
    || (!!l.nombreAtributo2 && sinElegir(l.atributo2));
}

/**
 * Lo que impide enviar, mirando el resumen del Quodom. Es lo que tiene a mano
 * una tarjeta del sidebar, que no trae las líneas.
 */
export function bloqueoDeEnvio(quodom: Resumen, tieneDireccion: boolean): BloqueoEnvio | null {
  const productos = quodom.cantproductos ?? 0;
  const completado = quodom.porccompletado;
  // Un Quodom vacío lo frena el backend con su propio mensaje, y llega con
  // porccompletado en 0: sin este guardo el aviso diría "faltan atributos".
  // Si el dato no vino, no hay con qué afirmar que falta algo.
  const faltan = productos > 0 && typeof completado === 'number' && completado < 100;
  return bloqueo(faltan, tieneDireccion);
}

/** Lo mismo, mirando las líneas una por una: lo que tiene el detalle. */
export function bloqueoDeEnvioPorLineas(lines: LineaAtributos[], tieneDireccion: boolean): BloqueoEnvio | null {
  return bloqueo(lines.some(lineaIncompleta), tieneDireccion);
}

/**
 * El mismo bloqueo, nombrando la línea que lo causa cuando se la conoce.
 *
 * "Falta la medida de algún producto" obligaba a abrir el Quodom y revisar
 * línea por línea cuál era. Quien tiene las líneas cargadas puede decirlo, y
 * el bloqueo sigue siendo el de `bloqueoDeEnvio`: esto cambia el texto, no la
 * decisión. Si no hay línea identificada, el aviso genérico queda como estaba.
 */
export function conFaltaConcreta(b: BloqueoEnvio | null, falta: FaltaAtributo | null): BloqueoEnvio | null {
  if (!b || b.motivo !== 'atributo' || !falta) return b;
  return {
    motivo: 'atributo',
    texto: `Para cotizar, elegí ${falta.atributo.toLowerCase()} en ${falta.producto}.`,
    accion: 'Está marcado en la línea del producto.'
  };
}
