import { describe, it, expect } from 'vitest';
import { decidirFinal } from '../useHojaDeslizable';

// Soltada a mitad de camino, la hoja termina hacia donde iba: un gesto rápido
// manda por su dirección; uno lento, por cuánto quedó a la vista.
describe('decidirFinal', () => {
  it('un tirón hacia arriba la abre aunque haya subido poco', () => {
    expect(decidirFinal(-200, -0.8, 400, false)).toBe(true);
  });
  it('un tirón hacia abajo la cierra aunque haya bajado poco', () => {
    expect(decidirFinal(30, 0.9, 400, true)).toBe(false);
  });
  it('lenta y más de la mitad a la vista, queda abierta', () => {
    expect(decidirFinal(-250, 0.1, 400, false)).toBe(true);
    expect(decidirFinal(100, 0.1, 400, true)).toBe(true);
  });
  it('lenta y menos de la mitad a la vista, se cierra', () => {
    expect(decidirFinal(260, 0.1, 400, true)).toBe(false);
    expect(decidirFinal(-150, -0.1, 400, false)).toBe(false);
  });
});
