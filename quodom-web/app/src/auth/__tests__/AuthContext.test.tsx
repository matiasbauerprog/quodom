import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { users as usersApi } from '../../api/users';

vi.mock('../../api/users', () => ({ users: { signin: vi.fn(), current: vi.fn(), signout: vi.fn() } }));

const signin = usersApi.signin as unknown as ReturnType<typeof vi.fn>;
const current = usersApi.current as unknown as ReturnType<typeof vi.fn>;

function Sonda() {
  const { user, signin: entrar } = useAuth();
  return (
    <>
      <button onClick={() => entrar('ana@test.com', 'secreto123')}>entrar</button>
      <p data-testid="tel">{user?.telefono ?? 'sin teléfono'}</p>
    </>
  );
}

beforeEach(() => {
  signin.mockReset();
  current.mockReset();
});

// La respuesta de /signin no trae teléfono ni datos de empresa: guardarla como
// el usuario dejaba el perfil vacío hasta recargar la página, justo después de
// que el alta los había pedido.
describe('AuthContext.signin', () => {
  it('deja al usuario completo, con lo que devuelve /users/current', async () => {
    current.mockRejectedValueOnce(new Error('401'));
    signin.mockResolvedValue({ res: true, id: 'u-1', username: 'ana@test.com', email: 'ana@test.com' });
    current.mockResolvedValue({ id: 'u-1', username: 'ana@test.com', email: 'ana@test.com', telefono: '55554444' });

    render(<AuthProvider><Sonda /></AuthProvider>);
    await waitFor(() => expect(current).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText('entrar'));

    await waitFor(() => expect(screen.getByTestId('tel')).toHaveTextContent('55554444'));
  });
});
