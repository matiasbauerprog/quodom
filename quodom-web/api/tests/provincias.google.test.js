const { idProvinciaDesdeGoogle, IDS_PROVINCIA } = require('../src/config/provinciasGoogle');

describe('idProvinciaDesdeGoogle', () => {
  it('matchea el nombre tal como lo devuelve Google', () => {
    expect(idProvinciaDesdeGoogle('Buenos Aires')).toBe(1);
    expect(idProvinciaDesdeGoogle('Córdoba')).toBe(6);
    expect(idProvinciaDesdeGoogle('Santiago del Estero')).toBe(22);
  });

  // Google alterna acentos y mayúsculas según el idioma pedido; nuestra tabla
  // no puede depender de eso.
  it('ignora acentos, mayúsculas y espacios de más', () => {
    expect(idProvinciaDesdeGoogle('cordoba')).toBe(6);
    expect(idProvinciaDesdeGoogle('  NEUQUÉN  ')).toBe(15);
    expect(idProvinciaDesdeGoogle('Entre Rios')).toBe(8);
  });

  // Las dos que de verdad difieren del nombre de nuestra tabla.
  it('resuelve CABA y Tierra del Fuego, que Google nombra distinto', () => {
    expect(idProvinciaDesdeGoogle('Ciudad Autónoma de Buenos Aires')).toBe(2);
    expect(idProvinciaDesdeGoogle('CABA')).toBe(2);
    expect(idProvinciaDesdeGoogle('Capital Federal')).toBe(2);
    expect(idProvinciaDesdeGoogle('Tierra del Fuego, Antártida e Islas del Atlántico Sur')).toBe(23);
    expect(idProvinciaDesdeGoogle('Tierra del Fuego')).toBe(23);
  });

  it('devuelve null para lo que no es una provincia argentina', () => {
    expect(idProvinciaDesdeGoogle('São Paulo')).toBeNull();
    expect(idProvinciaDesdeGoogle('')).toBeNull();
    expect(idProvinciaDesdeGoogle(null)).toBeNull();
    expect(idProvinciaDesdeGoogle(undefined)).toBeNull();
  });

  // Guarda de completitud: si alguien agrega un alias y se come un id, esto
  // falla. Los ids son los de la tabla `provincias` de la base.
  it('cubre las 24 provincias, sin huecos ni ids de más', () => {
    expect([...IDS_PROVINCIA].sort((a, b) => a - b))
      .toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });
});
