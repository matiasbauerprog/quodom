import { getGuestCart, guestRubrosConLineas } from './guestQuodom';
import { nombreRubro } from '../quodom/rubros';

// Un carrito de invitado, resumido igual que un Quodom del servidor para que
// el sidebar y la barra inferior lo puedan listar al lado de los reales.
export type ResumenInvitado = {
  idrubro: number;
  nombreRubro: string;
  descripcion: string;
  cantproductos: number;
};

export function resumenCarritosInvitado(): ResumenInvitado[] {
  return guestRubrosConLineas().map(idrubro => {
    const cart = getGuestCart(idrubro);
    return {
      idrubro,
      nombreRubro: nombreRubro(idrubro),
      descripcion: cart.descripcion.trim() || 'Carrito',
      cantproductos: cart.lines.length
    };
  });
}
