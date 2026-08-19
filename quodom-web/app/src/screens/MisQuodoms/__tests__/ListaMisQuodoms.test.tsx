import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListaMisQuodoms } from '../ListaMisQuodoms';
import { quodom as quodomApi } from '../../../api/quodom';

vi.mock('../../../api/quodom', () => ({ quodom: { misQuodom: vi.fn(), create: vi.fn() } }));

const misQuodom = quodomApi.misQuodom as unknown as ReturnType<typeof vi.fn>;
const create = quodomApi.create as unknown as ReturnType<typeof vi.fn>;

const BEBIDAS_ABIERTO = { id: 'q-7', descripcion: 'Bebidas', estado: 'CREADO', nro: 'QD-1', idrubro: 7, nombrerubro: 'Bebidas', cantproductos: 1, createdBy: 'u-1', iddireccion: null };

describe('ListaMisQuodoms: nuevo por rubro', () => {
  beforeEach(() => { misQuodom.mockReset(); create.mockReset(); });

  it('offers the eight rubros when creating a new quodom', async () => {
    misQuodom.mockResolvedValue([]);
    render(<MemoryRouter><ListaMisQuodoms /></MemoryRouter>);
    await waitFor(() => screen.getByRole('button', { name: /nuevo/i }));

    fireEvent.click(screen.getByRole('button', { name: /nuevo/i }));

    expect(screen.getByRole('button', { name: 'Bebidas' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Construcción' })).toBeEnabled();
  });

  it('disables a rubro that already has an open quodom', async () => {
    misQuodom.mockResolvedValue([BEBIDAS_ABIERTO]);
    render(<MemoryRouter><ListaMisQuodoms /></MemoryRouter>);
    await waitFor(() => screen.getByRole('button', { name: /nuevo/i }));

    fireEvent.click(screen.getByRole('button', { name: /nuevo/i }));

    expect(screen.getByRole('button', { name: /Bebidas/ })).toBeDisabled();
  });

  it('creates with the chosen idrubro', async () => {
    misQuodom.mockResolvedValue([]);
    create.mockResolvedValue({ res: true, idquodom: 'q-new' });
    render(<MemoryRouter><ListaMisQuodoms /></MemoryRouter>);
    await waitFor(() => screen.getByRole('button', { name: /nuevo/i }));

    fireEvent.click(screen.getByRole('button', { name: /nuevo/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Construcción' }));

    await waitFor(() => expect(create).toHaveBeenCalledWith({ descripcion: 'Mi Quodom', idrubro: 4 }));
  });
});
