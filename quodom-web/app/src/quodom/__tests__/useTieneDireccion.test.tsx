import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTieneDireccion } from '../useTieneDireccion';
import { users as usersApi } from '../../api/users';

vi.mock('../../api/users', () => ({ users: { getDirecciones: vi.fn() } }));

const getDirecciones = usersApi.getDirecciones as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => { getDirecciones.mockReset(); });

describe('useTieneDireccion', () => {
  it('es true cuando el usuario tiene al menos una dirección', async () => {
    getDirecciones.mockResolvedValue([{ id: 1 }]);

    const { result } = renderHook(() => useTieneDireccion(true));

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('es false cuando no tiene ninguna', async () => {
    getDirecciones.mockResolvedValue([]);

    const { result } = renderHook(() => useTieneDireccion(true));

    await waitFor(() => expect(result.current).toBe(false));
  });

  // Mientras no contestó no hay con qué bloquear: un false optimista
  // deshabilitaría el botón y mostraría un motivo que puede ser falso.
  it('arranca en true y no pregunta sin sesión', () => {
    const { result } = renderHook(() => useTieneDireccion(false));

    expect(result.current).toBe(true);
    expect(getDirecciones).not.toHaveBeenCalled();
  });

  // Si la consulta falla, el backend sigue siendo la red de contención: más
  // vale dejar intentar el envío que trabarlo por un error de red.
  it('no bloquea si la consulta falla', async () => {
    getDirecciones.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useTieneDireccion(true));

    await waitFor(() => expect(getDirecciones).toHaveBeenCalled());
    expect(result.current).toBe(true);
  });
});

// El sidebar vive en el Layout y no se desmonta al ir a cargar la dirección,
// así que sin esto volvía al home todavía bloqueado.
describe('useTieneDireccion al cargar una dirección', () => {
  it('vuelve a preguntar con direcciones:changed', async () => {
    getDirecciones.mockResolvedValue([]);
    const { result } = renderHook(() => useTieneDireccion(true));
    await waitFor(() => expect(result.current).toBe(false));

    getDirecciones.mockResolvedValue([{ id: 1 }]);
    act(() => { window.dispatchEvent(new Event('direcciones:changed')); });

    await waitFor(() => expect(result.current).toBe(true));
  });
});
