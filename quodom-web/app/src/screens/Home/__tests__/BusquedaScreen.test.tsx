import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BusquedaScreen } from '../BusquedaScreen';
import { busqueda } from '../../../api/busqueda';
import { historial } from '../../../api/hist_busquedas';
import { useAgregarProducto } from '../../../quodom/useAgregarProducto';

vi.mock('../../../api/busqueda', () => ({ busqueda: { buscar: vi.fn() } }));
vi.mock('../../../api/hist_busquedas', () => ({ historial: { list: vi.fn(), add: vi.fn() } }));
const auth = vi.hoisted(() => ({ user: { id: 'u-1' } as { id: string } | null }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('../../../quodom/useAgregarProducto', () => ({ useAgregarProducto: vi.fn() }));

const agregar = vi.fn();
const pedirDestino = vi.fn();
const COCA = { id: 700, nombre: 'Coca Cola 2L', categoriaPadre: 7 };

beforeEach(() => {
  agregar.mockReset();
  pedirDestino.mockReset();
  vi.mocked(historial.list).mockResolvedValue([]);
  auth.user = { id: 'u-1' };
  vi.mocked(busqueda.buscar).mockResolvedValue([COCA] as never);
  vi.mocked(useAgregarProducto).mockReturnValue({
    agregar, pedirDestino, agregando: false, error: null, destino: null,
    elegir: vi.fn(), crear: vi.fn(), cancelar: vi.fn()
  } as unknown as ReturnType<typeof useAgregarProducto>);
});

function montar() {
  return render(<MemoryRouter initialEntries={['/busqueda?q=coca']}><BusquedaScreen /></MemoryRouter>);
}

// Acá no hay detalle del producto que abrir, así que el clic en el resultado
// lleva directo a elegir el Quodom. Mismo gesto que en el catálogo —tocar el
// producto decide a dónde va— con un paso menos, porque no hay nada que leer.
describe('BusquedaScreen · mandar a otro Quodom', () => {
  it('el resultado ya no tiene el ···', async () => {
    montar();
    await screen.findByRole('button', { name: /^agregar coca cola 2l$/i });

    expect(screen.queryByRole('button', { name: /a otro quodom/i })).not.toBeInTheDocument();
  });

  it('tocar el resultado pide el destino del rubro, sin agregar', async () => {
    montar();

    fireEvent.click(await screen.findByRole('button', { name: /elegir el quodom de coca cola 2l/i }));

    expect(pedirDestino).toHaveBeenCalledWith(
      expect.objectContaining({ idproducto: 700, cantidad: 1 }), 7
    );
    expect(agregar).not.toHaveBeenCalled();
  });
});

describe('BusquedaScreen · el resultado y la sesión', () => {
  it('un invitado no puede elegir Quodom: no tiene a dónde', async () => {
    auth.user = null;
    montar();
    await screen.findByRole('button', { name: /^agregar coca cola 2l$/i });

    expect(screen.queryByRole('button', { name: /elegir el quodom/i })).not.toBeInTheDocument();
  });
});
