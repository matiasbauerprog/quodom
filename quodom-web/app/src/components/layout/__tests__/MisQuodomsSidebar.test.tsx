import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MisQuodomsSidebar } from '../MisQuodomsSidebar';
import { quodom as quodomApi } from '../../../api/quodom';
import { useAuth } from '../../../auth/AuthContext';
import { addGuestLine, clearGuestQuodoms } from '../../../guest/guestQuodom';

vi.mock('../../../api/quodom', () => ({ quodom: { misQuodom: vi.fn(), repetir: vi.fn() } }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));

const misQuodom = quodomApi.misQuodom as unknown as ReturnType<typeof vi.fn>;
const GASEOSA = { idproducto: 700, nombreProducto: 'Gaseosa 2L', cantidad: 2 };

function login() {
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'u-1' } } as unknown as ReturnType<typeof useAuth>);
}

function logout() {
  vi.mocked(useAuth).mockReturnValue({ user: null } as unknown as ReturnType<typeof useAuth>);
}

// Realistic, distinct descriptions: a user names their Quodom, they don't
// just retype the rubro name.
const BEBIDAS = { id: 'q-7', descripcion: 'Bebidas oficina', estado: 'CREADO', nro: 'QD-1', idrubro: 7, nombrerubro: 'Bebidas', cantproductos: 2, createdBy: 'u-1', iddireccion: null };
const OBRA = { id: 'q-4', descripcion: 'Obra San Isidro', estado: 'CREADO', nro: 'QD-2', idrubro: 4, nombrerubro: 'Construcción', cantproductos: 1, createdBy: 'u-1', iddireccion: null };

describe('MisQuodomsSidebar', () => {
  beforeEach(() => { misQuodom.mockReset(); clearGuestQuodoms(); login(); });

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

describe('MisQuodomsSidebar sin sesión', () => {
  beforeEach(() => { misQuodom.mockReset(); clearGuestQuodoms(); logout(); });

  it('lista los carritos de invitado con su rubro y la marca "sin guardar"', async () => {
    addGuestLine(7, GASEOSA);
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    expect(await screen.findByText('Bebidas')).toBeInTheDocument();
    expect(screen.getByText('sin guardar')).toBeInTheDocument();
    expect(screen.getByText(/Quodoms activos/i)).toBeInTheDocument();
    // Sin sesión no se le pide nada al servidor.
    expect(misQuodom).not.toHaveBeenCalled();
  });

  it('avisa que sólo viven en este navegador', async () => {
    addGuestLine(7, GASEOSA);
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    expect(await screen.findByText('sin guardar')).toBeInTheDocument();
    expect(screen.getByText(/sólo en este navegador/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ingresar para guardarlos/i })).toBeInTheDocument();
  });

  it('sin carritos muestra el mismo vacío que con sesión, más el link de ingresar', async () => {
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    expect(await screen.findByText(/No tenés Quodoms/i)).toBeInTheDocument();
    // Sin sesión ya se ven los carritos de invitado: "ingresá para ver tus
    // Quodoms" dejó de describir lo que hace el sidebar.
    expect(screen.queryByText(/Ingresá para ver tus Quodoms/i)).toBeNull();
    expect(screen.getByRole('link', { name: /ingresar/i })).toBeInTheDocument();
    expect(screen.queryByText('sin guardar')).not.toBeInTheDocument();
  });

  it('se actualiza cuando cambia un carrito', async () => {
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText(/No tenés Quodoms/i);

    act(() => {
      addGuestLine(1, { idproducto: 400, nombreProducto: 'Lavandina 1L', cantidad: 1 });
      window.dispatchEvent(new Event('quodom:changed'));
    });

    expect(await screen.findByText('Limpieza')).toBeInTheDocument();
  });
});

describe('MisQuodomsSidebar con sesión y carritos huérfanos', () => {
  beforeEach(() => { misQuodom.mockReset(); clearGuestQuodoms(); login(); });

  it('muestra los carritos sin guardar junto a los Quodoms del servidor', async () => {
    misQuodom.mockResolvedValue([BEBIDAS]);
    addGuestLine(1, { idproducto: 400, nombreProducto: 'Lavandina 1L', cantidad: 1 });
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    expect(await screen.findByText('Bebidas oficina')).toBeInTheDocument();
    expect(screen.getByText('Limpieza')).toBeInTheDocument();
    expect(screen.getByText('sin guardar')).toBeInTheDocument();
    // Ya está logueado: el aviso de "sólo en este navegador" no aplica.
    expect(screen.queryByText(/sólo en este navegador/i)).not.toBeInTheDocument();
  });
});

// Los enviados eran historial invisible: había que ir a Mis Quodoms para
// volver a pedir lo mismo. Ahora quedan abajo, en verde, listos para repetir.
// No hace falta programar la mudanza: al enviarlo el backend lo pasa a ENVIADO
// y `quodom:changed` recarga, así que cae solo de una sección a la otra.
describe('MisQuodomsSidebar (repetí un pedido)', () => {
  const repetir = quodomApi.repetir as unknown as ReturnType<typeof vi.fn>;
  const enviado = (n: number, rubro: string, idrubro: number) => ({
    id: 'q-e' + n, descripcion: 'Pedido ' + n, estado: 'ENVIADO', nro: 'QD-E' + n,
    idrubro, nombrerubro: rubro, cantproductos: 3, createdBy: 'u-1', iddireccion: null
  });

  beforeEach(() => { misQuodom.mockReset(); repetir.mockReset(); clearGuestQuodoms(); login(); });

  it('muestra los terminados aparte de los activos', async () => {
    misQuodom.mockResolvedValue([BEBIDAS, enviado(1, 'Pintura', 5)]);
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText(/repetí un pedido/i)).toBeInTheDocument());
    expect(screen.getByText(/Quodoms activos/i)).toBeInTheDocument();
    expect(screen.getByText('Pedido 1')).toBeInTheDocument();
  });

  it('muestra como mucho los últimos cinco', async () => {
    misQuodom.mockResolvedValue([1, 2, 3, 4, 5, 6, 7].map(n => enviado(n, 'Pintura', 5)));
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText(/repetí un pedido/i)).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /repetir/i })).toHaveLength(5);
    expect(screen.getByText('Pedido 1')).toBeInTheDocument();
    expect(screen.queryByText('Pedido 6')).toBeNull();
  });

  it('no muestra la sección cuando no hay ninguno terminado', async () => {
    misQuodom.mockResolvedValue([BEBIDAS]);
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText(/Quodoms activos/i)).toBeInTheDocument());
    expect(screen.queryByText(/repetí un pedido/i)).toBeNull();
  });

  it('repetir uno crea el Quodom nuevo y refresca', async () => {
    misQuodom.mockResolvedValue([enviado(1, 'Pintura', 5)]);
    repetir.mockResolvedValue({ res: true, idquodom: 'q-nuevo' });
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText(/repetí un pedido/i)).toBeInTheDocument());
    await act(async () => { screen.getByRole('button', { name: /repetir/i }).click(); });

    expect(repetir).toHaveBeenCalledWith('q-e1');
  });

  it('avisa cuando ya hay un Quodom abierto de ese rubro', async () => {
    misQuodom.mockResolvedValue([enviado(1, 'Pintura', 5)]);
    repetir.mockRejectedValue(new Error('Ya tenés un Quodom abierto de Pintura.'));
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText(/repetí un pedido/i)).toBeInTheDocument());
    await act(async () => { screen.getByRole('button', { name: /repetir/i }).click(); });

    expect(await screen.findByRole('alert')).toHaveTextContent(/ya tenés un quodom abierto/i);
  });
});
