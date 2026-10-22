import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppBar } from '../AppBar';
import { useAuth } from '../../../auth/AuthContext';

// La campanita pide la cuenta al montar; sin esto sale un fetch real.
vi.mock('../../../api/oper_notificaciones', () => ({ notificaciones: { count: vi.fn(() => Promise.resolve(0)), list: vi.fn(() => Promise.resolve([])), marcarLeida: vi.fn() } }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn(() => ({ user: null })) }));

function montar(url: string) {
  return render(<MemoryRouter initialEntries={[url]}><AppBar onOpenDrawer={() => {}} /></MemoryRouter>);
}

// El wordmark grande vive en el home y desaparece al entrar a un rubro. Sin
// esto el usuario quedaba sin marca a la vista y, peor, sin forma de volver:
// el logo chico de la barra es las dos cosas.
describe('AppBar', () => {
  it('no repite la marca en el home, donde el wordmark grande ya está', () => {
    montar('/');
    expect(screen.queryByRole('link', { name: /volver al inicio/i })).toBeNull();
  });

  it('muestra el logo al entrar a un rubro, y vuelve al inicio', () => {
    montar('/?rubro=7');
    const logo = screen.getByRole('link', { name: /volver al inicio/i });
    expect(within(logo).getByAltText('QUODOM')).toBeInTheDocument();
    expect(logo).toHaveAttribute('href', '/');
  });

  it('también lo muestra fuera del home', () => {
    montar('/mis-quodoms');
    expect(screen.getByRole('link', { name: /volver al inicio/i })).toBeInTheDocument();
  });

  it('sigue abriendo el menú', () => {
    montar('/');
    expect(screen.getByRole('button', { name: /abrir menú/i })).toBeInTheDocument();
  });
});

// Al abrir el chat el wordmark grande del home se esconde. Si acá tampoco
// aparecía, el usuario quedaba sin marca y, peor, sin forma de volver.
describe('AppBar (con el Modo IA abierto)', () => {
  it('muestra el logo cuando la conversación está abierta', () => {
    montar('/?ia=chat');
    expect(screen.getByRole('link', { name: /volver al inicio/i })).toBeInTheDocument();
  });
});

// En celular la campanita va arriba a la derecha, en el nav: en la barra de
// abajo competía con el destino y quedaba al lado del pulgar que arrastra.
describe('AppBar (campanita)', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'u-1' } } as unknown as ReturnType<typeof useAuth>);
  });
  afterEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as unknown as ReturnType<typeof useAuth>);
    vi.unstubAllGlobals();
  });

  it('en celular la muestra en el nav', () => {
    montar('/');
    expect(within(screen.getByRole('banner')).getByRole('button', { name: /notificaciones/i })).toBeInTheDocument();
  });

  it('en escritorio no, porque ya está en el panel', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
    montar('/');
    expect(screen.queryByRole('button', { name: /notificaciones/i })).toBeNull();
  });

  it('sin sesión no la muestra', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as unknown as ReturnType<typeof useAuth>);
    montar('/');
    expect(screen.queryByRole('button', { name: /notificaciones/i })).toBeNull();
  });
});
