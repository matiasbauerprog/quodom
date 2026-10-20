import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AvisoRepetido } from '../AvisoRepetido';
import { repetirPedido } from '../../quodom/repetirPedido';
import { quodom as quodomApi } from '../../api/quodom';
import { abrirQuodom } from '../../quodom/quodomAbierto';

vi.mock('../../api/quodom', () => ({ quodom: { repetir: vi.fn() } }));
vi.mock('../../quodom/quodomAbierto', () => ({ abrirQuodom: vi.fn() }));

const repetir = quodomApi.repetir as unknown as ReturnType<typeof vi.fn>;
const ENVIADO = { id: 'q-7', descripcion: 'Bebidas oficina', estado: 'ENVIADO', nro: 'QD-7', idrubro: 7, nombrerubro: 'Bebidas', cantproductos: 2, createdBy: 'u-1', iddireccion: null };

function montar() {
  return render(<MemoryRouter><AvisoRepetido /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  repetir.mockResolvedValue({ res: true, idquodom: 'q-nuevo' });
});
afterEach(() => { vi.useRealTimers(); });

// Repetir creaba el pedido en silencio: el usuario no tenía ninguna prueba
// de que había pasado algo, y en celular el árbol ni se ve.
describe('AvisoRepetido', () => {
  it('no muestra nada hasta que se repite', () => {
    montar();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('repetir dice qué se repitió, dónde quedó y lleva al pedido nuevo', async () => {
    montar();
    await act(async () => { await repetirPedido(ENVIADO as never); });

    expect(screen.getByRole('status')).toHaveTextContent('Repetiste Bebidas oficina: el pedido nuevo quedó en armado en Bebidas.');
    expect(screen.getByRole('link', { name: 'Ver pedido' })).toHaveAttribute('href', '/quodom?id=q-nuevo');
    expect(abrirQuodom).toHaveBeenCalledWith(7, 'q-nuevo');
  });

  it('se va solo a los pocos segundos', async () => {
    vi.useFakeTimers();
    montar();
    await act(async () => { await repetirPedido(ENVIADO as never); });
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(6000); });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('se puede cerrar', async () => {
    montar();
    await act(async () => { await repetirPedido(ENVIADO as never); });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('si repetir falla no anuncia nada', async () => {
    repetir.mockRejectedValue(new Error('No se pudo repetir.'));
    montar();
    await act(async () => { await repetirPedido(ENVIADO as never).catch(() => {}); });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
