/** Una pestaña en px, medida desde el comienzo de la fila (no de lo visible). */
export type Tramo = { inicio: number; fin: number };

/**
 * Hasta dónde mostrar la fila de subcategorías para que ninguna pestaña se vea
 * partida (lo pidió el usuario: deslizarlas está bien, ver una cortada a la
 * mitad en la primera impresión no). Devuelve, en px desde el borde izquierdo
 * de lo visible:
 *
 * - `izq`: hasta dónde ocultar a la izquierda (0 si no hay ninguna cortada ahí).
 * - `der`: desde dónde ocultar a la derecha, o `null` si todo lo que sigue entra.
 *   Cuando hay más a la derecha deja `reserva` px libres para la flecha: si la
 *   cortada asoma menos que eso, se oculta también la anterior.
 */
export function cortesDeTabs(tabs: Tramo[], desplazado: number, ancho: number, reserva = 28): { izq: number; der: number | null } {
  const borde = desplazado + ancho;
  const cortadaIzq = tabs.find(t => t.inicio < desplazado && t.fin > desplazado);
  const izq = cortadaIzq ? cortadaIzq.fin - desplazado : 0;
  if (tabs.every(t => t.fin <= borde)) return { izq, der: null };
  const primeraOculta = tabs.find(t => t.fin > borde - reserva);
  return { izq, der: primeraOculta ? Math.max(0, primeraOculta.inicio - desplazado) : null };
}
