export const RUBROS: Record<number, string> = {
  1: 'Limpieza',
  2: 'Librería',
  3: 'Papelera',
  4: 'Construcción',
  5: 'Pintura',
  6: 'Sanitarios',
  7: 'Bebidas',
  8: 'Seguridad Industrial'
};

export function nombreRubro(idrubro: number): string {
  return RUBROS[idrubro] ?? 'ese rubro';
}
