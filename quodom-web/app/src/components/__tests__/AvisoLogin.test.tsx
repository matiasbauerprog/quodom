import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AvisoLogin } from '../AvisoLogin';

function montar(onClose = vi.fn()) {
  render(<MemoryRouter><AvisoLogin onClose={onClose} /></MemoryRouter>);
  return onClose;
}

// Era un renglón al costado de la conversación y se perdía entre los mensajes.
describe('AvisoLogin', () => {
  it('interrumpe como diálogo y linkea al login', () => {
    montar();

    expect(screen.getByRole('dialog')).toHaveTextContent(/necesitás iniciar sesión/i);
    expect(screen.getByRole('link', { name: /iniciar sesión/i })).toHaveAttribute('href', '/login');
  });

  it('se puede cerrar sin ir a ningún lado', () => {
    const onClose = montar();

    fireEvent.click(screen.getByRole('button', { name: /ahora no/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it('cierra con Escape', () => {
    const onClose = montar();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });
});
