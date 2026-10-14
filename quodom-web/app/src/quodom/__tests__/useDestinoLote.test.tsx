import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useDestinoLote } from '../useDestinoLote';
import { quodom as quodomApi } from '../../api/quodom';
import { abrirQuodom } from '../quodomAbierto';

type Item = { id: number };

function Probe({ agregarItem, items }: { agregarItem: (q: string, i: Item) => Promise<void>; items: Item[] }) {
  const { resolver, destino, crear, elegir, cancelar, error } = useDestinoLote<Item>({ agregarItem, descripcion: () => 'Nuevo' });
  return (
    <div>
      <button onClick={() => resolver(7, items).catch(() => {})}>resolver</button>
      {error && <p role="alert">{error}</p>}
      {destino && <button onClick={crear}>crear</button>}
      {destino && <button onClick={() => elegir('q-1')}>elegir</button>}
      {destino && <button onClick={cancelar}>cancelar</button>}
    </div>
  );
}

describe('useDestinoLote', () => {
  beforeEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

  function falla(llegaron: [number, number][], cae = { v: true }) {
    return vi.fn(async (_q: string, i: Item & { n?: number }) => {
      if (i.id === 2 && cae.v) { cae.v = false; throw new TypeError('network'); }
      llegaron.push([i.id, i.n ?? 1]);
    });
  }

  it('after a network failure the remainder moves to the dialog; editing the proposal and retrying resends nothing', async () => {
    abrirQuodom(7, 'q-1');
    vi.spyOn(quodomApi, 'activosPorRubro').mockResolvedValue([]);
    const llegaron: [number, number][] = [];
    const agregarItem = falla(llegaron);
    const { rerender } = render(<Probe agregarItem={agregarItem} items={[{ id: 1 }, { id: 2 }, { id: 3 }]} />);

    fireEvent.click(screen.getByText('resolver'));
    await waitFor(() => screen.getByRole('alert'));
    rerender(<Probe agregarItem={agregarItem} items={[{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]} />);
    fireEvent.click(screen.getByText('resolver'));
    await new Promise(r => setTimeout(r, 20));
    expect(llegaron).toEqual([[1, 1]]);

    fireEvent.click(screen.getByText('elegir'));

    await waitFor(() => expect(llegaron).toEqual([[1, 1], [2, 1], [3, 1]]));
  });

  it('cancelling discards the remainder: an identical proposal later sends the whole batch', async () => {
    abrirQuodom(7, 'q-1');
    vi.spyOn(quodomApi, 'activosPorRubro').mockResolvedValue([]);
    const llegaron: [number, number][] = [];
    const agregarItem = falla(llegaron);
    render(<Probe agregarItem={agregarItem} items={[{ id: 1 }, { id: 2 }, { id: 3 }]} />);

    fireEvent.click(screen.getByText('resolver'));
    await waitFor(() => screen.getByText('cancelar'));
    fireEvent.click(screen.getByText('cancelar'));
    await waitFor(() => expect(screen.queryByText('cancelar')).toBeNull());
    llegaron.length = 0;
    fireEvent.click(screen.getByText('resolver'));

    await waitFor(() => expect(llegaron).toEqual([[1, 1], [2, 1], [3, 1]]));
  });

  it('retrying crear after the first line failed reuses the created quodom', async () => {
    const create = vi.spyOn(quodomApi, 'create').mockResolvedValue({ idquodom: 'q-new' } as never);
    vi.spyOn(quodomApi, 'activosPorRubro').mockResolvedValue([]);
    let cae = true;
    const agregarItem = vi.fn(async () => { if (cae) { cae = false; throw new Error('boom'); } });
    render(<Probe agregarItem={agregarItem} items={[{ id: 1 }]} />);

    fireEvent.click(screen.getByText('resolver'));
    await waitFor(() => screen.getByText('crear'));
    fireEvent.click(screen.getByText('crear'));
    await waitFor(() => screen.getByRole('alert'));
    fireEvent.click(screen.getByText('crear'));

    await waitFor(() => expect(agregarItem).toHaveBeenCalledTimes(2));
    expect(create).toHaveBeenCalledTimes(1);
    expect(agregarItem).toHaveBeenLastCalledWith('q-new', { id: 1 });
  });
});
