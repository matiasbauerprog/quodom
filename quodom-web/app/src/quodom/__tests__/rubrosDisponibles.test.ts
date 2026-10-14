import { describe, it, expect, vi, beforeEach } from 'vitest';
import { categorias } from '../../api/categorias';
import { rubrosDisponibles, reiniciarCacheRubros } from '../rubrosDisponibles';

vi.mock('../../api/categorias', () => ({ categorias: { raiz: vi.fn() } }));
const raiz = categorias.raiz as unknown as ReturnType<typeof vi.fn>;

describe('rubrosDisponibles', () => {
  beforeEach(() => { raiz.mockReset(); reiniciarCacheRubros(); });

  it('reutiliza la consulta en llamadas repetidas', async () => {
    raiz.mockResolvedValue([{ id: 1 }, { id: 5 }]);
    expect(await rubrosDisponibles()).toEqual([1, 5]);
    expect(await rubrosDisponibles()).toEqual([1, 5]);
    expect(raiz).toHaveBeenCalledTimes(1);
  });

  it('un fallo no queda cacheado: la llamada siguiente reintenta', async () => {
    raiz.mockRejectedValueOnce(new Error('caído'));
    await expect(rubrosDisponibles()).rejects.toThrow('caído');

    raiz.mockResolvedValue([{ id: 1 }]);
    expect(await rubrosDisponibles()).toEqual([1]);
    expect(raiz).toHaveBeenCalledTimes(2);
  });
});
