import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BarraQuodomInferior } from '../BarraQuodomInferior';
import { quodom as quodomApi } from '../../../api/quodom';
import { useAuth } from '../../../auth/AuthContext';
import { addGuestLine, clearGuestQuodoms } from '../../../guest/guestQuodom';
import { abrirQuodom } from '../../../quodom/quodomAbierto';
import { rubrosDisponibles } from '../../../quodom/rubrosDisponibles';

vi.mock('../../../api/quodom', () => ({ quodom: { misQuodom: vi.fn() } }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../quodom/rubrosDisponibles', () => ({
  rubrosDisponibles: vi.fn(),
  reiniciarCacheRubros: vi.fn()
}));

const misQuodom = quodomApi.misQuodom as unknown as ReturnType<typeof vi.fn>;
// Distinct from its own rubro name: a real Quodom's descripcion and its rubro
// label are two different pieces of text on screen.
const BEBIDAS = { id: 'q-7', descripcion: 'Bebidas oficina', estado: 'CREADO', nro: 'QD-1', idrubro: 7, nombrerubro: 'Bebidas', cantproductos: 2, createdBy: 'u-1', iddireccion: null };
const OBRA = { id: 'q-4', descripcion: 'Obra', estado: 'CREADO', nro: 'QD-2', idrubro: 4, nombrerubro: 'Construcción', cantproductos: 1, createdBy: 'u-1', iddireccion: null };
const CASA = { id: 'p1', descripcion: 'Casa', estado: 'CREADO', nro: 'QD-1', idrubro: 5, nombrerubro: 'Pinturería', cantproductos: 2, porccompletado: 100 };
const GASEOSA = { idproducto: 700, nombreProducto: 'Gaseosa 2L', cantidad: 2 };

function login() {
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'u-1' } } as unknown as ReturnType<typeof useAuth>);
}

function logout() {
  vi.mocked(useAuth).mockReturnValue({ user: null } as unknown as ReturnType<typeof useAuth>);
}

function reiniciar() {
  misQuodom.mockReset();
  localStorage.clear();
  clearGuestQuodoms();
  vi.mocked(rubrosDisponibles).mockResolvedValue([1, 4, 5, 7]);
}

describe('BarraQuodomInferior', () => {
  beforeEach(() => {
    reiniciar();
    login();
  });

  it('stays hidden when there is no open quodom', async () => {
    misQuodom.mockResolvedValue([]);
    const { container } = render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);
    await waitFor(() => expect(container.querySelector('.barra-quodom')).toBeNull());
  });

  it('shows the number of quodoms in armado, collapsed', async () => {
    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);
    render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);

    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bebidas oficina/ })).toBeNull();
  });

  it('expands the tree on click and lists each open quodom', async () => {
    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);
    render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: /Quodom/i }));

    expect(screen.getByRole('button', { name: /Bebidas oficina/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Obra/ })).toBeInTheDocument();
  });

  it('collapses again on a second click', async () => {
    misQuodom.mockResolvedValue([BEBIDAS]);
    render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);

    const toggle = await screen.findByRole('button', { name: /Quodom/i });
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: /Bebidas oficina/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Quodom/i, expanded: true }));

    expect(screen.queryByRole('button', { name: /Bebidas oficina/ })).toBeNull();
  });

  it('refreshes the list when quodom:changed fires', async () => {
    misQuodom.mockResolvedValue([BEBIDAS]);
    render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);
    await waitFor(() => expect(misQuodom).toHaveBeenCalledTimes(1));

    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);
    act(() => { window.dispatchEvent(new Event('quodom:changed')); });

    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
  });

  it('lists a leftover guest cart alongside the logged-in user\'s server quodoms', async () => {
    // Spec §6: a declined ('cancelar') migration leaves the guest cart intact
    // in localStorage. Without this it becomes unreachable once logged in.
    addGuestLine(4, { idproducto: 400, nombreProducto: 'Cemento 50kg', cantidad: 1 });
    misQuodom.mockResolvedValue([BEBIDAS]);
    render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument()); // 1 server + 1 guest

    fireEvent.click(screen.getByRole('button', { name: /Quodom/i }));

    expect(screen.getByRole('button', { name: /Bebidas oficina/ })).toBeInTheDocument();
    expect(screen.getByText(/sin guardar/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Construcción/ })).toHaveAttribute('href', '/quodom?rubro=4');
  });
});

