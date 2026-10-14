import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DialogoDestino } from '../DialogoDestino';
import type { Quodom } from '../../api/types';

const CASA = { id: 'q-casa', descripcion: 'Casa', cantproductos: 3, idrubro: 5 } as unknown as Quodom;
const DEPTO = { id: 'q-depto', descripcion: 'Depto', cantproductos: 1, idrubro: 5 } as unknown as Quodom;

function montar(extra: Partial<Parameters<typeof DialogoDestino>[0]> = {}) {
  const props = {
    nombreRubro: 'Pintura', candidatos: [CASA, DEPTO],
    onElegir: vi.fn(), onCrear: vi.fn(), onCancelar: vi.fn(), ...extra
  };
  render(<DialogoDestino {...props} />);
  return props;
}

describe('DialogoDestino', () => {
  it('elige un Quodom existente', () => {
    const p = montar();
    fireEvent.click(screen.getByRole('button', { name: /depto/i }));
    expect(p.onElegir).toHaveBeenCalledWith('q-depto');
  });

  it('ofrece un Quodom nuevo del rubro', () => {
    const p = montar();
    fireEvent.click(screen.getByRole('button', { name: /un quodom nuevo de pintura/i }));
    expect(p.onCrear).toHaveBeenCalledTimes(1);
  });

  it('sin candidatos ofrece sólo crear', () => {
    montar({ candidatos: [] });
    expect(screen.getByRole('button', { name: /un quodom nuevo de pintura/i })).toBeInTheDocument();
  });

  it('cancela con Escape y con el fondo, pero no con un click adentro', () => {
    const p = montar();
    fireEvent.click(screen.getByRole('dialog'));
    expect(p.onCancelar).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(p.onCancelar).toHaveBeenCalledTimes(2);
  });

  it('ocupado deshabilita todo e ignora Escape', () => {
    const p = montar({ ocupado: true });
    screen.getAllByRole('button').forEach(b => expect(b).toBeDisabled());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(p.onCancelar).not.toHaveBeenCalled();
  });
});
