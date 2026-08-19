// Nombres de los ocho rubros del catálogo. Cuáles se ofrecen hoy lo decide el
// backend (`api/src/config/rubros.js`): el lanzamiento va con Limpieza,
// Librería, Papelera, Pintura y Bebidas. Los otros tres siguen acá porque un
// Quodom o un carrito viejo de esos rubros todavía necesita su etiqueta.
export const RUBROS: Record<number, string> = {
  1: 'Limpieza',
  2: 'Librería',
  3: 'Papelera',
  4: 'Construcción', // inactivo
  5: 'Pintura',
  6: 'Sanitarios', // inactivo
  7: 'Bebidas',
  8: 'Seguridad Industrial' // inactivo
};

export function nombreRubro(idrubro: number): string {
  return RUBROS[idrubro] ?? 'ese rubro';
}
