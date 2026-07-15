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

export type GuestQuodom = {
  descripcion: string;
  lines: GuestLine[];
};

export function getGuestQuodom(): GuestQuodom {
  const raw = localStorage.getItem(KEY);
  if (!raw) return { descripcion: '', lines: [] };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.lines)) return parsed;
  } catch {}
  return { descripcion: '', lines: [] };
}

function save(q: GuestQuodom) {
  localStorage.setItem(KEY, JSON.stringify(q));
}

export function setGuestDescripcion(descripcion: string): void {
  const q = getGuestQuodom();
  q.descripcion = descripcion;
  save(q);
}

function sameLine(a: GuestLine, b: GuestLine): boolean {
  return a.idproducto === b.idproducto
    && (a.atributo1 ?? '') === (b.atributo1 ?? '')
    && (a.atributo2 ?? '') === (b.atributo2 ?? '');
}

export function addGuestLine(line: GuestLine): void {
  const q = getGuestQuodom();
  const idx = q.lines.findIndex(l => sameLine(l, line));
  if (idx >= 0) {
    q.lines[idx].cantidad += line.cantidad;
  } else {
    q.lines.push({ ...line });
  }
  save(q);
}

export function updateGuestLineCantidad(index: number, cantidad: number): void {
  const q = getGuestQuodom();
  if (index < 0 || index >= q.lines.length) return;
  if (cantidad <= 0) q.lines.splice(index, 1);
  else q.lines[index].cantidad = cantidad;
  save(q);
}

export function updateGuestLineAtributos(index: number, patch: { atributo1?: string; atributo2?: string }): void {
  const q = getGuestQuodom();
  if (index < 0 || index >= q.lines.length) return;
  q.lines[index] = { ...q.lines[index], ...patch };
  save(q);
}

export function removeGuestLine(index: number): void {
  const q = getGuestQuodom();
  if (index < 0 || index >= q.lines.length) return;
  q.lines.splice(index, 1);
  save(q);
}

export function clearGuestQuodom(): void {
  localStorage.removeItem(KEY);
}

export function guestLineCount(): number {
  return getGuestQuodom().lines.length;
}
