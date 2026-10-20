/**
 * El CUIT viaja en el pedido para que el proveedor facture, así que tiene una
 * sola forma: once dígitos con los guiones de siempre (`30-71234567-8`).
 *
 * El servidor valida lo mismo (patrón en `openapi.yaml`); esto está para que el
 * usuario lo vea armado mientras escribe y se entere antes de guardar.
 */
export const CUIT_DIGITOS = 11;

/** Lo que se tipea, con los guiones puestos y cortado en once dígitos. */
export function formatearCuit(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, CUIT_DIGITOS);
  if (d.length <= 2) return d;
  if (d.length <= 10) return d.slice(0, 2) + '-' + d.slice(2);
  return d.slice(0, 2) + '-' + d.slice(2, 10) + '-' + d.slice(10);
}

/** Vacío vale: es como se borra. */
export function cuitValido(valor: string): boolean {
  const n = valor.replace(/\D/g, '').length;
  return n === 0 || n === CUIT_DIGITOS;
}
