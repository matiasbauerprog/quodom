import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAgregarProducto } from '../useAgregarProducto';
import * as agregarModule from '../agregarProducto';
import type { Quodom } from '../../api/types';
import { quodom as quodomApi } from '../../api/quodom';
import { abrirQuodom } from '../quodomAbierto';

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

  it('retry after a partial failure only adds what is still pending', async () => {
    vi.spyOn(agregarModule, 'agregarProducto').mockResolvedValue({ estado: 'elegir_destino', idrubro: 7, candidatos: [CASA] });
    let fallo = true;
    const spy = vi.spyOn(agregarModule, 'agregarADestino').mockImplementation(async line => {
      if (line.idproducto === 701 && fallo) { fallo = false; throw new Error('Falló el servidor'); }
    });
    render(<Probe />);

    fireEvent.click(screen.getByText('agregar'));
    fireEvent.click(screen.getByText('agregar otro'));
    await waitFor(() => expect(agregarModule.agregarProducto).toHaveBeenCalledTimes(2));
    await waitFor(() => screen.getByText('elegir rubro 7'));
    fireEvent.click(screen.getByText('elegir rubro 7'));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByText('elegir rubro 7'));

    await waitFor(() => expect(screen.queryByText(/elegir rubro/)).not.toBeInTheDocument());
    const ids = spy.mock.calls.map(c => c[0].idproducto);
    expect(ids.filter(id => id === 700)).toHaveLength(1);
    expect(ids.filter(id => id === 701)).toHaveLength(2); // el que falló y su reintento
  });

  it('retrying crear after a later line fails adds to the created quodom instead of creating another', async () => {
    vi.spyOn(agregarModule, 'agregarProducto').mockResolvedValue({ estado: 'elegir_destino', idrubro: 7, candidatos: [] });
    const crearSpy = vi.spyOn(agregarModule, 'crearYAgregar').mockResolvedValue('q-new');
    let fallo = true;
    const destinoSpy = vi.spyOn(agregarModule, 'agregarADestino').mockImplementation(async () => {
      if (fallo) { fallo = false; throw new Error('Falló el servidor'); }
    });
    render(<Probe />);

    fireEvent.click(screen.getByText('agregar'));
    fireEvent.click(screen.getByText('agregar otro'));
    await waitFor(() => expect(agregarModule.agregarProducto).toHaveBeenCalledTimes(2));
    await waitFor(() => screen.getByText('crear'));
    fireEvent.click(screen.getByText('crear'));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByText('crear'));

    await waitFor(() => expect(screen.queryByText('crear')).not.toBeInTheDocument());
    expect(crearSpy).toHaveBeenCalledTimes(1);
    expect(destinoSpy).toHaveBeenCalledTimes(2);
    expect(destinoSpy).toHaveBeenLastCalledWith(expect.objectContaining({ idproducto: 701 }), 7, 'q-new');
  });
});

function ProbeOtro() {
  const { pedirDestino, destino, elegir } = useAgregarProducto();
  return (
    <div>
      <button onClick={() => pedirDestino({ idproducto: 700, nombreProducto: 'Gaseosa', cantidad: 1 }, 7)}>a otro</button>
      {destino && <p>candidatos: {destino.candidatos.map(c => c.descripcion).join(',')}</p>}
      {destino && <button onClick={() => elegir('q-casa')}>elegir casa</button>}
    </div>
  );
}

describe('useAgregarProducto · pedirDestino', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('opens the destination list without adding anything, even if the rubro has an open quodom', async () => {
    localStorage.clear();
    abrirQuodom(7, 'q-depto');
    const agregarSpy = vi.spyOn(agregarModule, 'agregarProducto');
    const destinoSpy = vi.spyOn(agregarModule, 'agregarADestino').mockResolvedValue();
    const DEPTO = { id: 'q-depto', descripcion: 'Depto', idrubro: 7 } as unknown as Quodom;
    vi.spyOn(quodomApi, 'activosPorRubro').mockResolvedValue([CASA, DEPTO]);
    render(<ProbeOtro />);

    fireEvent.click(screen.getByText('a otro'));

    await waitFor(() => expect(screen.getByText('candidatos: Casa,Depto')).toBeInTheDocument());
    expect(agregarSpy).not.toHaveBeenCalled();
    expect(destinoSpy).not.toHaveBeenCalled();
    localStorage.clear();
  });

  it('adds the product to the chosen destination', async () => {
    const destinoSpy = vi.spyOn(agregarModule, 'agregarADestino').mockResolvedValue();
    vi.spyOn(quodomApi, 'activosPorRubro').mockResolvedValue([CASA]);
    render(<ProbeOtro />);

    fireEvent.click(screen.getByText('a otro'));
    await waitFor(() => screen.getByText('elegir casa'));
    fireEvent.click(screen.getByText('elegir casa'));

    await waitFor(() => expect(destinoSpy).toHaveBeenCalledWith(expect.objectContaining({ idproducto: 700 }), 7, 'q-casa'));
  });
});
