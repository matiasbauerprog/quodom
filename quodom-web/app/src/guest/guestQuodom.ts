const KEY = 'quodom.guest';

export type GuestLine = {
  idproducto: number;
  nombreProducto: string;
  cantidad: number;
  atributo1?: string;
  atributo2?: string;
  nombreAtributo1?: string;
  nombreAtributo2?: string;
};

export type GuestCart = { descripcion: string; lines: GuestLine[] };
export type GuestQuodoms = Record<number, GuestCart>;

function esMapaDeCarritos(parsed: unknown): parsed is GuestQuodoms {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  // The legacy shape was a single cart: { descripcion, lines }. Anything with a
  // top-level `lines` is that old payload and gets discarded.
  if ('lines' in (parsed as Record<string, unknown>)) return false;
  return Object.values(parsed as Record<string, unknown>).every(
    v => !!v && typeof v === 'object' && Array.isArray((v as GuestCart).lines)
  );
}

export function getGuestQuodoms(): GuestQuodoms {
  const raw = localStorage.getItem(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (esMapaDeCarritos(parsed)) return parsed;
  } catch {}
  return {};
}

function save(q: GuestQuodoms): void {
  localStorage.setItem(KEY, JSON.stringify(q));
}

export function getGuestCart(idrubro: number): GuestCart {
  return getGuestQuodoms()[idrubro] ?? { descripcion: '', lines: [] };
}

function sameLine(a: GuestLine, b: GuestLine): boolean {
  return a.idproducto === b.idproducto
    && (a.atributo1 ?? '') === (b.atributo1 ?? '')
    && (a.atributo2 ?? '') === (b.atributo2 ?? '');
}

export function addGuestLine(idrubro: number, line: GuestLine): void {
  const q = getGuestQuodoms();
  const cart = q[idrubro] ?? { descripcion: '', lines: [] };
  const idx = cart.lines.findIndex(l => sameLine(l, line));
  if (idx >= 0) cart.lines[idx].cantidad += line.cantidad;
  else cart.lines.push({ ...line });
  q[idrubro] = cart;
  save(q);
}

export function setGuestDescripcion(idrubro: number, descripcion: string): void {
  const q = getGuestQuodoms();
  const cart = q[idrubro] ?? { descripcion: '', lines: [] };
  cart.descripcion = descripcion;
  q[idrubro] = cart;
  save(q);
}

function mutar(idrubro: number, fn: (cart: GuestCart) => void): void {
  const q = getGuestQuodoms();
  const cart = q[idrubro];
  if (!cart) return;
  fn(cart);
  if (cart.lines.length === 0) delete q[idrubro];
  else q[idrubro] = cart;
  save(q);
}

export function updateGuestLineCantidad(idrubro: number, index: number, cantidad: number): void {
  mutar(idrubro, cart => {
    if (index < 0 || index >= cart.lines.length) return;
    if (cantidad <= 0) cart.lines.splice(index, 1);
    else cart.lines[index].cantidad = cantidad;
  });
}

export function updateGuestLineAtributos(idrubro: number, index: number, patch: { atributo1?: string; atributo2?: string }): void {
  mutar(idrubro, cart => {
    if (index < 0 || index >= cart.lines.length) return;
    cart.lines[index] = { ...cart.lines[index], ...patch };
  });
}

export function removeGuestLine(idrubro: number, index: number): void {
  mutar(idrubro, cart => {
    if (index < 0 || index >= cart.lines.length) return;
    cart.lines.splice(index, 1);
  });
}

export function clearGuestCart(idrubro: number): void {
  const q = getGuestQuodoms();
  delete q[idrubro];
  save(q);
}

export function clearGuestQuodoms(): void {
  localStorage.removeItem(KEY);
}

export function guestRubrosConLineas(): number[] {
  const q = getGuestQuodoms();
  return Object.keys(q).map(Number).filter(r => q[r].lines.length > 0);
}

export function guestLineCount(idrubro?: number): number {
  const q = getGuestQuodoms();
  if (idrubro !== undefined) return q[idrubro]?.lines.length ?? 0;
  return Object.values(q).reduce((acc, cart) => acc + cart.lines.length, 0);
}
