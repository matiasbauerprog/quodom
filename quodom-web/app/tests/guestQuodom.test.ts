import { beforeEach, describe, expect, it } from 'vitest';
import {
  getGuestQuodom, setGuestDescripcion, addGuestLine,
  updateGuestLineCantidad, updateGuestLineAtributos,
  removeGuestLine, clearGuestQuodom, guestLineCount
} from '../src/guest/guestQuodom';

describe('guestQuodom', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty and returns a fresh quodom', () => {
    const q = getGuestQuodom();
    expect(q.lines).toEqual([]);
    expect(q.descripcion).toBe('');
  });

  it('adds lines and counts them', () => {
    addGuestLine({ idproducto: 100, nombreProducto: 'Latex 20L', cantidad: 2, nombreAtributo1: 'Color' });
    addGuestLine({ idproducto: 101, nombreProducto: 'Rodillo', cantidad: 1 });
    expect(guestLineCount()).toBe(2);
    expect(getGuestQuodom().lines).toHaveLength(2);
  });

  it('merges same-product lines by summing cantidad when attributes match', () => {
    addGuestLine({ idproducto: 100, nombreProducto: 'Latex', cantidad: 2 });
    addGuestLine({ idproducto: 100, nombreProducto: 'Latex', cantidad: 3 });
    const q = getGuestQuodom();
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0].cantidad).toBe(5);
  });

  it('keeps separate lines when attributes differ', () => {
    addGuestLine({ idproducto: 100, nombreProducto: 'Latex', cantidad: 1, atributo1: 'Rojo' });
    addGuestLine({ idproducto: 100, nombreProducto: 'Latex', cantidad: 1, atributo1: 'Azul' });
    expect(getGuestQuodom().lines).toHaveLength(2);
  });

  it('updates a line cantidad', () => {
    addGuestLine({ idproducto: 100, nombreProducto: 'Latex', cantidad: 1 });
    updateGuestLineCantidad(0, 7);
    expect(getGuestQuodom().lines[0].cantidad).toBe(7);
  });

  it('removes a line when cantidad drops to 0', () => {
    addGuestLine({ idproducto: 100, nombreProducto: 'Latex', cantidad: 3 });
    updateGuestLineCantidad(0, 0);
    expect(getGuestQuodom().lines).toEqual([]);
  });

  it('updates attributes without duplicating', () => {
    addGuestLine({ idproducto: 100, nombreProducto: 'Latex', cantidad: 1 });
    updateGuestLineAtributos(0, { atributo1: 'Rojo' });
    expect(getGuestQuodom().lines[0].atributo1).toBe('Rojo');
  });

  it('removes a line by index', () => {
    addGuestLine({ idproducto: 100, nombreProducto: 'A', cantidad: 1 });
    addGuestLine({ idproducto: 101, nombreProducto: 'B', cantidad: 1 });
    removeGuestLine(0);
    const q = getGuestQuodom();
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0].idproducto).toBe(101);
  });

  it('sets descripcion', () => {
    setGuestDescripcion('Pintura living');
    expect(getGuestQuodom().descripcion).toBe('Pintura living');
  });

  it('clears everything', () => {
    setGuestDescripcion('X');
    addGuestLine({ idproducto: 1, nombreProducto: 'a', cantidad: 1 });
    clearGuestQuodom();
    expect(getGuestQuodom()).toEqual({ descripcion: '', lines: [] });
  });
});
