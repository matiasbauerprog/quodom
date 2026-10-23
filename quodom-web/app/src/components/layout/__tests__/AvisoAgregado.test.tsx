import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AvisoAgregado } from '../AvisoAgregado';
import type { RamaRubro } from '../ArbolQuodoms';

const RAMAS = [{ idrubro: 5, quodoms: [{ id: 'q-1', descripcion: 'Casa' }, { id: 'q-2', descripcion: 'Oficina' }] }] as unknown as RamaRubro[];

function agregado(nombre: string, idquodom: string | null = 'q-1', idrubro = 5) {
  act(() => { window.dispatchEvent(new CustomEvent('quodom:agregado', { detail: { nombre, idrubro, idquodom } })); });
}

afterEach(() => { vi.useRealTimers(); });

describe('AvisoAgregado', () => {
  it('uno solo nombra el producto', () => {
    render(<AvisoAgregado ramas={RAMAS} />);
    agregado('Latex Interior');
    expect(screen.getByRole('status')).toHaveTextContent('Latex Interior agregado a Casa');
  });

  // Agregar una selección de varios dispara un aviso por producto: antes
  // quedaba nombrado sólo el último, y parecía que había entrado uno solo.
  it('varios seguidos al mismo Quodom se cuentan', () => {
    render(<AvisoAgregado ramas={RAMAS} />);
    agregado('Latex Interior');
    agregado('Rodillo');
    agregado('Pincel');
    expect(screen.getByRole('status')).toHaveTextContent('3 productos agregados a Casa');
  });

  it('a otro Quodom vuelve a contar desde uno', () => {
    render(<AvisoAgregado ramas={RAMAS} />);
    agregado('Latex Interior');
    agregado('Rodillo', 'q-2');
    expect(screen.getByRole('status')).toHaveTextContent('Rodillo agregado a Oficina');
  });

  it('pasado el aviso, el siguiente cuenta desde uno', () => {
    vi.useFakeTimers();
    render(<AvisoAgregado ramas={RAMAS} />);
    agregado('Latex Interior');
    act(() => { vi.advanceTimersByTime(4000); });
    agregado('Rodillo');
    expect(screen.getByRole('status')).toHaveTextContent('Rodillo agregado a Casa');
  });
});
