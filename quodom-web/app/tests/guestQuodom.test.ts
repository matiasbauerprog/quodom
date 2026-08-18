import { describe, it, expect, beforeEach } from 'vitest';
import {
  addGuestLine, getGuestCart, getGuestQuodoms, clearGuestQuodoms,
  guestLineCount, guestRubrosConLineas, removeGuestLine, updateGuestLineCantidad
} from '../src/guest/guestQuodom';

const GASEOSA = { idproducto: 700, nombreProducto: 'Gaseosa 2L', cantidad: 1 };
const CEMENTO = { idproducto: 400, nombreProducto: 'Cemento 50kg', cantidad: 2 };

describe('guest carts by rubro', () => {
  beforeEach(() => clearGuestQuodoms());

  it('keeps two rubros side by side without mixing them', () => {
    addGuestLine(7, GASEOSA);
    addGuestLine(4, CEMENTO);

    expect(getGuestCart(7).lines).toEqual([GASEOSA]);
    expect(getGuestCart(4).lines).toEqual([CEMENTO]);
    expect(guestRubrosConLineas().sort()).toEqual([4, 7]);
  });

  it('sums the quantity when the same product is added twice to a rubro', () => {
    addGuestLine(7, GASEOSA);
    addGuestLine(7, { ...GASEOSA, cantidad: 3 });
    expect(getGuestCart(7).lines).toHaveLength(1);
    expect(getGuestCart(7).lines[0].cantidad).toBe(4);
  });

  it('keeps separate lines when attributes differ', () => {
    addGuestLine(7, { ...GASEOSA, atributo1: 'Rojo' });
    addGuestLine(7, { ...GASEOSA, atributo1: 'Azul' });
    expect(getGuestCart(7).lines).toHaveLength(2);
    expect(getGuestCart(7).lines[0].atributo1).toBe('Rojo');
    expect(getGuestCart(7).lines[1].atributo1).toBe('Azul');
  });

  it('counts lines per rubro and in total', () => {
    addGuestLine(7, GASEOSA);
    addGuestLine(4, CEMENTO);
    expect(guestLineCount(7)).toBe(1);
    expect(guestLineCount()).toBe(2);
  });

  it('drops a rubro from the map once its last line is removed', () => {
    addGuestLine(7, GASEOSA);
    removeGuestLine(7, 0);
    expect(guestRubrosConLineas()).toEqual([]);
    expect(getGuestQuodoms()[7]).toBeUndefined();
  });

  it('removes the line when the quantity drops to zero', () => {
    addGuestLine(4, CEMENTO);
    updateGuestLineCantidad(4, 0, 0);
    expect(getGuestCart(4).lines).toEqual([]);
  });

  it('discards a legacy single-cart payload instead of crashing', () => {
    localStorage.setItem('quodom.guest', JSON.stringify({ descripcion: 'viejo', lines: [GASEOSA] }));
    expect(getGuestQuodoms()).toEqual({});
  });

  it('discards a map with a non-numeric key instead of crashing', () => {
    localStorage.setItem('quodom.guest', JSON.stringify({ foo: { descripcion: '', lines: [] } }));
    expect(getGuestQuodoms()).toEqual({});
    expect(() => guestRubrosConLineas()).not.toThrow();
    expect(guestRubrosConLineas()).toEqual([]);
  });
});
