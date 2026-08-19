import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MisQuodomsSidebar } from '../MisQuodomsSidebar';
import { quodom as quodomApi } from '../../../api/quodom';

vi.mock('../../../api/quodom', () => ({ quodom: { misQuodom: vi.fn() } }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-1' } }) }));

const misQuodom = quodomApi.misQuodom as unknown as ReturnType<typeof vi.fn>;

// Realistic, distinct descriptions: a user names their Quodom, they don't
// just retype the rubro name.
const BEBIDAS = { id: 'q-7', descripcion: 'Bebidas oficina', estado: 'CREADO', nro: 'QD-1', idrubro: 7, nombrerubro: 'Bebidas', cantproductos: 2, createdBy: 'u-1', iddireccion: null };
const OBRA = { id: 'q-4', descripcion: 'Obra San Isidro', estado: 'CREADO', nro: 'QD-2', idrubro: 4, nombrerubro: 'Construcción', cantproductos: 1, createdBy: 'u-1', iddireccion: null };

describe('MisQuodomsSidebar', () => {
  beforeEach(() => { misQuodom.mockReset(); });

  it('lists every open quodom with its rubro', async () => {
    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('Bebidas')).toBeInTheDocument());
    expect(screen.getByText('Construcción')).toBeInTheDocument();
    expect(screen.getByText(/Quodoms activos/i)).toBeInTheDocument();
    // The quodom's own name stays visible alongside its rubro label — it is
    // never hidden just because a user could type the rubro's name too.
    expect(screen.getByText('Bebidas oficina')).toBeInTheDocument();
    expect(screen.getByText('Obra San Isidro')).toBeInTheDocument();
  });

  it('reloads when quodom:changed fires', async () => {
    misQuodom.mockResolvedValue([BEBIDAS]);
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await waitFor(() => expect(misQuodom).toHaveBeenCalledTimes(1));

    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);
    act(() => { window.dispatchEvent(new Event('quodom:changed')); });

    await waitFor(() => expect(screen.getByText('Construcción')).toBeInTheDocument());
  });

  it('keeps showing the last-known-good list when a refresh fails', async () => {
    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Bebidas oficina')).toBeInTheDocument());

    misQuodom.mockRejectedValue(new Error('network down'));
    act(() => { window.dispatchEvent(new Event('quodom:changed')); });

    await waitFor(() => expect(misQuodom).toHaveBeenCalledTimes(2));
    // The previously loaded quodoms must still be on screen — a transient
    // refresh failure must not blank a sidebar that was showing correct data.
    expect(screen.getByText('Bebidas oficina')).toBeInTheDocument();
    expect(screen.getByText('Obra San Isidro')).toBeInTheDocument();
    expect(screen.queryByText(/No tenés Quodoms/i)).not.toBeInTheDocument();
  });
});
