import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAgregarProducto } from '../useAgregarProducto';
import * as agregarModule from '../agregarProducto';

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1' } })
}));

function Probe() {
  const { agregar, pendiente, confirmar } = useAgregarProducto();
  return (
    <div>
      <button onClick={() => agregar({ idproducto: 700, nombreProducto: 'Gaseosa', cantidad: 1 }, 7)}>agregar</button>
      {pendiente && <button onClick={confirmar}>confirmar rubro {pendiente.idrubro}</button>}
    </div>
  );
}

describe('useAgregarProducto', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('exposes the pending line when the rubro needs confirmation', async () => {
    vi.spyOn(agregarModule, 'agregarProducto').mockResolvedValue({ estado: 'necesita_confirmacion', idrubro: 7 });
    render(<Probe />);

    fireEvent.click(screen.getByText('agregar'));

    await waitFor(() => expect(screen.getByText('confirmar rubro 7')).toBeInTheDocument());
  });

  it('clears the pending line after confirming', async () => {
    vi.spyOn(agregarModule, 'agregarProducto').mockResolvedValue({ estado: 'necesita_confirmacion', idrubro: 7 });
    const confirmarSpy = vi.spyOn(agregarModule, 'confirmarYAgregar').mockResolvedValue({ idquodom: 'q-new' });
    render(<Probe />);

    fireEvent.click(screen.getByText('agregar'));
    await waitFor(() => screen.getByText('confirmar rubro 7'));
    fireEvent.click(screen.getByText('confirmar rubro 7'));

    await waitFor(() => expect(screen.queryByText(/confirmar rubro/)).not.toBeInTheDocument());
    expect(confirmarSpy).toHaveBeenCalled();
  });

  it('does not ask when the line was added straight away', async () => {
    vi.spyOn(agregarModule, 'agregarProducto').mockResolvedValue({ estado: 'agregado', idquodom: 'q-7' });
    render(<Probe />);

    fireEvent.click(screen.getByText('agregar'));

    await waitFor(() => expect(screen.queryByText(/confirmar rubro/)).not.toBeInTheDocument());
  });
});
