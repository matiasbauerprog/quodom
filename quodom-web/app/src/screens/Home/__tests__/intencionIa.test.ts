import { describe, it, expect } from 'vitest';
import { intencionIa } from '../intencionIa';

// Quienes probaron la app escribieron en el buscador lo que hay que escribirle
// al Modo IA (2026-10-29). Estas reglas deciden cuándo ofrecerlo destacado.
describe('intencionIa', () => {
  it.each([
    'latex blanco',
    'rodillo',
    'Latex Interior Blanco Mate',
    'rodillo para techo',
    'agua 500ml',
  ])('"%s" es una búsqueda de producto', texto => {
    expect(intencionIa(texto, 5)).toBe('busqueda');
  });

  it.each([
    'quiero pintar mi casa',
    'necesito limpiar la oficina',
    'cuanto latex necesito',
    '¿Cuántos litros van en una pared?',
    'pintura para 3 ambientes',
    'bebidas para un cumpleaños de 20 personas',
    'tengo que pintar un depto de 50 m2',
    'me recomendás algo para el baño',
    'organizar una fiesta',
  ])('"%s" es un pedido para el asistente', texto => {
    expect(intencionIa(texto, 5)).toBe('pedido');
  });

  // Lo más claro: escribió algo que el catálogo no tiene como producto.
  it('dos palabras o más sin ningún resultado es un pedido', () => {
    expect(intencionIa('pintar casa', 0)).toBe('pedido');
  });

  it('una palabra sola sin resultados sigue siendo una búsqueda: puede ser un error de tipeo', () => {
    expect(intencionIa('ladex', 0)).toBe('busqueda');
  });

  it('una frase larga es un pedido aunque no use ninguna de esas palabras', () => {
    expect(intencionIa('pinturas y rodillos y pinceles y cinta', 5)).toBe('pedido');
  });
});
