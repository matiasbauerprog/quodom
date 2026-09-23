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

type Conflicto = Awaited<ReturnType<typeof planificarMigracion>>['conflictos'][number];

function conflicto(idrubro: number, nombrerubro: string): Conflicto {
  return {
    idrubro,
    quodomExistente: {
      id: 'q-' + idrubro, descripcion: nombrerubro + ' oficina', estado: 'CREADO', nro: 'QD-' + idrubro,
      idrubro, nombrerubro, cantproductos: 3, createdBy: 'u-1', iddireccion: null
    },
    lineasInvitado: 2
  } as unknown as Conflicto;
}

const CONFLICTO = conflicto(7, 'Bebidas');
const CONFLICTO_LIMPIEZA = conflicto(1, 'Limpieza');

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
    vi.mocked(planificarMigracion).mockResolvedValue({ sinConflicto: [4], conflictos: [], noDisponibles: [] });
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
    vi.mocked(planificarMigracion).mockResolvedValue({ sinConflicto: [], conflictos: [CONFLICTO], noDisponibles: [] });

    render(<MemoryRouter><SignIn /></MemoryRouter>);
    fillAndSubmit();

    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: /sumar todo a ese quodom/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reemplazar/i })).toBeInTheDocument();
    // Integrar no destruye nada, así que postergar sólo deja un carrito
    // huérfano conviviendo con el Quodom del servidor: no se ofrece.
    expect(screen.queryByRole('button', { name: /ahora no|continuar sin integrar/i })).toBeNull();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('ofrece continuar sin integrar recién cuando la migración falla', async () => {
    signin.mockResolvedValue(undefined);
    vi.mocked(planificarMigracion).mockResolvedValue({ sinConflicto: [], conflictos: [CONFLICTO], noDisponibles: [] });
    vi.mocked(migrarRubro).mockRejectedValue(new Error('network down'));

    render(<MemoryRouter><SignIn /></MemoryRouter>);
    fillAndSubmit();

    fireEvent.click(await screen.findByRole('button', { name: /sumar todo a ese quodom/i }));

    // Sin esta salida el usuario queda encerrado en el login si el servidor no responde.
    const salir = await screen.findByRole('button', { name: /continuar sin integrar/i });
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(salir);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('deja de ofrecer la salida en el conflicto siguiente', async () => {
    // "Continuar sin integrar" existe sólo para destrabar un fallo puntual.
    // Si quedara pegada, el resto de la cola podría abandonarse sin que nada
    // haya fallado, reabriendo el agujero de carritos huérfanos.
    signin.mockResolvedValue(undefined);
    vi.mocked(planificarMigracion).mockResolvedValue({ sinConflicto: [], conflictos: [CONFLICTO, CONFLICTO_LIMPIEZA], noDisponibles: [] });
    vi.mocked(migrarRubro).mockRejectedValue(new Error('network down'));

    render(<MemoryRouter><SignIn /></MemoryRouter>);
    fillAndSubmit();

    fireEvent.click(await screen.findByRole('button', { name: /sumar todo a ese quodom/i }));
    fireEvent.click(await screen.findByRole('button', { name: /continuar sin integrar/i }));

    await waitFor(() => expect(screen.getByText(/Quodom de Limpieza ya abierto/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /continuar sin integrar/i })).toBeNull();
  });

  it('navigates away with no error when there is nothing to migrate', async () => {
    signin.mockResolvedValue(undefined);
    vi.mocked(planificarMigracion).mockResolvedValue({ sinConflicto: [], conflictos: [], noDisponibles: [] });

    render(<MemoryRouter><SignIn /></MemoryRouter>);
    fillAndSubmit();

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});
