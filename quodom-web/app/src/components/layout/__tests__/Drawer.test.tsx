import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Drawer } from '../Drawer';
import { useAuth } from '../../../auth/AuthContext';
import { quodom as quodomApi } from '../../../api/quodom';

vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../api/quodom', () => ({ quodom: { misQuodom: vi.fn() } }));

function montar() {
  vi.mocked(useAuth).mockReturnValue(
    { user: null, signout: vi.fn() } as unknown as ReturnType<typeof useAuth>
  );
  render(<MemoryRouter><Drawer open onClose={() => {}} /></MemoryRouter>);
}

describe('Drawer', () => {
  // La entrada "Buscar" se apagó el 2026-09-22: el buscador del home cubre lo
  // mismo y muestra resultados mientras se escribe. La pantalla y su ruta
  // siguen existiendo; este test vuelve junto con la línea comentada en
  // Drawer.tsx.
  it('ya no ofrece Buscar: el buscador vive en el home', () => {
    montar();

    expect(screen.queryByRole('link', { name: /buscar/i })).toBeNull();
  });

  // `montar` entra sin sesión: las secciones de usuario no se muestran, y lo
  // que queda es Inicio más la invitación a ingresar.
  it('sin sesión deja Inicio y la entrada a ingresar', () => {
    montar();

    expect(screen.getByRole('link', { name: /inicio/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /ingresar/i })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('link', { name: /mis quodoms/i })).toBeNull();
  });
});

// Al cotizar, el Quodom sale del arbol (el backend lo pasa a ENVIADO) y el
// usuario no tiene como saber adonde fue. La cuenta al lado de "Historial de
// pedidos" es esa referencia: en escritorio el menu esta siempre a la vista, asi
// que el arbol pierde uno y el historial gana uno en el mismo momento.
describe('Drawer: la cuenta del historial', () => {
  const misQuodom = quodomApi.misQuodom as unknown as ReturnType<typeof vi.fn>;

  function conSesion() {
    vi.mocked(useAuth).mockReturnValue(
      { user: { id: 'u-1', nombre: 'Mati' }, signout: vi.fn() } as unknown as ReturnType<typeof useAuth>
    );
    render(<MemoryRouter><Drawer open onClose={() => {}} /></MemoryRouter>);
  }

  const enviado = (n: number) => ({ id: 'e' + n, estado: 'ENVIADO', nro: 'QD-' + n, idrubro: 5 });
  const armando = (n: number) => ({ id: 'a' + n, estado: 'CREADO', nro: 'QD-' + n, idrubro: 5 });

  beforeEach(() => { misQuodom.mockReset(); });

  it('cuenta solo los enviados, no los que estan en armado', async () => {
    misQuodom.mockResolvedValue([enviado(1), enviado(2), armando(3)]);
    conSesion();

    const link = await screen.findByRole('link', { name: /historial de pedidos/i });
    expect(link).toHaveTextContent('2');
    expect(link).not.toHaveTextContent('3');
  });

  it('sin enviados no muestra ninguna cuenta', async () => {
    misQuodom.mockResolvedValue([armando(1)]);
    conSesion();

    await screen.findByRole('link', { name: /historial de pedidos/i });
    expect(screen.getByRole('link', { name: /historial de pedidos/i })).not.toHaveTextContent(/\d/);
  });

  // Enviar dispara `quodom:changed`, que es como el arbol se entera: la cuenta
  // tiene que escuchar lo mismo o se queda vieja justo cuando importa.
  it('se actualiza cuando un Quodom cambia de estado', async () => {
    misQuodom.mockResolvedValue([enviado(1)]);
    conSesion();
    const link = await screen.findByRole('link', { name: /historial de pedidos/i });
    expect(link).toHaveTextContent('1');

    misQuodom.mockResolvedValue([enviado(1), enviado(2)]);
    await act(async () => { window.dispatchEvent(new Event('quodom:changed')); });

    await waitFor(() => expect(screen.getByRole('link', { name: /historial de pedidos/i })).toHaveTextContent('2'));
  });

  // Si la cuenta falla, el menu tiene que seguir siendo un menu.
  it('si no se puede contar, la entrada sigue estando', async () => {
    misQuodom.mockRejectedValue(new Error('sin red'));
    conSesion();

    expect(await screen.findByRole('link', { name: /historial de pedidos/i })).toBeInTheDocument();
  });
});
