import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ListaMisQuodoms } from '../ListaMisQuodoms';
import { quodom as quodomApi } from '../../../api/quodom';

vi.mock('../../../api/quodom', () => ({ quodom: { misQuodom: vi.fn(), create: vi.fn(), repetir: vi.fn(), porId: vi.fn() } }));
vi.mock('../../../api/quodom_lines', () => ({ quodomLines: { porQuodom: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../../quodom/quodomAbierto', () => ({ abrirQuodom: vi.fn() }));
// El selector pega a Google y tiene su propia suite.
vi.mock('../../../quodom/DialogoProveedores', () => ({
  DialogoProveedores: ({ idquodom }: { idquodom: string }) => <div data-testid="selector">selector de {idquodom}</div>
}));

const misQuodom = quodomApi.misQuodom as unknown as ReturnType<typeof vi.fn>;
const create = quodomApi.create as unknown as ReturnType<typeof vi.fn>;

const BEBIDAS_ABIERTO = { id: 'q-7', descripcion: 'Bebidas', estado: 'CREADO', nro: 'QD-1', idrubro: 7, nombrerubro: 'Bebidas', cantproductos: 1, createdBy: 'u-1', iddireccion: null };

function Ubicacion() {
  const l = useLocation();
  return <div data-testid="ubicacion">{l.pathname + l.search}</div>;
}

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

  it('lets you create another quodom of a rubro that already has an open one', async () => {
    misQuodom.mockResolvedValue([BEBIDAS_ABIERTO]);
    render(<MemoryRouter><ListaMisQuodoms /></MemoryRouter>);
    await waitFor(() => screen.getByRole('button', { name: /nuevo/i }));

    fireEvent.click(screen.getByRole('button', { name: /nuevo/i }));

    // Un rubro admite varios Quodoms abiertos: nada se deshabilita ni se anota.
    expect(screen.getByRole('button', { name: 'Bebidas' })).toBeEnabled();
    expect(screen.queryByText(/ya tenés uno abierto/i)).toBeNull();
  });

  it('makes the background inert while picking a rubro', async () => {
    misQuodom.mockResolvedValue([]);
    const { container } = render(<MemoryRouter><ListaMisQuodoms /></MemoryRouter>);
    await waitFor(() => screen.getByRole('button', { name: /nuevo/i }));

    const content = () => container.querySelector('.mq-content') as HTMLElement;
    expect(content().hasAttribute('inert')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /nuevo/i }));
    expect(content().hasAttribute('inert')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(content().hasAttribute('inert')).toBe(false);
  });

  it('shows the rubro on each card so quodoms of different rubros are distinguishable', async () => {
    misQuodom.mockResolvedValue([{ ...BEBIDAS_ABIERTO, descripcion: 'Oficina' }]);
    render(<MemoryRouter><ListaMisQuodoms /></MemoryRouter>);
    await waitFor(() => screen.getByText('Oficina'));

    expect(screen.getByText('Bebidas')).toBeInTheDocument();
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

// El bloque verde "Repetí un pedido" ya no está, y es a propósito.
//
// Mostraba los enviados en una tarjeta que no se parecía a ninguna otra de la
// app, **arriba de la lista que ya los incluía**: el mismo pedido aparecía dos
// veces y con dos aspectos distintos. El historial es una sola lista de
// tarjetas, todas iguales, y repetir vive donde vive todo lo demás del pedido:
// adentro de la ventana que abre la tarjeta, con sus dos caminos.
describe('ListaMisQuodoms: una sola lista', () => {
  beforeEach(() => { misQuodom.mockReset(); });

  const enviado = {
    id: 'e1', descripcion: 'Frente', estado: 'ENVIADO', nro: 'QD-9', idrubro: 5,
    nombrerubro: 'Pintura', cantproductos: 2, createdBy: 'u-1', iddireccion: 1,
    fechaenvio: new Date(Date.now() - 60 * 60 * 1000).toISOString()
  };

  it('no muestra el bloque Repetí un pedido', async () => {
    misQuodom.mockResolvedValue([enviado]);
    render(<MemoryRouter><ListaMisQuodoms /></MemoryRouter>);

    await screen.findByRole('button', { name: /QD-9/ });

    expect(screen.queryByRole('heading', { name: /repetí un pedido/i })).toBeNull();
  });

  // Lo que importa del cambio: el enviado sale UNA vez, no dos.
  it('un pedido enviado aparece una sola vez', async () => {
    misQuodom.mockResolvedValue([enviado]);
    render(<MemoryRouter><ListaMisQuodoms /></MemoryRouter>);

    await screen.findByRole('button', { name: /QD-9/ });

    expect(screen.getAllByRole('button', { name: /QD-9/ })).toHaveLength(1);
  });
});

describe('ListaMisQuodoms: la tarjeta abre una ventana', () => {
  const repetir = quodomApi.repetir as unknown as ReturnType<typeof vi.fn>;
  beforeEach(() => { misQuodom.mockReset(); repetir.mockReset(); });

  const ENVIADO = {
    id: 'q-9', descripcion: 'Frente', estado: 'ENVIADO', nro: 'QD-9', idrubro: 5,
    nombrerubro: 'Pintura', cantproductos: 2, createdBy: 'u-1', iddireccion: 1,
    fechaenvio: new Date(Date.now() - 60 * 60 * 1000).toISOString()
  };

  it('abre la ventana del pedido al tocar la tarjeta, sin navegar', async () => {
    misQuodom.mockResolvedValue([ENVIADO]);
    render(<MemoryRouter><ListaMisQuodoms /></MemoryRouter>);

    const tarjeta = await screen.findByRole('button', { name: /QD-9/ });
    fireEvent.click(tarjeta);

    const ventana = await screen.findByRole('dialog');
    expect(within(ventana).getByText('Frente')).toBeInTheDocument();
    expect(within(ventana).getByRole('button', { name: /otro proveedor/i })).toBeEnabled();
  });

  // Uno en armado abre la misma ventana que la campana, no la de sólo lectura.
  it('un pedido en armado abre la ventana de editar', async () => {
    misQuodom.mockResolvedValue([BEBIDAS_ABIERTO]);
    render(
      <MemoryRouter initialEntries={['/mis-quodoms']}>
        <ListaMisQuodoms />
        <Ubicacion />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /QD-1/ }));
    await waitFor(() => expect(screen.getByTestId('ubicacion')).toHaveTextContent('/mis-quodoms?quodom=q-7'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ListaMisQuodoms: entrar a un pedido desde una notificación', () => {
  beforeEach(() => { misQuodom.mockReset(); });

  const ENVIADO = {
    id: 'q-9', descripcion: 'Frente', estado: 'ENVIADO', nro: 'QD-9', idrubro: 5,
    nombrerubro: 'Pintura', cantproductos: 2, createdBy: 'u-1', iddireccion: 1,
    fechaenvio: new Date(Date.now() - 60 * 60 * 1000).toISOString()
  };

  // Lleva a la pantalla y no a la ventana: el usuario quiere ver el pedido
  // en su lista. La tarjeta se resalta para que se sepa cuál era.
  it('?pedido= resalta ese pedido en la lista, sin abrir la ventana', async () => {
    misQuodom.mockResolvedValue([ENVIADO]);
    render(<MemoryRouter initialEntries={['/mis-quodoms?pedido=q-9']}><ListaMisQuodoms /></MemoryRouter>);

    const tarjeta = await screen.findByRole('button', { name: /QD-9/ });
    await waitFor(() => expect(tarjeta.closest('li')).toHaveAttribute('aria-current', 'true'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('un pedido que no está deja la lista como siempre', async () => {
    misQuodom.mockResolvedValue([ENVIADO]);
    render(<MemoryRouter initialEntries={['/mis-quodoms?pedido=q-borrado']}><ListaMisQuodoms /></MemoryRouter>);

    const tarjeta = await screen.findByRole('button', { name: /QD-9/ });
    expect(tarjeta.closest('li')).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
