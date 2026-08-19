import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BarraQuodomInferior } from '../BarraQuodomInferior';
import { quodom as quodomApi } from '../../../api/quodom';

vi.mock('../../../api/quodom', () => ({ quodom: { misQuodom: vi.fn() } }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-1' } }) }));

const misQuodom = quodomApi.misQuodom as unknown as ReturnType<typeof vi.fn>;
// Distinct from its own rubro name (like MisQuodomsSidebar's test data, Task
// 11): a real Quodom's descripcion and its rubro label are two different
// pieces of text on screen, and using the same string for both would make
// `getByText` ambiguous between the two spans that render it.
const BEBIDAS = { id: 'q-7', descripcion: 'Bebidas oficina', estado: 'CREADO', nro: 'QD-1', idrubro: 7, nombrerubro: 'Bebidas', cantproductos: 2, createdBy: 'u-1', iddireccion: null };
const OBRA = { id: 'q-4', descripcion: 'Obra', estado: 'CREADO', nro: 'QD-2', idrubro: 4, nombrerubro: 'Construcción', cantproductos: 1, createdBy: 'u-1', iddireccion: null };

describe('BarraQuodomInferior', () => {
  beforeEach(() => misQuodom.mockReset());

  it('stays hidden when there is no open quodom', async () => {
    misQuodom.mockResolvedValue([]);
    const { container } = render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);
    await waitFor(() => expect(container.querySelector('.barra-quodom')).toBeNull());
  });

  it('shows the label with the number of open quodoms, collapsed', async () => {
    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);
    render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText(/Mis Quodoms activos/i)).toBeInTheDocument());
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('expands the panel on click and lists each open quodom', async () => {
    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);
    render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);
    await waitFor(() => screen.getByText(/Mis Quodoms activos/i));

    fireEvent.click(screen.getByRole('button', { name: /Mis Quodoms activos/i }));

    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByText('Bebidas')).toBeInTheDocument();
    expect(screen.getByText('Construcción')).toBeInTheDocument();
  });

  it('collapses again on a second click', async () => {
    misQuodom.mockResolvedValue([BEBIDAS]);
    render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);
    await waitFor(() => screen.getByText(/Mis Quodoms activos/i));

    const toggle = screen.getByRole('button', { name: /Mis Quodoms activos/i });
    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(screen.queryByRole('list')).toBeNull();
  });

  it('refreshes the list when quodom:changed fires', async () => {
    misQuodom.mockResolvedValue([BEBIDAS]);
    render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);
    await waitFor(() => expect(misQuodom).toHaveBeenCalledTimes(1));

    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);
    act(() => { window.dispatchEvent(new Event('quodom:changed')); });

    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
  });
});
