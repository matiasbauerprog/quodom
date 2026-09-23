import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DialogoConflictoRubro } from '../DialogoConflictoRubro';
import type { ConflictoRubro } from '../migrateGuestQuodom';

const CONFLICTO = {
  idrubro: 7,
  quodomExistente: {
    id: 'q-7', descripcion: 'Bebidas oficina', estado: 'CREADO', nro: 'QD-7',
    idrubro: 7, nombrerubro: 'Bebidas', cantproductos: 3, createdBy: 'u-1', iddireccion: null
  },
  lineasInvitado: 2
} as unknown as ConflictoRubro;

describe('DialogoConflictoRubro', () => {
  it('sin permitirCancelar no hay tercera salida ni Escape', () => {
    const onElegir = vi.fn();
    render(<DialogoConflictoRubro conflicto={CONFLICTO} onElegir={onElegir} />);

    expect(screen.queryByRole('button', { name: /ahora no/i })).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onElegir).not.toHaveBeenCalled();
  });

  it('con permitirCancelar vuelve a ofrecer la salida, con su etiqueta', () => {
    const onElegir = vi.fn();
    render(
      <DialogoConflictoRubro
        conflicto={CONFLICTO}
        onElegir={onElegir}
        permitirCancelar
        etiquetaCancelar="Continuar sin integrar"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /continuar sin integrar/i }));
    expect(onElegir).toHaveBeenCalledWith(null);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onElegir).toHaveBeenCalledTimes(2);
  });

  it('elegir una acción la propaga', () => {
    const onElegir = vi.fn();
    render(<DialogoConflictoRubro conflicto={CONFLICTO} onElegir={onElegir} />);

    fireEvent.click(screen.getByRole('button', { name: /sumar todo a ese quodom/i }));
    expect(onElegir).toHaveBeenCalledWith('integrar');
  });
});
