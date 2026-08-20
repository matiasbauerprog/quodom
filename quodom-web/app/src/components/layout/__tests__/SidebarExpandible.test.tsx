import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MisQuodomsSidebar } from '../MisQuodomsSidebar';
import { quodom as quodomApi } from '../../../api/quodom';
import { quodomLines } from '../../../api/quodom_lines';
import { useAuth } from '../../../auth/AuthContext';
import { addGuestLine, clearGuestQuodoms, getGuestCart } from '../../../guest/guestQuodom';

vi.mock('../../../api/quodom', () => ({ quodom: { misQuodom: vi.fn() } }));
vi.mock('../../../api/quodom_lines', () => ({
  quodomLines: { porQuodom: vi.fn(), update: vi.fn(), eliminar: vi.fn() }
}));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));

const misQuodom = quodomApi.misQuodom as unknown as ReturnType<typeof vi.fn>;
const porQuodom = quodomLines.porQuodom as unknown as ReturnType<typeof vi.fn>;
const update = quodomLines.update as unknown as ReturnType<typeof vi.fn>;
const eliminar = quodomLines.eliminar as unknown as ReturnType<typeof vi.fn>;

const BEBIDAS = { id: 'q-7', descripcion: 'Bebidas oficina', estado: 'CREADO', nro: 'QD-7', idrubro: 7, nombrerubro: 'Bebidas', cantproductos: 2, createdBy: 'u-1', iddireccion: null };
const LIMPIEZA = { id: 'q-1', descripcion: 'Limpieza mensual', estado: 'CREADO', nro: 'QD-9', idrubro: 1, nombrerubro: 'Limpieza', cantproductos: 1, createdBy: 'u-1', iddireccion: null };
const ENVIADO = { id: 'q-5', descripcion: 'Pintura living', estado: 'ENVIADO', nro: 'QD-3', idrubro: 5, nombrerubro: 'Pintura', cantproductos: 4, createdBy: 'u-1', iddireccion: null, fechaenvio: '2026-08-01T10:00:00Z' };

const LINEAS_BEBIDAS = [
  { id: 11, idquodom: 'q-7', idproducto: 700, cantidad: 2, nombreProducto: 'Coca Cola 2L' },
  { id: 12, idquodom: 'q-7', idproducto: 701, cantidad: 6, nombreProducto: 'Agua 500ml' }
];

// Las tarjetas exponen su número de Quodom, así que sirve para leer el orden
// de la lista sin depender de la descripción que escribió el usuario.
function tarjetas(): HTMLElement[] {
  return screen.getAllByRole('button', { name: /QD-/ });
}

function lineaDe(nombre: string): HTMLElement {
  return screen.getByText(nombre).closest('li') as HTMLElement;
}

beforeEach(() => {
  misQuodom.mockReset(); porQuodom.mockReset(); update.mockReset(); eliminar.mockReset();
  clearGuestQuodoms();
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'u-1' } } as unknown as ReturnType<typeof useAuth>);
  misQuodom.mockResolvedValue([BEBIDAS, LIMPIEZA, ENVIADO]);
  porQuodom.mockResolvedValue(LINEAS_BEBIDAS);
  update.mockResolvedValue({ res: true });
  eliminar.mockResolvedValue({ res: true });
});

describe('sidebar: sólo activos', () => {
  it('no lista los enviados — el historial vive en Mis Quodoms', async () => {
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    await screen.findByText('Bebidas oficina');
    expect(screen.queryByText('Pintura living')).toBeNull();
    expect(screen.queryByText(/Últimos Quodoms/i)).toBeNull();
    expect(screen.getByRole('link', { name: /ver todos/i })).toBeInTheDocument();
  });
});

