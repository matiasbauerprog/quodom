import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DetalleUsuario } from '../DetalleUsuario';
import { users as usersApi } from '../../../api/users';
import { useAuth } from '../../../auth/AuthContext';

vi.mock('../../../api/users', () => ({ users: { update: vi.fn() } }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));

const update = usersApi.update as unknown as ReturnType<typeof vi.fn>;

const ANA = {
  id: 'u-1', username: 'ana@test.com', email: 'ana@test.com', nombre: 'Ana', apellido: 'Perez',
  codArea: '011', telefono: '55554444', empresa: '', cuit: '', facturaA: false
};

function montar(user: Partial<typeof ANA> = {}) {
  vi.mocked(useAuth).mockReturnValue({
    user: { ...ANA, ...user }, refresh: vi.fn()
  } as unknown as ReturnType<typeof useAuth>);
  return render(<MemoryRouter><DetalleUsuario /></MemoryRouter>);
}

beforeEach(() => {
  update.mockReset();
  update.mockResolvedValue({ res: true, message: 'Guardado.' });
});

// El perfil se achicó a lo que el proveedor necesita: el DNI no se usa para
// nada y el usuario dejó de existir como concepto — se entra con el mail.
describe('DetalleUsuario: campos que ya no están', () => {
  it('no muestra DNI', () => {
    montar();

    expect(screen.queryByLabelText(/dni/i)).toBeNull();
  });

  it('no muestra Usuario', () => {
    montar();

    expect(screen.queryByLabelText(/^usuario$/i)).toBeNull();
  });

  it('no manda ni dni ni username al guardar', async () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    const enviado = update.mock.calls[0][0];
    expect(enviado).not.toHaveProperty('dni');
    expect(enviado).not.toHaveProperty('username');
  });
});

describe('DetalleUsuario: teléfono y código de área', () => {
  it('muestra el código de área fijo en 011 y no deja cambiarlo', () => {
    montar();

    const cod = screen.getByLabelText(/cód\. área/i) as HTMLInputElement;
    expect(cod.value).toBe('011');
    expect(cod).toBeDisabled();
  });

  it('descarta lo que no sea dígito y corta en 8', () => {
    montar();

    const tel = screen.getByLabelText(/teléfono/i) as HTMLInputElement;
    fireEvent.change(tel, { target: { value: '15-5555 4444999' } });

    expect(tel.value).toBe('15555544');
  });

  // El proveedor tiene que poder llamar: un número a medias no sirve.
  it('no deja guardar con menos de 8 dígitos', async () => {
    montar({ telefono: '5555' });

    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText(/8 dígitos/i)).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });
});

describe('DetalleUsuario: datos de empresa', () => {
  it('ofrece nombre, CUIT y el tilde de Factura A', () => {
    montar();

    expect(screen.getByLabelText(/empresa/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cuit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/factura a/i)).toBeInTheDocument();
  });

  it('parte de lo que ya tenía cargado', () => {
    montar({ empresa: 'Command', cuit: '30-7', facturaA: true });

    expect((screen.getByLabelText(/empresa/i) as HTMLInputElement).value).toBe('Command');
    expect((screen.getByLabelText(/cuit/i) as HTMLInputElement).value).toBe('30-7');
    expect(screen.getByLabelText(/factura a/i)).toBeChecked();
  });

  it('los manda al guardar', async () => {
    montar();

    fireEvent.change(screen.getByLabelText(/empresa/i), { target: { value: 'Command Soluciones' } });
    fireEvent.change(screen.getByLabelText(/cuit/i), { target: { value: '30-71234567-8' } });
    fireEvent.click(screen.getByLabelText(/factura a/i));
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({
      empresa: 'Command Soluciones', cuit: '30-71234567-8', facturaA: true
    })));
  });
});

// Los teléfonos viejos traen el código de área adentro (11 dígitos). Recortar
// a 8 mostraba "01156956": un número que no es el de nadie, y que el usuario
// habría guardado sin darse cuenta de que no es el suyo.
describe('DetalleUsuario: teléfonos que no encajan', () => {
  it('arranca vacío cuando lo guardado no son 8 dígitos limpios', () => {
    montar({ telefono: '01156956789' });

    expect((screen.getByLabelText(/teléfono/i) as HTMLInputElement).value).toBe('');
  });

  it('conserva el que ya está bien', () => {
    montar({ telefono: '55554444' });

    expect((screen.getByLabelText(/teléfono/i) as HTMLInputElement).value).toBe('55554444');
  });
});
