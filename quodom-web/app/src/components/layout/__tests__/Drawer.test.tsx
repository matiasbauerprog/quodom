import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Drawer } from '../Drawer';
import { useAuth } from '../../../auth/AuthContext';

vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));

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