describe('sidebar: mini editor', () => {
  it('el clic despliega los productos en vez de navegar', async () => {
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas oficina');

    expect(screen.queryByText('Coca Cola 2L')).toBeNull();
    fireEvent.click(screen.getByText('Bebidas oficina'));

    expect(await screen.findByText('Coca Cola 2L')).toBeInTheDocument();
    expect(porQuodom).toHaveBeenCalledWith('q-7');
  });

  it('la lista no se reordena al desplegar: la tarjeta se abre donde está', async () => {
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Limpieza mensual');
    expect(tarjetas()[0]).toHaveTextContent('Bebidas oficina');

    porQuodom.mockResolvedValue([{ id: 21, idquodom: 'q-1', idproducto: 400, cantidad: 1, nombreProducto: 'Lavandina 1L' }]);
    fireEvent.click(screen.getByText('Limpieza mensual'));
    await screen.findByText('Lavandina 1L');

    // Mover la tarjeta bajo el dedo hace saltar el resto de la lista.
    expect(tarjetas()[0]).toHaveTextContent('Bebidas oficina');
    expect(tarjetas()[1]).toHaveTextContent('Limpieza mensual');
  });

  it('el segundo clic minimiza los productos', async () => {
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas oficina');

    fireEvent.click(screen.getByText('Bebidas oficina'));
    await screen.findByText('Coca Cola 2L');

    fireEvent.click(screen.getByText('Bebidas oficina'));

    await waitFor(() => expect(screen.queryByText('Coca Cola 2L')).toBeNull());
  });

  it('abrir otro cierra el anterior: hay uno solo desplegado', async () => {
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas oficina');

    fireEvent.click(screen.getByText('Bebidas oficina'));
    await screen.findByText('Coca Cola 2L');

    porQuodom.mockResolvedValue([{ id: 21, idquodom: 'q-1', idproducto: 400, cantidad: 1, nombreProducto: 'Lavandina 1L' }]);
    fireEvent.click(screen.getByText('Limpieza mensual'));

    expect(await screen.findByText('Lavandina 1L')).toBeInTheDocument();
    expect(screen.queryByText('Coca Cola 2L')).toBeNull();
  });

  it('un producto agregado desde el catálogo aparece en la lista abierta', async () => {
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas oficina');
    fireEvent.click(screen.getByText('Bebidas oficina'));
    await screen.findByText('Coca Cola 2L');

    // Agregar desde el catálogo pasa por agregarProducto, que avisa con este
    // evento. La lista desplegada tiene que enterarse igual que la tarjeta.
    porQuodom.mockResolvedValue([
      ...LINEAS_BEBIDAS,
      { id: 13, idquodom: 'q-7', idproducto: 702, cantidad: 1, nombreProducto: 'Tónica 1L' }
    ]);
    act(() => { window.dispatchEvent(new Event('quodom:changed')); });

    expect(await screen.findByText('Tónica 1L')).toBeInTheDocument();
  });

  it('cambiar la cantidad la guarda y recarga las líneas', async () => {
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas oficina');
    fireEvent.click(screen.getByText('Bebidas oficina'));
    await screen.findByText('Coca Cola 2L');

    fireEvent.click(within(lineaDe('Coca Cola 2L')).getByRole('button', { name: /sumar/i }));

    await waitFor(() => expect(update).toHaveBeenCalledWith(11, { cantidad: 3 }));
    expect(porQuodom).toHaveBeenCalledTimes(2);
  });

  it('borrar una línea la elimina', async () => {
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas oficina');
    fireEvent.click(screen.getByText('Bebidas oficina'));
    await screen.findByText('Agua 500ml');

    fireEvent.click(within(lineaDe('Agua 500ml')).getByRole('button', { name: /quitar/i }));

    await waitFor(() => expect(eliminar).toHaveBeenCalledWith(12));
  });

  it('bajar de 1 borra la línea en vez de guardar cantidad 0', async () => {
    porQuodom.mockResolvedValue([{ id: 11, idquodom: 'q-7', idproducto: 700, cantidad: 1, nombreProducto: 'Coca Cola 2L' }]);
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas oficina');
    fireEvent.click(screen.getByText('Bebidas oficina'));
    await screen.findByText('Coca Cola 2L');

    fireEvent.click(within(lineaDe('Coca Cola 2L')).getByRole('button', { name: /restar/i }));

    await waitFor(() => expect(eliminar).toHaveBeenCalledWith(11));
    expect(update).not.toHaveBeenCalled();
  });
});

describe('sidebar: carrito de invitado', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as unknown as ReturnType<typeof useAuth>);
    addGuestLine(7, { idproducto: 700, nombreProducto: 'Gaseosa 2L', cantidad: 2 });
  });

  it('un producto agregado al carrito aparece en la lista abierta', async () => {
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas');
    fireEvent.click(screen.getByText('Carrito'));
    await screen.findByText('Gaseosa 2L');

    act(() => {
      addGuestLine(7, { idproducto: 701, nombreProducto: 'Agua 500ml', cantidad: 1 });
      window.dispatchEvent(new Event('quodom:changed'));
    });

    expect(await screen.findByText('Agua 500ml')).toBeInTheDocument();
  });

  it('se edita contra localStorage, sin tocar la red', async () => {
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas');

    fireEvent.click(screen.getByText('Carrito'));
    await screen.findByText('Gaseosa 2L');

    fireEvent.click(within(lineaDe('Gaseosa 2L')).getByRole('button', { name: /sumar/i }));

    await waitFor(() => expect(getGuestCart(7).lines[0].cantidad).toBe(3));
    expect(porQuodom).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
