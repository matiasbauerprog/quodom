import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

describe('ListaMisQuodoms: Repetí un pedido', () => {
  const repetir = quodomApi.repetir as unknown as ReturnType<typeof vi.fn>;
  beforeEach(() => { misQuodom.mockReset(); repetir.mockReset(); });

  const enviado = (n: number) => ({
    id: 'p' + n, descripcion: 'Pedido ' + n, estado: 'ENVIADO', nro: 'QD-' + n, idrubro: 5, nombrerubro: 'Pintura',
    cantproductos: 2, porccompletado: 100, fechaenvio: new Date(Date.now() - 60 * 60 * 1000).toISOString()
  });

  // La lista completa de abajo también ofrece repetir en cada tarjeta; el
  // bloque de arriba es el que se acota a cinco.
  async function bloqueRepetir() {
    return (await screen.findByRole('heading', { name: /repetí un pedido/i })).closest('section') as HTMLElement;
  }

  it('muestra Repetí un pedido con los últimos enviados', async () => {
    misQuodom.mockResolvedValue([
      { id: 'p9', descripcion: 'Frente', estado: 'ENVIADO', nro: 'QD-9', idrubro: 5, cantproductos: 2, porccompletado: 100, fechaenvio: new Date(Date.now() - 60 * 60 * 1000).toISOString() }
    ]);

    render(<MemoryRouter><ListaMisQuodoms /></MemoryRouter>);

    expect(await screen.findByText(/repetí un pedido/i)).toBeInTheDocument();
  });

  it('muestra como mucho los últimos cinco', async () => {
    misQuodom.mockResolvedValue([1, 2, 3, 4, 5, 6, 7].map(enviado));
    render(<MemoryRouter><ListaMisQuodoms /></MemoryRouter>);

    const bloque = await bloqueRepetir();
    expect(within(bloque).getAllByRole('button', { name: /^repetir$/i })).toHaveLength(5);
  });

  it('no muestra la sección cuando no hay enviados', async () => {
    misQuodom.mockResolvedValue([BEBIDAS_ABIERTO]);
    render(<MemoryRouter><ListaMisQuodoms /></MemoryRouter>);

    await screen.findByRole('heading', { name: 'Historial de pedidos' });
    await waitFor(() => expect(misQuodom).toHaveBeenCalled());
    expect(screen.queryByText(/repetí un pedido/i)).toBeNull();
  });

  it('repetir uno crea el Quodom nuevo y avisa', async () => {
    misQuodom.mockResolvedValue([enviado(1)]);
    repetir.mockResolvedValue({ res: true, idquodom: 'q-nuevo' });
    render(<MemoryRouter><ListaMisQuodoms /></MemoryRouter>);

    const bloque = await bloqueRepetir();
    await act(async () => { within(bloque).getByRole('button', { name: /^repetir$/i }).click(); });

    expect(repetir).toHaveBeenCalledWith('p1');
    expect(await screen.findByText(/agregado/i)).toBeInTheDocument();
  });

  it('muestra el error cuando repetir falla', async () => {
    misQuodom.mockResolvedValue([enviado(1)]);
    repetir.mockRejectedValue(new Error('No se pudo repetir.'));
    render(<MemoryRouter><ListaMisQuodoms /></MemoryRouter>);

    const bloque = await bloqueRepetir();
    await act(async () => { within(bloque).getByRole('button', { name: /^repetir$/i }).click(); });

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo repetir/i);
  });
});

// El historial es para mirar lo que ya paso: tocar un pedido abre una ventana y
// no navega. Irse de la pantalla y volver pierde el lugar en la lista, y la
// pantalla de detalle es la de editar, que sobre un pedido enviado no va.
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
});
