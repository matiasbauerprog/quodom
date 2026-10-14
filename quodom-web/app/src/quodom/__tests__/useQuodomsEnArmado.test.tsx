import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useQuodomsEnArmado } from '../useQuodomsEnArmado';
import { quodom as quodomApi } from '../../api/quodom';
import { rubrosDisponibles } from '../rubrosDisponibles';
import { abrirQuodom, leerAbiertos } from '../quodomAbierto';

vi.mock('../../api/quodom', () => ({ quodom: { misQuodom: vi.fn() } }));
vi.mock('../rubrosDisponibles', () => ({ rubrosDisponibles: vi.fn(), reiniciarCacheRubros: vi.fn() }));

const misQuodom = quodomApi.misQuodom as unknown as ReturnType<typeof vi.fn>;
const CASA = { id: 'p1', descripcion: 'Casa', estado: 'CREADO', nro: 'QD-1', idrubro: 5, nombrerubro: 'Pinturería', cantproductos: 2 };
const OBRA = { id: 'o1', descripcion: 'Obra', estado: 'CREADO', nro: 'QD-2', idrubro: 4, nombrerubro: 'Construcción', cantproductos: 1 };

describe('useQuodomsEnArmado', () => {
  beforeEach(() => {
    misQuodom.mockReset();
    localStorage.clear();
    vi.mocked(rubrosDisponibles).mockResolvedValue([4, 5]);
  });

  it('una carga buena arma las ramas y poda los abiertos que ya no existen', async () => {
    abrirQuodom(5, 'p1');
    abrirQuodom(4, 'fantasma');
    misQuodom.mockResolvedValue([CASA]);

    const { result } = renderHook(() => useQuodomsEnArmado('u-1'));

    await waitFor(() => expect(result.current.list).not.toBeNull());
    expect(result.current.ramas.map(r => r.idrubro)).toEqual([5]);
    expect(leerAbiertos()).toEqual({ 5: 'p1' });
  });

  it('si falla la lista de Quodoms conserva los abiertos y no poda', async () => {
    abrirQuodom(5, 'p1');
    misQuodom.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useQuodomsEnArmado('u-1'));

    await waitFor(() => expect(result.current.list).toEqual([]));
    expect(leerAbiertos()).toEqual({ 5: 'p1' });
  });

  it('un refresco fallido no pisa la última lista buena', async () => {
    misQuodom.mockResolvedValue([CASA]);
    const { result } = renderHook(() => useQuodomsEnArmado('u-1'));
    await waitFor(() => expect(result.current.ramas).toHaveLength(1));

    misQuodom.mockRejectedValue(new Error('boom'));
    act(() => { window.dispatchEvent(new Event('quodom:changed')); });
    await waitFor(() => expect(misQuodom).toHaveBeenCalledTimes(2));
    await act(async () => {});

    expect(result.current.ramas).toHaveLength(1);
  });

  it('si fallan los rubros igual devuelve las ramas, sin filtrar', async () => {
    vi.mocked(rubrosDisponibles).mockRejectedValue(new Error('categorias caídas'));
    misQuodom.mockResolvedValue([CASA, OBRA]);

    const { result } = renderHook(() => useQuodomsEnArmado('u-1'));

    await waitFor(() => expect(result.current.ramas.map(r => r.idrubro)).toEqual([4, 5]));
  });

  it('en una carga buena excluye el rubro retirado', async () => {
    vi.mocked(rubrosDisponibles).mockResolvedValue([4]);
    misQuodom.mockResolvedValue([CASA, OBRA]);

    const { result } = renderHook(() => useQuodomsEnArmado('u-1'));

    await waitFor(() => expect(result.current.list).toHaveLength(2));
    expect(result.current.ramas.map(r => r.idrubro)).toEqual([4]);
  });

  it('sin usuario no consulta y devuelve una lista vacía', async () => {
    const { result } = renderHook(() => useQuodomsEnArmado(undefined));

    await waitFor(() => expect(result.current.list).toEqual([]));
    expect(misQuodom).not.toHaveBeenCalled();
  });
});
