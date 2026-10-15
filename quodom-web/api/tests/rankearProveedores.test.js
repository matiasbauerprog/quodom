// quodom-web/api/tests/rankearProveedores.test.js
const { rankear, distanciaKm } = require('../src/helpers/rankearProveedores');

const CENTRO = { lat: -34.5492, lng: -58.5588 }; // Villa Ballester

function cand(nombre, lat, lng, rating, resenas, extra = {}) {
  return { placeid: 'p-' + nombre, nombre, lat, lng, rating, resenas, ...extra };
}

describe('distanciaKm', () => {
  it('mide en kilómetros entre dos puntos', () => {
    // Villa Ballester a Obelisco: ~20 km en línea recta.
    expect(distanciaKm(CENTRO, { lat: -34.6037, lng: -58.3816 })).toBeGreaterThan(15);
    expect(distanciaKm(CENTRO, { lat: -34.6037, lng: -58.3816 })).toBeLessThan(25);
  });

  it('da cero sobre el mismo punto', () => {
    expect(distanciaKm(CENTRO, CENTRO)).toBeCloseTo(0, 5);
  });
});

describe('rankear', () => {
  it('devuelve a lo sumo los pedidos', () => {
    const muchos = Array.from({ length: 12 }, (_, i) =>
      cand('c' + i, CENTRO.lat + i / 1000, CENTRO.lng, 4.5, 50));
    expect(rankear(muchos, CENTRO)).toHaveLength(5);
  });

  it('calcula la distancia de cada uno desde el centro', () => {
    const out = rankear([cand('cerca', CENTRO.lat, CENTRO.lng, 4.5, 50)], CENTRO);
    expect(out[0].distanciaKm).toBeCloseTo(0, 2);
  });

  // La regla: 60% puntuación, 40% cercanía. Un 4,9 a 3 km le gana a un 3,5 a
  // 500 metros, porque el comprador puede ir un poco más lejos pero no puede
  // arreglar un mal proveedor.
  it('prefiere mejor puntuado aunque esté un poco más lejos', () => {
    const out = rankear([
      cand('malo-cerca', CENTRO.lat + 0.004, CENTRO.lng, 3.5, 40),
      cand('bueno-lejos', CENTRO.lat + 0.027, CENTRO.lng, 4.9, 40)
    ], CENTRO);
    expect(out[0].nombre).toBe('bueno-lejos');
  });

  it('a igual puntuación gana el más cercano', () => {
    const out = rankear([
      cand('lejos', CENTRO.lat + 0.05, CENTRO.lng, 4.5, 40),
      cand('cerca', CENTRO.lat + 0.001, CENTRO.lng, 4.5, 40)
    ], CENTRO);
    expect(out[0].nombre).toBe('cerca');
  });

  // Medido: en Limpieza los comercios de barrio tienen 3 a 10 reseñas. Un
  // umbral alto los borra justo a ellos, que son los que el comprador quiere.
  it('descarta los de menos de 3 reseñas cuando hay de sobra', () => {
    const out = rankear([
      cand('con-una', CENTRO.lat, CENTRO.lng, 5, 1),
      cand('a', CENTRO.lat + 0.01, CENTRO.lng, 4.5, 30),
      cand('b', CENTRO.lat + 0.02, CENTRO.lng, 4.4, 30),
      cand('c', CENTRO.lat + 0.03, CENTRO.lng, 4.3, 30)
    ], CENTRO);
    expect(out.map(p => p.nombre)).not.toContain('con-una');
    expect(out).toHaveLength(3);
  });

  // Mostrar uno es peor que mostrar tres con poca reputación y la distancia
  // a la vista: el usuario decide, pero necesita opciones.
  it('reincorpora los descartados si quedan menos de tres', () => {
    const out = rankear([
      cand('con-una', CENTRO.lat, CENTRO.lng, 5, 1),
      cand('con-dos', CENTRO.lat + 0.001, CENTRO.lng, 4, 2),
      cand('bueno', CENTRO.lat + 0.01, CENTRO.lng, 4.5, 30)
    ], CENTRO);
    expect(out).toHaveLength(3);
  });

  it('un comercio sin ninguna reseña se trata como descartado, no como cero', () => {
    const out = rankear([
      cand('sin-rating', CENTRO.lat, CENTRO.lng, undefined, 0),
      cand('a', CENTRO.lat + 0.01, CENTRO.lng, 4.5, 30),
      cand('b', CENTRO.lat + 0.02, CENTRO.lng, 4.4, 30),
      cand('c', CENTRO.lat + 0.03, CENTRO.lng, 4.3, 30)
    ], CENTRO);
    expect(out.map(p => p.nombre)).not.toContain('sin-rating');
  });

  // Review Focus 2: medido, existen. Siguen en la lista.
  it('un proveedor sin teléfono queda en la lista, marcado', () => {
    const out = rankear([
      cand('sin-tel', CENTRO.lat, CENTRO.lng, 4.8, 30, { telefono: null }),
      cand('con-tel', CENTRO.lat + 0.01, CENTRO.lng, 4.0, 30, { telefono: '+5491154812951', esFijo: false })
    ], CENTRO);
    const sinTel = out.find(p => p.nombre === 'sin-tel');
    expect(sinTel).toBeDefined();
    expect(sinTel.sinTelefono).toBe(true);
  });

  // Un 0800 es un teléfono real que no recibe WhatsApp: tiene telefonoVisible
  // pero no telefono. No es lo mismo que no tener teléfono.
  it('un teléfono que no sirve para WhatsApp no cuenta como sin teléfono', () => {
    const out = rankear([
      cand('con-0800', CENTRO.lat, CENTRO.lng, 4.1, 453, { telefono: null, telefonoVisible: '0800-777-7739' }),
      cand('normal', CENTRO.lat + 0.01, CENTRO.lng, 4.0, 30, { telefono: '+5491154812951' })
    ], CENTRO);
    const p = out.find(x => x.nombre === 'con-0800');
    expect(p.sinTelefono).toBe(false);
    expect(p.telefonoVisible).toBe('0800-777-7739');
  });

  it('los reportados sin WhatsApp bajan al final', () => {
    const out = rankear([
      cand('reportado', CENTRO.lat, CENTRO.lng, 5, 100, { sinWhatsapp: true }),
      cand('normal', CENTRO.lat + 0.02, CENTRO.lng, 4.0, 30)
    ], CENTRO);
    expect(out[0].nombre).toBe('normal');
  });

  it('sin candidatos devuelve lista vacía, no explota', () => {
    expect(rankear([], CENTRO)).toEqual([]);
  });
});
