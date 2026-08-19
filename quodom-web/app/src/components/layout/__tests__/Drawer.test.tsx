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
  it('linkea a Modo IA en lugar de a Buscar', () => {
    montar();

    // La búsqueda se dio de baja: con cinco rubros y las subcategorías a un
    // clic dejó de tener razón de ser.
    expect(screen.queryByRole('link', { name: /buscar/i })).toBeNull();
    // Modo IA vive acá porque el header del home lo esconde al elegir un rubro.
    expect(screen.getByRole('link', { name: /modo ia/i })).toHaveAttribute('href', '/modo-ia');
  });
});
