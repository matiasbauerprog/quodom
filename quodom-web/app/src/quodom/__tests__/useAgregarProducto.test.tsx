import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAgregarProducto } from '../useAgregarProducto';
import * as agregarModule from '../agregarProducto';
import type { Quodom } from '../../api/types';

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1' } })
}));

const CASA = { id: 'q-casa', descripcion: 'Casa', idrubro: 7 } as unknown as Quodom;

function Probe() {
  const { agregar, destino, elegir, crear, cancelar, error } = useAgregarProducto();
  return (
    <div>
      <button onClick={() => agregar({ idproducto: 700, nombreProducto: 'Gaseosa', cantidad: 1 }, 7)}>agregar</button>
      <button onClick={() => agregar({ idproducto: 701, nombreProducto: 'Agua', cantidad: 1 }, 7)}>agregar otro</button>
      <button onClick={cancelar}>cancelar</button>
      {error && <p role="alert">{error}</p>}
      {destino && <button onClick={() => elegir('q-casa')}>elegir rubro {destino.idrubro}</button>}
      {destino && <button onClick={crear}>crear</button>}
    </div>
  );
}

describe('useAgregarProducto', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('exposes the destination when the rubro has no open quodom', async () => {
    vi.spyOn(agregarModule, 'agregarProducto').mockResolvedValue({ estado: 'elegir_destino', idrubro: 7, candidatos: [CASA] });
    render(<Probe />);

    fireEvent.click(screen.getByText('agregar'));

    await waitFor(() => expect(screen.getByText('elegir rubro 7')).toBeInTheDocument());
  });

  it('clears the destination after choosing one', async () => {
    vi.spyOn(agregarModule, 'agregarProducto').mockResolvedValue({ estado: 'elegir_destino', idrubro: 7, candidatos: [CASA] });
    const spy = vi.spyOn(agregarModule, 'agregarADestino').mockResolvedValue();
    render(<Probe />);

    fireEvent.click(screen.getByText('agregar'));
    await waitFor(() => screen.getByText('elegir rubro 7'));
    fireEvent.click(screen.getByText('elegir rubro 7'));

    await waitFor(() => expect(screen.queryByText(/elegir rubro/)).not.toBeInTheDocument());
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ idproducto: 700 }), 7, 'q-casa');
  });

  it('creates a new quodom from the destination', async () => {
    vi.spyOn(agregarModule, 'agregarProducto').mockResolvedValue({ estado: 'elegir_destino', idrubro: 7, candidatos: [] });
    const spy = vi.spyOn(agregarModule, 'crearYAgregar').mockResolvedValue('q-new');
    render(<Probe />);

    fireEvent.click(screen.getByText('agregar'));
    await waitFor(() => screen.getByText('crear'));
    fireEvent.click(screen.getByText('crear'));

    await waitFor(() => expect(screen.queryByText('crear')).not.toBeInTheDocument());
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ idproducto: 700 }), 7, 'Mi Quodom');
  });

  it('does not ask when the line was added straight away', async () => {
    vi.spyOn(agregarModule, 'agregarProducto').mockResolvedValue({ estado: 'agregado', idquodom: 'q-7' });
    render(<Probe />);

    fireEvent.click(screen.getByText('agregar'));

    await waitFor(() => expect(screen.queryByText(/elegir rubro/)).not.toBeInTheDocument());
  });

  // Sin ningún abierto, dos "+" seguidos: el destino elegido recibe los dos.
  it('queues two adds made before choosing and sends both to the chosen destination', async () => {
    vi.spyOn(agregarModule, 'agregarProducto').mockResolvedValue({ estado: 'elegir_destino', idrubro: 7, candidatos: [CASA] });
    const spy = vi.spyOn(agregarModule, 'agregarADestino').mockResolvedValue();
    render(<Probe />);

    fireEvent.click(screen.getByText('agregar'));
    fireEvent.click(screen.getByText('agregar otro'));
    await waitFor(() => screen.getByText('elegir rubro 7'));
    await waitFor(() => expect(agregarModule.agregarProducto).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByText('elegir rubro 7'));

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    const ids = spy.mock.calls.map(c => c[0].idproducto).sort();
    expect(ids).toEqual([700, 701]);
    await waitFor(() => expect(screen.queryByText(/elegir rubro/)).not.toBeInTheDocument());
  });

  it('creates once and puts the rest of the queue in the new quodom', async () => {
    vi.spyOn(agregarModule, 'agregarProducto').mockResolvedValue({ estado: 'elegir_destino', idrubro: 7, candidatos: [] });
    const crearSpy = vi.spyOn(agregarModule, 'crearYAgregar').mockResolvedValue('q-new');
    const destinoSpy = vi.spyOn(agregarModule, 'agregarADestino').mockResolvedValue();
    render(<Probe />);

    fireEvent.click(screen.getByText('agregar'));
    fireEvent.click(screen.getByText('agregar otro'));
    await waitFor(() => expect(agregarModule.agregarProducto).toHaveBeenCalledTimes(2));
    await waitFor(() => screen.getByText('crear'));
    fireEvent.click(screen.getByText('crear'));

    await waitFor(() => expect(destinoSpy).toHaveBeenCalledTimes(1));
    expect(crearSpy).toHaveBeenCalledTimes(1);
    expect(destinoSpy).toHaveBeenCalledWith(expect.objectContaining({ idproducto: 701 }), 7, 'q-new');
  });

  it('cancel discards the whole queue', async () => {
    vi.spyOn(agregarModule, 'agregarProducto').mockResolvedValue({ estado: 'elegir_destino', idrubro: 7, candidatos: [CASA] });
    render(<Probe />);

    fireEvent.click(screen.getByText('agregar'));
    fireEvent.click(screen.getByText('agregar otro'));
    await waitFor(() => expect(agregarModule.agregarProducto).toHaveBeenCalledTimes(2));
    await waitFor(() => screen.getByText('elegir rubro 7'));
    fireEvent.click(screen.getByText('cancelar'));

    await waitFor(() => expect(screen.queryByText(/elegir rubro/)).not.toBeInTheDocument());
  });

  it('exposes the message and keeps the destination when choosing fails', async () => {
    vi.spyOn(agregarModule, 'agregarProducto').mockResolvedValue({ estado: 'elegir_destino', idrubro: 7, candidatos: [CASA] });
    vi.spyOn(agregarModule, 'agregarADestino').mockRejectedValue(new Error('Falló el servidor'));
    render(<Probe />);

    fireEvent.click(screen.getByText('agregar'));
    await waitFor(() => screen.getByText('elegir rubro 7'));
    fireEvent.click(screen.getByText('elegir rubro 7'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Falló el servidor');
    expect(screen.getByText('elegir rubro 7')).toBeInTheDocument();
  });
});
