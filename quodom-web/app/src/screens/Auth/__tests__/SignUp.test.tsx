import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignUp } from '../SignUp';
import { users as usersApi } from '../../../api/users';

vi.mock('../../../api/users', () => ({ users: { signup: vi.fn() } }));

const signup = usersApi.signup as unknown as ReturnType<typeof vi.fn>;

function montar() {
  return render(<MemoryRouter><SignUp /></MemoryRouter>);
}

function completar({ telefono = '55554444' } = {}) {
  fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'ana@test.com' } });
  fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'secreto123' } });
  fireEvent.change(screen.getByLabelText(/teléfono/i), { target: { value: telefono } });
}

beforeEach(() => {
  signup.mockReset();
  signup.mockResolvedValue({ res: true, message: 'ok' });
});

// Se entra con el mail: pedir además un usuario era un dato más para inventar
// y olvidar, y después ni siquiera se podía cambiar.
describe('SignUp', () => {
  it('no pide un usuario', () => {
    montar();

    expect(screen.queryByLabelText(/^usuario$/i)).toBeNull();
  });

  it('no manda username al registrarse', async () => {
    montar();
    completar();

    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(() => expect(signup).toHaveBeenCalled());
    expect(signup.mock.calls[0][0]).not.toHaveProperty('username');
  });

  it('muestra el código de área fijo y no deja cambiarlo', () => {
    montar();

    const cod = screen.getByLabelText(/cód\. área/i) as HTMLInputElement;
    expect(cod.value).toBe('011');
    expect(cod).toBeDisabled();
  });

  it('corta el teléfono en 8 dígitos y descarta el resto', () => {
    montar();

    const tel = screen.getByLabelText(/teléfono/i) as HTMLInputElement;
    fireEvent.change(tel, { target: { value: '15-5555 4444999' } });

    expect(tel.value).toBe('15555544');
  });

  it('no deja crear la cuenta con un teléfono incompleto', () => {
    montar();
    completar({ telefono: '5555' });

    expect(screen.getByRole('button', { name: /crear cuenta/i })).toBeDisabled();
  });
});
