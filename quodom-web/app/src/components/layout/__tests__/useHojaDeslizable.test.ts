import { describe, it, expect } from 'vitest';
import { decidirFinal, quienTomaElGesto } from '../useHojaDeslizable';

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

// Deslizar el contenido de la hoja la cierra, pero sin robarle el scroll a la lista.
describe('quienTomaElGesto', () => {
  it('con la lista arriba de todo, bajar el dedo mueve la hoja', () => {
    expect(quienTomaElGesto(0, 2, 30)).toBe('hoja');
  });
  it('con la lista scrolleada, bajar el dedo es scroll', () => {
    expect(quienTomaElGesto(120, 0, 30)).toBe('scroll');
  });
  it('subir el dedo es scroll, aunque esté arriba de todo', () => {
    expect(quienTomaElGesto(0, 0, -30)).toBe('scroll');
  });
  it('un gesto más horizontal que vertical no es de la hoja', () => {
    expect(quienTomaElGesto(0, 40, 20)).toBe('scroll');
  });
  it('mientras no pasa el umbral, todavía no decide', () => {
    expect(quienTomaElGesto(0, 2, 3)).toBeNull();
  });
});
