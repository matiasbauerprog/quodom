import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DialogoNuevoRubro } from '../DialogoNuevoRubro';

describe('DialogoNuevoRubro', () => {
  it('confirms opening a quodom for the rubro on click', () => {
    const onConfirmar = vi.fn();
    render(<DialogoNuevoRubro nombreRubro="Bebidas" onConfirmar={onConfirmar} onCancelar={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /crear quodom de bebidas/i }));

    expect(onConfirmar).toHaveBeenCalledTimes(1);
  });

  it('cancels on Escape', () => {
    const onCancelar = vi.fn();
    render(<DialogoNuevoRubro nombreRubro="Bebidas" onConfirmar={vi.fn()} onCancelar={onCancelar} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onCancelar).toHaveBeenCalledTimes(1);
  });

  it('cancels on a backdrop click but not on a click inside the dialog', () => {
    const onCancelar = vi.fn();
    render(<DialogoNuevoRubro nombreRubro="Bebidas" onConfirmar={vi.fn()} onCancelar={onCancelar} />);

    fireEvent.click(screen.getByRole('dialog'));
    expect(onCancelar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onCancelar).toHaveBeenCalledTimes(1);
  });

  it('disables both actions and ignores Escape/backdrop while busy', () => {
    const onConfirmar = vi.fn();
    const onCancelar = vi.fn();
    render(<DialogoNuevoRubro nombreRubro="Bebidas" onConfirmar={onConfirmar} onCancelar={onCancelar} ocupado />);

    expect(screen.getByRole('button', { name: /cancelar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /creando/i })).toBeDisabled();

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);

    expect(onCancelar).not.toHaveBeenCalled();
    expect(onConfirmar).not.toHaveBeenCalled();
  });
});
