import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { RutaQuodom, VentanaQuodom } from '../VentanaQuodom';
import { useAbrirQuodom } from '../../../quodom/ventanaQuodom';
import { useAuth } from '../../../auth/AuthContext';
import { quodom } from '../../../api/quodom';
import { quodomLines } from '../../../api/quodom_lines';
import { users } from '../../../api/users';

vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn(() => ({ user: { id: 'u1' } })) }));
vi.mock('../../../api/quodom', () => ({ quodom: { porId: vi.fn(), update: vi.fn() } }));
vi.mock('../../../api/quodom_lines', () => ({ quodomLines: { porQuodom: vi.fn(), update: vi.fn(), eliminar: vi.fn() } }));
vi.mock('../../../api/users', () => ({ users: { getDirecciones: vi.fn() } }));
vi.mock('../../../quodom/DialogoProveedores', () => ({
  DialogoProveedores: ({ onCerrar }: { onCerrar: () => void }) => (
    <div data-testid="selector"><button onClick={onCerrar}>cerrar selector</button></div>
  )
}));

const COPIA = { id: 'q-8', nro: 'QD-8', descripcion: 'Bebidas oficina', estado: 'CREADO', idrubro: 7, nombrerubro: 'Bebidas' };
const GASEOSA = { id: 1, idproducto: 700, nombreProducto: 'Gaseosa 2L', cantidad: 2 };

function Ubicacion() {
  const l = useLocation();
  return <div data-testid="ubicacion">{l.pathname + l.search}</div>;
}

function Abrir({ nombrar }: { nombrar?: boolean }) {
  const abrir = useAbrirQuodom();
  return <button onClick={() => abrir('q-8', { nombrar })}>abrir</button>;
}

function montar(ruta = '/notificaciones', nombrar = false) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/quodom" element={<RutaQuodom />} />
        <Route path="*" element={<><Abrir nombrar={nombrar} /><Ubicacion /></>} />
      </Routes>
      <VentanaQuodom />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'u1' } } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(users.getDirecciones).mockResolvedValue([{ id: 1 } as never]);
  vi.mocked(quodom.porId).mockResolvedValue(COPIA as never);
  vi.mocked(quodom.update).mockResolvedValue({ res: true } as never);
  vi.mocked(quodomLines.porQuodom).mockResolvedValue([GASEOSA] as never);
});

// El detalle era una pantalla entera: repetir desde el historial o la campana
// sacaba al usuario de donde estaba.
describe('VentanaQuodom', () => {
  it('abre el pedido encima de la pantalla en la que uno está', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'abrir' }));

    expect(await screen.findByRole('dialog', { name: 'Bebidas oficina' })).toBeInTheDocument();
    expect(await screen.findByText('Gaseosa 2L')).toBeInTheDocument();
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/notificaciones?quodom=q-8');
  });

  // "QD-8" se leía como un id interno, y "Descripción" no decía que ese campo
  // era el nombre.
  it('el título es el nombre editable, sin el número', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'abrir' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Bebidas oficina' });
    expect(screen.getByRole('textbox', { name: 'Nombre del Quodom' })).toHaveValue('Bebidas oficina');
    expect(dialogo).not.toHaveTextContent('QD-8');
  });

  it('la descripción es opcional y se guarda aparte del nombre', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'abrir' }));
    const detalle = await screen.findByRole('textbox', { name: 'Descripción' });
    expect(detalle).toHaveValue('');

    fireEvent.change(detalle, { target: { value: '  Para la oficina de Palermo ' } });
    fireEvent.blur(detalle);
    await waitFor(() => expect(quodom.update).toHaveBeenCalledWith('q-8', { detalle: 'Para la oficina de Palermo' }));
    expect(quodom.update).not.toHaveBeenCalledWith('q-8', expect.objectContaining({ descripcion: expect.anything() }));
  });

  it('cerrar vuelve a la pantalla de antes, sin la ventana', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'abrir' }));
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('ubicacion').textContent).toBe('/notificaciones');
  });

  it('Escape cierra y guarda el nombre que se estaba escribiendo', async () => {
    montar('/notificaciones', true);
    fireEvent.click(screen.getByRole('button', { name: 'abrir' }));
    const campo = await screen.findByDisplayValue('Bebidas oficina') as HTMLInputElement;
    await waitFor(() => expect(document.activeElement).toBe(campo));
    // El parámetro se saca sin perder que la ventana la abrimos nosotros.
    await waitFor(() => expect(screen.getByTestId('ubicacion').textContent).toBe('/notificaciones?quodom=q-8'));

    fireEvent.change(campo, { target: { value: 'Bebidas fiesta' } });
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(quodom.update).toHaveBeenCalledWith('q-8', { descripcion: 'Bebidas fiesta' });
    expect(screen.getByTestId('ubicacion').textContent).toBe('/notificaciones');
  });

  it('Cotizar cambia la ventana por la de proveedores y al cerrarla vuelve al pedido', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'abrir' }));
    await screen.findByText('Gaseosa 2L');

    fireEvent.click(screen.getByRole('button', { name: /cotizar por whatsapp/i }));
    expect(screen.getByTestId('selector')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'cerrar selector' }));
    expect(await screen.findByRole('dialog', { name: 'Bebidas oficina' })).toBeInTheDocument();
  });

  it('un link viejo a /quodom?id= abre la ventana sobre el inicio', async () => {
    montar('/quodom?id=q-8');
    expect(await screen.findByRole('dialog', { name: 'Bebidas oficina' })).toBeInTheDocument();
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/?quodom=q-8');

    // Sin una entrada propia a la que volver, cerrar saca el parámetro.
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('ubicacion').textContent).toBe('/');
  });
});