describe('BarraQuodomInferior tree', () => {
  beforeEach(() => {
    reiniciar();
    login();
  });

  it('dice a qué Quodom está sumando cada rubro', async () => {
    abrirQuodom(5, 'p1');
    misQuodom.mockResolvedValue([CASA]);

    render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);

    expect(await screen.findByText(/sumando a/i)).toBeInTheDocument();
    expect(screen.getByText(/Casa/)).toBeInTheDocument();
  });

  it('al desplegarla aparece el mismo árbol', async () => {
    misQuodom.mockResolvedValue([CASA]);

    render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Quodom/i }));

    expect(screen.getByRole('button', { name: /Casa/ })).toBeInTheDocument();
  });

  it('con uno abierto, el botón se llama "sumando a" y el árbol lo muestra', async () => {
    abrirQuodom(5, 'p1');
    misQuodom.mockResolvedValue([CASA]);

    render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /sumando a/i }));

    expect(screen.getByRole('button', { name: /Casa/ })).toBeInTheDocument();
  });

  it('sin nada abierto lo dice en vez de mentir', async () => {
    misQuodom.mockResolvedValue([CASA]);

    render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);

    expect(await screen.findByText(/ningún quodom abierto/i)).toBeInTheDocument();
  });

  it('si fallan los rubros muestra el árbol sin filtrar', async () => {
    vi.mocked(rubrosDisponibles).mockRejectedValue(new Error('boom'));
    misQuodom.mockResolvedValue([CASA]);

    render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Quodom/i }));

    expect(screen.getByRole('button', { name: /Casa/ })).toBeInTheDocument();
  });

  it('no cierra los abiertos cuando falla la lista de Quodoms', async () => {
    abrirQuodom(5, 'p1');
    misQuodom.mockRejectedValue(new Error('boom'));

    render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);
    await waitFor(() => expect(misQuodom).toHaveBeenCalled());
    await act(async () => {});

    expect(JSON.parse(localStorage.getItem('quodom.abierto') ?? '{}')).toEqual({ 5: 'p1' });
  });
});

describe('BarraQuodomInferior for guests', () => {
  beforeEach(() => {
    reiniciar();
    logout();
  });

  it('stays hidden when the guest has no cart with lines', async () => {
    const { container } = render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);
    await waitFor(() => expect(container.querySelector('.barra-quodom')).toBeNull());
    expect(misQuodom).not.toHaveBeenCalled();
  });

  it('shows the count of guest carts with lines and expands to list them', async () => {
    addGuestLine(7, GASEOSA);
    addGuestLine(4, { idproducto: 400, nombreProducto: 'Cemento 50kg', cantidad: 1 });
    render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);

    expect(await screen.findByText('2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Quodom/i }));

    expect(screen.getByRole('link', { name: /Bebidas/ })).toHaveAttribute('href', '/quodom?rubro=7');
    expect(screen.getByRole('link', { name: /Construcción/ })).toHaveAttribute('href', '/quodom?rubro=4');
  });

  it('refreshes on quodom:changed as a guest adds a product', async () => {
    const { container } = render(<MemoryRouter><BarraQuodomInferior /></MemoryRouter>);
    expect(container.querySelector('.barra-quodom')).toBeNull();

    addGuestLine(7, GASEOSA);
    act(() => { window.dispatchEvent(new Event('quodom:changed')); });

    await waitFor(() => expect(container.querySelector('.barra-quodom')).not.toBeNull());
  });
});
