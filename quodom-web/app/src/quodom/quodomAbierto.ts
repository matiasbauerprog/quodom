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
  marcarUso(idquodom);
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
  const usos = leerUsos();
  if (Object.keys(usos).some(id => !vivos.includes(id))) {
    for (const id of Object.keys(usos)) if (!vivos.includes(id)) delete usos[id];
    try { localStorage.setItem(CLAVE_USOS, JSON.stringify(usos)); } catch {}
  }
  const mapa = leerAbiertos();
  let cambio = false;
  for (const clave of Object.keys(mapa)) {
    if (!vivos.includes(mapa[Number(clave)])) { delete mapa[Number(clave)]; cambio = true; }
  }
  if (cambio) guardar(mapa);
}

const CLAVE_USOS = 'quodom.usos';

/**
 * Cuándo se usó por última vez cada Quodom en armado: `{ id: epoch ms }`.
 *
 * El árbol los muestra del más usado al menos usado (lo pidió el usuario,
 * 2026-10-31). Antes salían por fecha de creación, así que "el que estoy usando
 * primero" se cumplía sólo cuando el que se usaba era también el último creado
 * — y eso se veía como un orden que a veces andaba y a veces no. Usar es
 * abrirlo o agregarle algo. Como "abierto", es estado del navegador.
 */
export type Usos = Record<string, number>;

export function leerUsos(): Usos {
  try {
    const crudo = localStorage.getItem(CLAVE_USOS);
    if (!crudo) return {};
    const p = JSON.parse(crudo);
    if (!p || typeof p !== 'object' || Array.isArray(p)) return {};
    const limpio: Usos = {};
    for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) limpio[k] = v;
    }
    return limpio;
  } catch {
    return {};
  }
}

export function marcarUso(idquodom: string, cuando: number = Date.now()): void {
  const usos = leerUsos();
  usos[idquodom] = cuando;
  try { localStorage.setItem(CLAVE_USOS, JSON.stringify(usos)); } catch {}
}
