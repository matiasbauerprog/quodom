const CLAVE = 'quodom.abierto';

/**
 * Qué Quodom está abierto en cada rubro: `{ 5: 'id-del-de-pintura' }`.
 *
 * Es estado del cliente, no del Quodom: dos pestañas pueden tener abiertos
 * distintos y al servidor no le importa. Por eso vive acá y no viaja en el
 * contrato.
 */
export type Abiertos = Record<number, string>;

function esMapa(x: unknown): x is Abiertos {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  return Object.entries(x as Record<string, unknown>)
    .every(([k, v]) => /^(0|[1-9]\d*)$/.test(k) && typeof v === 'string' && v !== '');
}

export function leerAbiertos(): Abiertos {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return {};
    const parseado = JSON.parse(crudo);
    return esMapa(parseado) ? parseado : {};
  } catch {
    return {};
  }
}

function guardar(mapa: Abiertos): void {
  try { localStorage.setItem(CLAVE, JSON.stringify(mapa)); } catch {}
  window.dispatchEvent(new Event('quodom:abierto'));
}

export function abiertoDe(idrubro: number): string | null {
  return leerAbiertos()[idrubro] ?? null;
}

export function abrirQuodom(idrubro: number, idquodom: string): void {
  const mapa = leerAbiertos();
  mapa[idrubro] = idquodom;
  guardar(mapa);
}

export function cerrarQuodom(idrubro: number): void {
  const mapa = leerAbiertos();
  delete mapa[idrubro];
  guardar(mapa);
}

/**
 * Descarta los que ya no existen. Un Quodom borrado en otra pestaña, o enviado,
 * dejaría el mapa apuntando a la nada; "ninguno abierto" es un estado válido que
 * el resto ya sabe resolver, así que eso es lo que queda.
 */
export function sanearAbiertos(vivos: string[]): void {
  const mapa = leerAbiertos();
  let cambio = false;
  for (const clave of Object.keys(mapa)) {
    if (!vivos.includes(mapa[Number(clave)])) { delete mapa[Number(clave)]; cambio = true; }
  }
  if (cambio) guardar(mapa);
}
