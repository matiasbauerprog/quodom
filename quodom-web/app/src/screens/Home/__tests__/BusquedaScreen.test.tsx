import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BusquedaScreen } from '../BusquedaScreen';
import { busqueda } from '../../../api/busqueda';
import { useAgregarProducto } from '../../../quodom/useAgregarProducto';

vi.mock('../../../api/busqueda', () => ({ busqueda: { buscar: vi.fn() } }));
vi.mock('../../../api/hist_busquedas', () => ({ historial: { list: vi.fn(), add: vi.fn() } }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../../../quodom/useAgregarProducto', () => ({ useAgregarProducto: vi.fn() }));

const agregar = vi.fn();
const pedirDestino = vi.fn();
const COCA = { id: 700, nombre: 'Coca Cola 2L', categoriaPadre: 7 };

beforeEach(() => {
  agregar.mockReset();
  pedirDestino.mockReset();
  vi.mocked(busqueda.buscar).mockResolvedValue([COCA] as never);
  vi.mocked(useAgregarProducto).mockReturnValue({
    agregar, pedirDestino, agregando: false, error: null, destino: null,
    elegir: vi.fn(), crear: vi.fn(), cancelar: vi.fn()
  } as unknown as ReturnType<typeof useAgregarProducto>);
});

function montar() {
  return render(<MemoryRouter initialEntries={['/busqueda?q=coca']}><BusquedaScreen /></MemoryRouter>);
}

describe('BusquedaScreen · mandar a otro Quodom', () => {
  it('cada resultado ofrece mandarlo a otro Quodom, con nombre accesible', async () => {
    montar();

    expect(await screen.findByRole('button', { name: 'Agregar Coca Cola 2L a otro Quodom' })).toBeInTheDocument();
  });

  it('el ··· pide el destino del rubro sin agregar', async () => {
    montar();

    fireEvent.click(await screen.findByRole('button', { name: /a otro quodom/i }));

    expect(pedirDestino).toHaveBeenCalledWith(
      expect.objectContaining({ idproducto: 700, cantidad: 1 }), 7
    );
    expect(agregar).not.toHaveBeenCalled();
  });
});
