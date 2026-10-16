import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { NotificacionesQuodom } from '../NotificacionesQuodom';
import { notificaciones } from '../../../api/oper_notificaciones';
import { quodom as quodomApi } from '../../../api/quodom';
import { useAuth } from '../../../auth/AuthContext';
import { abrirQuodom } from '../../../quodom/quodomAbierto';

vi.mock('../../../api/oper_notificaciones', () => ({
  notificaciones: { list: vi.fn(), count: vi.fn(), marcarLeida: vi.fn() }
}));
vi.mock('../../../api/quodom', () => ({ quodom: { misQuodom: vi.fn(), repetir: vi.fn() } }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../quodom/quodomAbierto', () => ({ abrirQuodom: vi.fn() }));
// El selector pega a Google y tiene su propia suite.
vi.mock('../../../quodom/DialogoProveedores', () => ({
  DialogoProveedores: ({ idquodom, onCerrar }: { idquodom: string; onCerrar: () => void }) => (
    <div data-testid="selector">selector de {idquodom}<button onClick={onCerrar}>cerrar selector</button></div>
  )
}));

const list = notificaciones.list as unknown as ReturnType<typeof vi.fn>;
const count = notificaciones.count as unknown as ReturnType<typeof vi.fn>;
const marcarLeida = notificaciones.marcarLeida as unknown as ReturnType<typeof vi.fn>;
const misQuodom = quodomApi.misQuodom as unknown as ReturnType<typeof vi.fn>;
const repetir = quodomApi.repetir as unknown as ReturnType<typeof vi.fn>;
const auth = useAuth as unknown as ReturnType<typeof vi.fn>;

const haceUnaHora = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();

const NOTIF = (id: number, idquodom: string, leida = 0) => ({
  id, idquodom, leida, tiponotificacion: 'QUODOMENVIADO',
  titulo: 'Quodom enviado', texto: 'Tu Quodom QD-7 fue enviado por WhatsApp.', createdAt: haceUnaHora()
});
const ENVIADO = { id: 'q-7', descripcion: 'Bebidas oficina', estado: 'ENVIADO', nro: 'QD-7', idrubro: 7, nombrerubro: 'Bebidas', cantproductos: 2, createdBy: 'u-1', iddireccion: null };

function Ubicacion() {
  const l = useLocation();
  return <div data-testid="ubicacion">{l.pathname + l.search}</div>;
}

function montar() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <NotificacionesQuodom />
      <Routes><Route path="*" element={<Ubicacion />} /></Routes>
    </MemoryRouter>
  );
}

async function abrir() {
  fireEvent.click(await screen.findByRole('button', { name: /notificaciones/i }));
  return screen.findByRole('region', { name: /notificaciones/i });
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockReturnValue({ user: { id: 'u-1' } });
  count.mockResolvedValue(1);
  list.mockResolvedValue([NOTIF(1, 'q-7')]);
  marcarLeida.mockResolvedValue({ res: true });
  misQuodom.mockResolvedValue([ENVIADO]);
});

describe('NotificacionesQuodom', () => {
  it('muestra cuántas hay sin leer', async () => {
    montar();
    expect(await screen.findByRole('button', { name: 'Notificaciones (1 sin leer)' })).toHaveTextContent('1');
  });

  it('un invitado no tiene notificaciones', () => {
    auth.mockReturnValue({ user: null });
    montar();
    expect(screen.queryByRole('button', { name: /notificaciones/i })).toBeNull();
    expect(count).not.toHaveBeenCalled();
  });

  it('vuelve a contar cuando se envía un Quodom', async () => {
    count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    montar();
    await screen.findByRole('button', { name: 'Notificaciones' });
    act(() => { window.dispatchEvent(new Event('quodom:changed')); });
    expect(await screen.findByRole('button', { name: 'Notificaciones (1 sin leer)' })).toBeInTheDocument();
  });

  it('abrir el menú marca las no leídas y se va el número', async () => {
    list.mockResolvedValue([NOTIF(1, 'q-7'), NOTIF(2, 'q-7', 1)]);
    // Después de marcar, el servidor ya cuenta cero.
    count.mockResolvedValueOnce(1).mockResolvedValue(0);
    montar();
    await abrir();
    await waitFor(() => expect(marcarLeida).toHaveBeenCalledTimes(1));
    expect(marcarLeida).toHaveBeenCalledWith(1);
    expect(screen.getByRole('button', { name: 'Notificaciones' })).not.toHaveTextContent('1');
  });

  it('nombra el Quodom enviado', async () => {
    montar();
    const menu = await abrir();
    expect(await within(menu).findByText(/Bebidas oficina/)).toBeInTheDocument();
    expect(within(menu).getByText(/QD-7/)).toBeInTheDocument();
  });

  it('Historial lleva a ese pedido en el historial', async () => {
    montar();
    const menu = await abrir();
    fireEvent.click(await within(menu).findByRole('button', { name: /ver en historial/i }));
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/mis-quodoms?pedido=q-7');
    expect(screen.queryByRole('region', { name: /notificaciones/i })).toBeNull();
  });

  it('Repetir crea uno nuevo y lo deja abierto en su rubro', async () => {
    repetir.mockResolvedValue({ res: true, idquodom: 'q-nuevo' });
    const cambio = vi.fn();
    window.addEventListener('quodom:changed', cambio);
    montar();
    const menu = await abrir();
    fireEvent.click(await within(menu).findByRole('button', { name: /repetir pedido/i }));
    await waitFor(() => expect(abrirQuodom).toHaveBeenCalledWith(7, 'q-nuevo'));
    expect(repetir).toHaveBeenCalledWith('q-7');
    expect(cambio).toHaveBeenCalled();
    window.removeEventListener('quodom:changed', cambio);
  });

  it('si repetir falla lo dice y no abre nada', async () => {
    repetir.mockRejectedValue(new Error('No se pudo repetir.'));
    montar();
    const menu = await abrir();
    fireEvent.click(await within(menu).findByRole('button', { name: /repetir pedido/i }));
    expect(await within(menu).findByText('No se pudo repetir.')).toBeInTheDocument();
    expect(abrirQuodom).not.toHaveBeenCalled();
  });

  it('Otro proveedor cierra el menú y deja abierto el selector', async () => {
    montar();
    const menu = await abrir();
    fireEvent.click(await within(menu).findByRole('button', { name: /cotizar con otro proveedor/i }));
    expect(screen.queryByRole('region', { name: /notificaciones/i })).toBeNull();
    expect(screen.getByTestId('selector')).toHaveTextContent('selector de q-7');
  });

  it('sin el Quodom (se borró) la notificación queda sin acciones', async () => {
    misQuodom.mockResolvedValue([]);
    montar();
    const menu = await abrir();
    expect(await within(menu).findByText(/fue enviado por WhatsApp/)).toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: /repetir pedido/i })).toBeNull();
  });

  it('lleva a ver todas', async () => {
    montar();
    const menu = await abrir();
    expect(within(menu).getByRole('link', { name: /ver todas/i })).toHaveAttribute('href', '/notificaciones');
  });
});
