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
  it('linkea a Buscar y a Modo IA', () => {
    montar();

    expect(screen.getByRole('link', { name: /buscar/i })).toHaveAttribute('href', '/busqueda');
    // Modo IA vive acá porque el header del home lo esconde al elegir un rubro.
    expect(screen.getByRole('link', { name: /modo ia/i })).toHaveAttribute('href', '/modo-ia');
  });
});
