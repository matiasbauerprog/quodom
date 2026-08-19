import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DetalleQuodom } from '../DetalleQuodom';
import { addGuestLine, clearGuestQuodoms } from '../../../guest/guestQuodom';

vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../../../api/quodom', () => ({ quodom: { misQuodom: vi.fn(), porId: vi.fn(), update: vi.fn(), whatsapp: vi.fn(), activoPorRubro: vi.fn() } }));
vi.mock('../../../api/quodom_lines', () => ({ quodomLines: { porQuodom: vi.fn(), update: vi.fn(), eliminar: vi.fn() } }));

const GASEOSA = { idproducto: 700, nombreProducto: 'Gaseosa 2L', cantidad: 1 };
const CEMENTO = { idproducto: 400, nombreProducto: 'Cemento 50kg', cantidad: 1 };

function renderEn(ruta: string) {
  return render(<MemoryRouter initialEntries={[ruta]}><DetalleQuodom /></MemoryRouter>);
}

describe('DetalleQuodom for guests', () => {
  beforeEach(() => clearGuestQuodoms());

  it('shows only the lines of the rubro in the query string', async () => {
    addGuestLine(7, GASEOSA);
    addGuestLine(4, CEMENTO);

    renderEn('/quodom?rubro=7');

    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());
    expect(screen.queryByText('Cemento 50kg')).not.toBeInTheDocument();
  });

  it('lists the carts to choose from when no rubro is given and there are several', async () => {
    addGuestLine(7, GASEOSA);
    addGuestLine(4, CEMENTO);

    renderEn('/quodom');

    await waitFor(() => expect(screen.getByText('Bebidas')).toBeInTheDocument());
    expect(screen.getByText('Construcción')).toBeInTheDocument();
  });

  it('goes straight into the only cart when there is just one', async () => {
    addGuestLine(7, GASEOSA);

    renderEn('/quodom');

    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());
  });

  it('does not crash on an unknown rubro id and shows an empty cart', async () => {
    addGuestLine(7, GASEOSA);

    renderEn('/quodom?rubro=999');

    await waitFor(() => expect(screen.getByText('Tu Quodom está vacío. Sumá productos desde Inicio o Buscar.')).toBeInTheDocument());
  });

  it('treats a non-numeric rubro like a missing one', async () => {
    addGuestLine(7, GASEOSA);

    renderEn('/quodom?rubro=abc');

    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());
  });

  it('treats an empty rubro param like a missing one', async () => {
    addGuestLine(7, GASEOSA);

    renderEn('/quodom?rubro=');

    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());
  });
});
