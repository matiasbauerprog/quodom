import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignIn } from '../SignIn';
import { useAuth } from '../../../auth/AuthContext';
import { planificarMigracion, migrarRubro } from '../../../guest/migrateGuestQuodom';

vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../guest/migrateGuestQuodom', () => ({
  planificarMigracion: vi.fn(),
  migrarRubro: vi.fn()
}));

const signin = vi.fn();

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText(/usuario o email/i), { target: { value: 'ana' } });
  fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'secreto123' } });
  fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));
}

describe('SignIn', () => {
  beforeEach(() => {
    signin.mockReset();
    vi.mocked(useAuth).mockReturnValue({ signin } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(planificarMigracion).mockReset();
    vi.mocked(migrarRubro).mockReset();
  });

  it('shows the sign-in error when signin itself fails', async () => {
    signin.mockRejectedValue(new Error('Usuario o contraseña incorrectos.'));

    render(<MemoryRouter><SignIn /></MemoryRouter>);
    fillAndSubmit();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos.'));
    expect(planificarMigracion).not.toHaveBeenCalled();
  });

  it('shows a distinct message when signin succeeds but migration fails, not a login error', async () => {
    signin.mockResolvedValue(undefined);
    vi.mocked(planificarMigracion).mockResolvedValue({ sinConflicto: [4], conflictos: [] });
    vi.mocked(migrarRubro).mockRejectedValue(new Error('network down'));

    render(<MemoryRouter><SignIn /></MemoryRouter>);
    fillAndSubmit();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    const message = screen.getByRole('alert').textContent ?? '';
    expect(message).not.toBe('No se pudo ingresar.');
    expect(message.toLowerCase()).toContain('ingresaste');
    expect(message.toLowerCase()).toContain('migra');
  });

  it('navigates away with no error when there is nothing to migrate', async () => {
    signin.mockResolvedValue(undefined);
    vi.mocked(planificarMigracion).mockResolvedValue({ sinConflicto: [], conflictos: [] });

    render(<MemoryRouter><SignIn /></MemoryRouter>);
    fillAndSubmit();

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});
