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

const CONFLICTO = {
  idrubro: 7,
  quodomExistente: {
    id: 'q-7', descripcion: 'Bebidas oficina', estado: 'CREADO', nro: 'QD-7',
    idrubro: 7, nombrerubro: 'Bebidas', cantproductos: 3, createdBy: 'u-1', iddireccion: null
  },
  lineasInvitado: 2
} as unknown as Awaited<ReturnType<typeof planificarMigracion>>['conflictos'][number];

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

  it('no ofrece salir del conflicto mientras no falle nada', async () => {
    signin.mockResolvedValue(undefined);
    vi.mocked(planificarMigracion).mockResolvedValue({ sinConflicto: [], conflictos: [CONFLICTO] });

    render(<MemoryRouter><SignIn /></MemoryRouter>);
    fillAndSubmit();

    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: /integrar los dos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reemplazar/i })).toBeInTheDocument();
    // Integrar no destruye nada, así que postergar sólo deja un carrito
    // huérfano conviviendo con el Quodom del servidor: no se ofrece.
    expect(screen.queryByRole('button', { name: /ahora no|continuar sin integrar/i })).toBeNull();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('ofrece continuar sin integrar recién cuando la migración falla', async () => {
    signin.mockResolvedValue(undefined);
    vi.mocked(planificarMigracion).mockResolvedValue({ sinConflicto: [], conflictos: [CONFLICTO] });
    vi.mocked(migrarRubro).mockRejectedValue(new Error('network down'));

    render(<MemoryRouter><SignIn /></MemoryRouter>);
    fillAndSubmit();

    fireEvent.click(await screen.findByRole('button', { name: /integrar los dos/i }));

    // Sin esta salida el usuario queda encerrado en el login si el servidor no responde.
    const salir = await screen.findByRole('button', { name: /continuar sin integrar/i });
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(salir);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('navigates away with no error when there is nothing to migrate', async () => {
    signin.mockResolvedValue(undefined);
    vi.mocked(planificarMigracion).mockResolvedValue({ sinConflicto: [], conflictos: [] });

    render(<MemoryRouter><SignIn /></MemoryRouter>);
    fillAndSubmit();

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});
