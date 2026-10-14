import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useDestinoLote } from '../useDestinoLote';
import { quodom as quodomApi } from '../../api/quodom';
import { abrirQuodom } from '../quodomAbierto';

type Item = { id: number };

function Probe({ agregarItem, items }: { agregarItem: (q: string, i: Item) => Promise<void>; items: Item[] }) {
  const { resolver, destino, crear, error } = useDestinoLote<Item>({ agregarItem, descripcion: () => 'Nuevo' });
  return (
    <div>
      <button onClick={() => resolver(7, items).catch(() => {})}>resolver</button>
      {error && <p role="alert">{error}</p>}
      {destino && <button onClick={crear}>crear</button>}
    </div>
  );
}

describe('useDestinoLote', () => {
  beforeEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

  it('retrying after a network failure only sends what had not landed', async () => {
    abrirQuodom(7, 'q-1');
    const llegaron: number[] = [];
    let cae = true;
    const agregarItem = vi.fn(async (_q: string, i: Item) => {
      if (i.id === 2 && cae) { cae = false; throw new TypeError('network'); }
      llegaron.push(i.id);
    });
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    render(<Probe agregarItem={agregarItem} items={items} />);

    fireEvent.click(screen.getByText('resolver'));
    await waitFor(() => expect(agregarItem).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(llegaron).toEqual([1]));
    fireEvent.click(screen.getByText('resolver'));

    await waitFor(() => expect(llegaron).toEqual([1, 2, 3]));
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
