// quodom-web/api/tests/rubrosPlaces.test.js
const { terminoDeRubro, TERMINOS } = require('../src/config/rubrosPlaces');
const { RUBROS_ACTIVOS } = require('../src/config/rubros');

describe('terminoDeRubro', () => {
  // Medidos contra Places el 2026-10-15 sobre Villa Ballester; cada uno trajo
  // comercios reales del rubro. Cambiarlos es la perilla de calibración.
  it('devuelve el término medido de cada rubro', () => {
    expect(terminoDeRubro(1)).toBe('artículos de limpieza');
    expect(terminoDeRubro(2)).toBe('librería');
    expect(terminoDeRubro(3)).toBe('papelera artículos de papelería');
    expect(terminoDeRubro(5)).toBe('pinturería');
    expect(terminoDeRubro(7)).toBe('distribuidora de bebidas');
  });

  it('acepta el id como string, que es como llega de los params', () => {
    expect(terminoDeRubro('5')).toBe('pinturería');
  });

  it('devuelve null para un rubro que no tiene término', () => {
    expect(terminoDeRubro(4)).toBeNull();
    expect(terminoDeRubro(999)).toBeNull();
    expect(terminoDeRubro(null)).toBeNull();
  });

  // Si alguien activa un rubro y se olvida de medirle el término, el selector
  // quedaría mudo en ese rubro sin que nada falle. Esto lo hace fallar acá.
  it('todo rubro activo tiene su término', () => {
    const sinTermino = RUBROS_ACTIVOS.filter(id => !TERMINOS[id]);
    expect(sinTermino).toEqual([]);
  });
});
