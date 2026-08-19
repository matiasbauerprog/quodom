import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MisQuodomsSidebar } from '../MisQuodomsSidebar';
import { quodom as quodomApi } from '../../../api/quodom';
import { useAuth } from '../../../auth/AuthContext';
import { openWhatsappLink } from '../../../utils/whatsapp';
import { addGuestLine, clearGuestQuodoms } from '../../../guest/guestQuodom';

vi.mock('../../../api/quodom', () => ({ quodom: { misQuodom: vi.fn(), whatsapp: vi.fn() } }));
vi.mock('../../../api/quodom_lines', () => ({
  quodomLines: { porQuodom: vi.fn().mockResolvedValue([]), update: vi.fn(), eliminar: vi.fn() }
}));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../utils/whatsapp', () => ({ openWhatsappLink: vi.fn() }));

const misQuodom = quodomApi.misQuodom as unknown as ReturnType<typeof vi.fn>;
const whatsapp = quodomApi.whatsapp as unknown as ReturnType<typeof vi.fn>;

const BEBIDAS = { id: 'q-7', descripcion: 'Bebidas oficina', estado: 'CREADO', nro: 'QD-7', idrubro: 7, nombrerubro: 'Bebidas', cantproductos: 2, createdBy: 'u-1', iddireccion: null };
const ENVIADA = { ...BEBIDAS, estado: 'ENVIADO', fechaenvio: '2026-08-19T12:00:00Z' };

function tarjetaBebidas(): HTMLElement {
  return screen.getByText('Bebidas oficina').closest('article') as HTMLElement;
}

beforeEach(() => {
  misQuodom.mockReset(); whatsapp.mockReset();
  vi.mocked(openWhatsappLink).mockReset();
  clearGuestQuodoms();
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'u-1' } } as unknown as ReturnType<typeof useAuth>);
  misQuodom.mockResolvedValue([BEBIDAS]);
  whatsapp.mockResolvedValue({ res: true, link: 'https://wa.me/?text=hola' });
});

describe('sidebar: enviar por WhatsApp', () => {
  it('la tarjeta activa ofrece enviar además de continuar', async () => {
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas oficina');

    const tarjeta = tarjetaBebidas();
    expect(within(tarjeta).getByRole('button', { name: /continuar/i })).toBeInTheDocument();
    expect(within(tarjeta).getByRole('button', { name: /enviar/i })).toBeInTheDocument();
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

  it('queda a la vista marcado ENVIADO, no desaparece de golpe', async () => {
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas oficina');

    misQuodom.mockResolvedValue([ENVIADA]);
    fireEvent.click(within(tarjetaBebidas()).getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(within(tarjetaBebidas()).getByText(/ENVIADO/)).toBeInTheDocument());
    expect(screen.getByText('Bebidas oficina')).toBeInTheDocument();
  });

  it('al recargar la página ya no está: su lugar es Mis Quodoms', async () => {
    const { unmount } = render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas oficina');

    misQuodom.mockResolvedValue([ENVIADA]);
    fireEvent.click(within(tarjetaBebidas()).getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(within(tarjetaBebidas()).getByText(/ENVIADO/)).toBeInTheDocument());

    // Remontar es el equivalente a un F5: el "recién enviado" es estado de
    // componente y no sobrevive.
    unmount();
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    await waitFor(() => expect(screen.queryByText('Bebidas oficina')).toBeNull());
  });
});
