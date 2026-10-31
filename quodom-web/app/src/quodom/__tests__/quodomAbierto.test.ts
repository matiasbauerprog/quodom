import { describe, it, expect, beforeEach, vi } from 'vitest';
import { leerAbiertos, abiertoDe, abrirQuodom, cerrarQuodom, sanearAbiertos, leerUsos, marcarUso } from '../quodomAbierto';

beforeEach(() => { localStorage.clear(); });

describe('quodomAbierto', () => {
  it('arranca sin nada abierto', () => {
    expect(leerAbiertos()).toEqual({});
    expect(abiertoDe(5)).toBeNull();
  });

  it('cada rubro se acuerda del suyo', () => {
    abrirQuodom(5, 'q-pintura');
    abrirQuodom(1, 'q-limpieza');

    expect(abiertoDe(5)).toBe('q-pintura');
    expect(abiertoDe(1)).toBe('q-limpieza');
  });

  it('abrir otro del mismo rubro reemplaza al anterior', () => {
    abrirQuodom(5, 'q-casa');
    abrirQuodom(5, 'q-depto');

    expect(abiertoDe(5)).toBe('q-depto');
  });

  it('cerrar deja el rubro sin ninguno', () => {
    abrirQuodom(5, 'q-casa');
    cerrarQuodom(5);

    expect(abiertoDe(5)).toBeNull();
  });

  it('avisa con quodom:abierto cuando algo cambia', () => {
    const escuchado = vi.fn();
    window.addEventListener('quodom:abierto', escuchado);

    abrirQuodom(5, 'q-casa');

    expect(escuchado).toHaveBeenCalled();
    window.removeEventListener('quodom:abierto', escuchado);
  });

  // Review Focus 1: el Quodom se borró o se envió en otra pestaña.
  it('sanear descarta el que ya no está vivo', () => {
    abrirQuodom(5, 'q-borrado');
    abrirQuodom(1, 'q-vivo');

    sanearAbiertos(['q-vivo']);

    expect(abiertoDe(5)).toBeNull();
    expect(abiertoDe(1)).toBe('q-vivo');
  });

  // Review Focus 2: ventana privada, datos bloqueados.
  it('no explota si localStorage falla', () => {
    const roto = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });

    expect(() => leerAbiertos()).not.toThrow();
    expect(abiertoDe(5)).toBeNull();

    roto.mockRestore();
  });

  it('descarta un payload con forma inesperada', () => {
    localStorage.setItem('quodom.abierto', '["no", "es", "un", "mapa"]');

    expect(leerAbiertos()).toEqual({});
  });
});

describe('usos', () => {
  it('abrir un Quodom lo marca como usado', () => {
    abrirQuodom(5, 'q1');
    expect(leerUsos().q1).toEqual(expect.any(Number));
  });

  it('sanear olvida el uso de los que ya no están en armado', () => {
    marcarUso('vivo', 1); marcarUso('enviado', 2);
    sanearAbiertos(['vivo']);
    expect(leerUsos()).toEqual({ vivo: 1 });
  });

  it('ignora basura en localStorage', () => {
    localStorage.setItem('quodom.usos', '{"a":"x","b":3}');
    expect(leerUsos()).toEqual({ b: 3 });
    localStorage.setItem('quodom.usos', 'no-json');
    expect(leerUsos()).toEqual({});
  });
});
