import { describe, it, expect } from 'vitest';
import { ramasDeQuodoms } from '../ramas';
import type { Quodom } from '../../api/types';

const q = (id: string, idrubro: number, extra: Partial<Quodom> = {}) =>
  ({ id, descripcion: id, estado: 'CREADO', nro: 'QD-' + id, idrubro, nombrerubro: null, cantproductos: 1, ...extra }) as unknown as Quodom;

const TODOS = [1, 2, 3, 5, 7];

describe('ramasDeQuodoms', () => {
  it('agrupa los Quodoms por rubro', () => {
    const ramas = ramasDeQuodoms([q('a', 5), q('b', 5), q('c', 1)], TODOS);
    expect(ramas.filter(r => r.quodoms.length > 0)).toHaveLength(2);
    expect(ramas.find(r => r.idrubro === 5)!.quodoms.map(x => x.id)).toEqual(['a', 'b']);
    expect(ramas.find(r => r.idrubro === 1)!.quodoms.map(x => x.id)).toEqual(['c']);
  });

  it('deja afuera los ENVIADO', () => {
    const ramas = ramasDeQuodoms([q('a', 5), q('b', 5, { estado: 'ENVIADO' })], TODOS);
    expect(ramas.find(r => r.idrubro === 5)!.quodoms.map(x => x.id)).toEqual(['a']);
    expect(ramasDeQuodoms([q('b', 5, { estado: 'ENVIADO' })], TODOS).flatMap(r => r.quodoms)).toEqual([]);
  });

  it('usa el nombre del rubro que trae el Quodom, y si es nulo lo calcula', () => {
    const ramas = ramasDeQuodoms([q('a', 5, { nombrerubro: 'Pinturería' }), q('b', 1)], TODOS);
    expect(ramas.find(r => r.idrubro === 5)!.nombre).toBe('Pinturería');
    expect(ramas.find(r => r.idrubro === 1)!.nombre).toBe('Limpieza');
  });

  it('ordena las ramas por idrubro', () => {
    const ramas = ramasDeQuodoms([q('a', 7), q('b', 1), q('c', 5)], TODOS);
    expect(ramas.map(r => r.idrubro)).toEqual([1, 2, 3, 5, 7]);
  });

  it('no ofrece un rubro que ya no está disponible', () => {
    const ramas = ramasDeQuodoms([q('a', 5), q('viejo', 4)], TODOS);
    expect(ramas.map(r => r.idrubro)).toEqual(TODOS);
    expect(ramas.flatMap(r => r.quodoms).map(x => x.id)).not.toContain('viejo');
  });

  it('da una rama vacía a cada rubro disponible sin Quodoms en armado', () => {
    const ramas = ramasDeQuodoms([], TODOS);
    expect(ramas.map(r => r.idrubro)).toEqual(TODOS);
    expect(ramas.every(r => r.quodoms.length === 0)).toBe(true);
    expect(ramas.find(r => r.idrubro === 7)!.nombre).toBe('Bebidas');
  });

  it('pone primero el Quodom usado más recientemente, y debajo el anterior', () => {
    const usos = { b: 2000, c: 1000 };
    const ramas = ramasDeQuodoms([q('a', 5), q('b', 5), q('c', 5)], TODOS, usos);
    // `a` nunca se usó: queda al final, en el orden en que vino.
    expect(ramas.find(r => r.idrubro === 5)!.quodoms.map(x => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('ordena los rubros por su último uso, y los nunca usados por idrubro', () => {
    const ramas = ramasDeQuodoms([q('a', 1), q('b', 5), q('c', 7)], TODOS, { b: 100, c: 200 });
    expect(ramas.map(r => r.idrubro)).toEqual([7, 5, 1, 2, 3]);
  });
});
