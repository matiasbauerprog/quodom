import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ListaNotificaciones } from '../ListaNotificaciones';
import { notificaciones } from '../../../api/oper_notificaciones';
import { quodom as quodomApi } from '../../../api/quodom';
import { abrirQuodom } from '../../../quodom/quodomAbierto';

vi.mock('../../../api/oper_notificaciones', () => ({
  notificaciones: { list: vi.fn(), count: vi.fn(), marcarLeida: vi.fn() }
}));
vi.mock('../../../api/quodom', () => ({ quodom: { misQuodom: vi.fn(), repetir: vi.fn() } }));
vi.mock('../../../quodom/quodomAbierto', () => ({ abrirQuodom: vi.fn() }));
// El selector pega a Google y tiene su propia suite.
vi.mock('../../../quodom/DialogoProveedores', () => ({
  DialogoProveedores: ({ idquodom }: { idquodom: string }) => <div data-testid="selector">selector de {idquodom}</div>
}));

const list = notificaciones.list as unknown as ReturnType<typeof vi.fn>;
const marcarLeida = notificaciones.marcarLeida as unknown as ReturnType<typeof vi.fn>;
const misQuodom = quodomApi.misQuodom as unknown as ReturnType<typeof vi.fn>;
const repetir = quodomApi.repetir as unknown as ReturnType<typeof vi.fn>;

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
    <MemoryRouter initialEntries={['/notificaciones']}>
      <ListaNotificaciones />
      <Routes><Route path="*" element={<Ubicacion />} /></Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([NOTIF(1, 'q-7'), NOTIF(2, 'q-7', 1)]);
  marcarLeida.mockResolvedValue({ res: true });
  misQuodom.mockResolvedValue([ENVIADO]);
});

// "Ver todas" de la campana llega acá: tiene que poder hacer lo mismo.
describe('ListaNotificaciones', () => {
  it('nombra el Quodom enviado', async () => {
    montar();
    expect((await screen.findAllByText(/Bebidas oficina/)).length).toBe(2);
    expect(screen.getAllByText(/QD-7 · Bebidas/).length).toBe(2);
  });

  it('entrar marca las no leídas y avisa a la campana', async () => {
    const leidas = vi.fn();
    window.addEventListener('notificaciones:leidas', leidas);
    montar();
    await waitFor(() => expect(leidas).toHaveBeenCalled());
    expect(marcarLeida).toHaveBeenCalledTimes(1);
    expect(marcarLeida).toHaveBeenCalledWith(1);
    window.removeEventListener('notificaciones:leidas', leidas);
  });

  it('Historial lleva al pedido', async () => {
    montar();
    fireEvent.click((await screen.findAllByRole('button', { name: /ver en historial/i }))[0]);
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/mis-quodoms?pedido=q-7');
  });

  it('Repetir crea uno nuevo y lo deja abierto en su rubro', async () => {
    repetir.mockResolvedValue({ res: true, idquodom: 'q-nuevo' });
    montar();
    fireEvent.click((await screen.findAllByRole('button', { name: /repetir pedido/i }))[0]);
    await waitFor(() => expect(abrirQuodom).toHaveBeenCalledWith(7, 'q-nuevo'));
    expect(repetir).toHaveBeenCalledWith('q-7');
    await waitFor(() => expect(screen.getByTestId('ubicacion')).toHaveTextContent('/notificaciones?quodom=q-nuevo&nombrar=1'));
  });

  it('si repetir falla lo dice', async () => {
    repetir.mockRejectedValue(new Error('No se pudo repetir.'));
    montar();
    fireEvent.click((await screen.findAllByRole('button', { name: /repetir pedido/i }))[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo repetir.');
    expect(abrirQuodom).not.toHaveBeenCalled();
  });

  it('Otro proveedor abre el selector de ese Quodom', async () => {
    montar();
    fireEvent.click((await screen.findAllByRole('button', { name: /cotizar con otro proveedor/i }))[0]);
    expect(screen.getByTestId('selector')).toHaveTextContent('selector de q-7');
  });

  it('sin el Quodom (se borró) la notificación queda sin acciones', async () => {
    misQuodom.mockResolvedValue([]);
    montar();
    expect((await screen.findAllByText(/fue enviado por WhatsApp/)).length).toBe(2);
    expect(screen.queryByRole('button', { name: /repetir pedido/i })).toBeNull();
  });
});
