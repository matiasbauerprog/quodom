import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MisQuodomsSidebar } from '../MisQuodomsSidebar';
import { quodom as quodomApi } from '../../../api/quodom';
import { useAuth } from '../../../auth/AuthContext';
import { openWhatsappLink } from '../../../utils/whatsapp';
import { addGuestLine, clearGuestQuodoms } from '../../../guest/guestQuodom';
import { users as usersApi } from '../../../api/users';
import { abrirQuodom } from '../../../quodom/quodomAbierto';

vi.mock('../../../api/quodom', () => ({ quodom: { misQuodom: vi.fn(), whatsapp: vi.fn() } }));
vi.mock('../../../api/quodom_lines', () => ({
  quodomLines: { porQuodom: vi.fn().mockResolvedValue([]), update: vi.fn(), eliminar: vi.fn() }
}));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../quodom/rubrosDisponibles', () => ({
  rubrosDisponibles: vi.fn(() => Promise.resolve([1, 2, 3, 4, 5, 6, 7, 8]))
}));
vi.mock('../../../utils/whatsapp', () => ({ openWhatsappLink: vi.fn() }));
vi.mock('../../../api/users', () => ({ users: { getDirecciones: vi.fn() } }));

const misQuodom = quodomApi.misQuodom as unknown as ReturnType<typeof vi.fn>;
const whatsapp = quodomApi.whatsapp as unknown as ReturnType<typeof vi.fn>;
const getDirecciones = usersApi.getDirecciones as unknown as ReturnType<typeof vi.fn>;

const BEBIDAS = { id: 'q-7', descripcion: 'Bebidas oficina', estado: 'CREADO', nro: 'QD-7', idrubro: 7, nombrerubro: 'Bebidas', cantproductos: 2, porccompletado: 100, createdBy: 'u-1', iddireccion: null };
// La fecha va relativa a ahora, no fija: QuodomCard marca VENCIDO a las 72hs de
// enviado, así que una fecha absoluta hace que estos tests pasen sólo durante
// los tres días siguientes al día en que se escribieron y después fallen sin
// que nadie haya tocado el código.
const ENVIADA = {
  ...BEBIDAS,
  estado: 'ENVIADO',
  fechaenvio: new Date(Date.now() - 60 * 60 * 1000).toISOString()
};

// El Quodom abierto del árbol: ahí abajo viven las líneas y el envío.
function tarjetaBebidas(): HTMLElement {
  return screen.getByText('Bebidas oficina').closest('li') as HTMLElement;
}

beforeEach(() => {
  misQuodom.mockReset(); whatsapp.mockReset(); getDirecciones.mockReset();
  vi.mocked(openWhatsappLink).mockReset();
  clearGuestQuodoms(); localStorage.clear();
  // El envío vive bajo el Quodom abierto del árbol.
  abrirQuodom(7, 'q-7');
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'u-1' } } as unknown as ReturnType<typeof useAuth>);
  misQuodom.mockResolvedValue([BEBIDAS]);
  whatsapp.mockResolvedValue({ res: true, link: 'https://wa.me/?text=hola' });
  // Con dirección cargada y sin atributos pendientes, que es el caso en que el
  // envío está permitido; los bloqueos tienen su propio describe.
  getDirecciones.mockResolvedValue([{ id: 1 }]);
});

describe('sidebar: enviar por WhatsApp', () => {
  it('el Quodom abierto ofrece enviar', async () => {
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas oficina');

    expect(await within(tarjetaBebidas()).findByRole('button', { name: /enviar/i })).toBeInTheDocument();
  });

  it('un carrito de invitado no ofrece enviar: eso exige login y migración', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as unknown as ReturnType<typeof useAuth>);
    addGuestLine(7, { idproducto: 700, nombreProducto: 'Gaseosa 2L', cantidad: 1 });

    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas');

    const tarjeta = screen.getByText('Carrito').closest('article') as HTMLElement;
    expect(within(tarjeta).getByRole('button', { name: /continuar/i })).toBeInTheDocument();
    expect(within(tarjeta).queryByRole('button', { name: /enviar/i })).toBeNull();
  });

  it('enviar pide el link, lo abre y avisa al resto de la app', async () => {
    const escuchado = vi.fn();
    window.addEventListener('quodom:changed', escuchado);

    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas oficina');

    misQuodom.mockResolvedValue([ENVIADA]);
    fireEvent.click(within(tarjetaBebidas()).getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(whatsapp).toHaveBeenCalledWith('q-7'));
    expect(openWhatsappLink).toHaveBeenCalledWith('https://wa.me/?text=hola');
    // Sin este aviso el sidebar y la barra inferior se quedan con el estado
    // viejo: es el bug que hacía que el Quodom siguiera figurando activo.
    await waitFor(() => expect(escuchado).toHaveBeenCalled());
    window.removeEventListener('quodom:changed', escuchado);
  });

  it('una vez enviado deja el árbol: su lugar es Mis Quodoms', async () => {
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas oficina');

    misQuodom.mockResolvedValue([ENVIADA]);
    fireEvent.click(within(tarjetaBebidas()).getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(screen.queryByText('Bebidas oficina')).toBeNull());
  });
});

// El envío se bloquea cuando al pedido le falta algo que el proveedor necesita:
// la dirección, que define a quién le llega, y la medida de cada producto.
describe('sidebar: el envío bloqueado', () => {
  it('deshabilita enviar y muestra el motivo si falta la dirección', async () => {
    getDirecciones.mockResolvedValue([]);

    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas oficina');

    const tarjeta = tarjetaBebidas();
    await waitFor(() => expect(within(tarjeta).getByRole('button', { name: /enviar/i })).toBeDisabled());
    expect(within(tarjeta).getByText(/falta tu dirección/i)).toBeInTheDocument();
    expect(within(tarjeta).getByRole('link', { name: /cargar dirección/i })).toHaveAttribute('href', '/direcciones/nuevo');
  });

  it('deshabilita enviar si alguna línea no eligió su medida', async () => {
    misQuodom.mockResolvedValue([{ ...BEBIDAS, porccompletado: 50 }]);

    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas oficina');

    const tarjeta = tarjetaBebidas();
    expect(within(tarjeta).getByRole('button', { name: /enviar/i })).toBeDisabled();
    expect(within(tarjeta).getByText(/falta elegir la medida/i)).toBeInTheDocument();
  });

  it('no llama al API con el envío bloqueado', async () => {
    misQuodom.mockResolvedValue([{ ...BEBIDAS, porccompletado: 50 }]);

    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas oficina');

    fireEvent.click(within(tarjetaBebidas()).getByRole('button', { name: /enviar/i }));

    expect(whatsapp).not.toHaveBeenCalled();
  });

  it('se desbloquea al cargar la dirección, sin recargar la página', async () => {
    getDirecciones.mockResolvedValue([]);
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas oficina');
    await waitFor(() => expect(within(tarjetaBebidas()).getByRole('button', { name: /enviar/i })).toBeDisabled());

    getDirecciones.mockResolvedValue([{ id: 1 }]);
    fireEvent(window, new Event('direcciones:changed'));

    await waitFor(() => expect(within(tarjetaBebidas()).getByRole('button', { name: /enviar/i })).toBeEnabled());
  });
});
