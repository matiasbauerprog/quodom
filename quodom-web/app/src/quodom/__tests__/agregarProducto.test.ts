import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agregarProducto, agregarADestino, crearYAgregar } from '../agregarProducto';
import { abrirQuodom, abiertoDe } from '../quodomAbierto';
import { quodom as quodomApi } from '../../api/quodom';
import { quodomLines } from '../../api/quodom_lines';
import { ApiError } from '../../api/client';
import { getGuestCart, clearGuestQuodoms } from '../../guest/guestQuodom';
import type { Quodom } from '../../api/types';

vi.mock('../../api/quodom', () => ({
  quodom: { activosPorRubro: vi.fn(), create: vi.fn() }
}));
vi.mock('../../api/quodom_lines', () => ({
  quodomLines: { add: vi.fn() }
}));

const LINEA = { idproducto: 700, nombreProducto: 'Gaseosa 2L', cantidad: 1 };
const QUODOM_CASA = { id: 'q-casa', descripcion: 'Casa', idrubro: 5 } as unknown as Quodom;
const QUODOM_DEPTO = { id: 'q-depto', descripcion: 'Depto', idrubro: 5 } as unknown as Quodom;

describe('agregarProducto con un Quodom abierto', () => {
  beforeEach(() => { localStorage.clear(); clearGuestQuodoms(); vi.resetAllMocks(); });

  it('agrega al abierto del rubro, sin preguntar', async () => {
    abrirQuodom(5, 'q-casa');
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 1 });

    const res = await agregarProducto(LINEA, { logueado: true, idrubro: 5 });

    expect(res.estado).toBe('agregado');
    expect(quodomLines.add).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'q-casa' }));
    expect(quodomApi.activosPorRubro).not.toHaveBeenCalled();
  });

  it('pide elegir cuando el rubro no tiene ninguno abierto', async () => {
    vi.mocked(quodomApi.activosPorRubro).mockResolvedValue([QUODOM_CASA, QUODOM_DEPTO]);

    const res = await agregarProducto(LINEA, { logueado: true, idrubro: 5 });

    expect(res).toEqual({ estado: 'elegir_destino', idrubro: 5, candidatos: [QUODOM_CASA, QUODOM_DEPTO] });
    expect(quodomLines.add).not.toHaveBeenCalled();
  });

  // El abierto apunta a un Quodom que ya no existe.
  it('pide elegir si el abierto ya no está entre los activos', async () => {
    abrirQuodom(5, 'q-borrado');
    vi.mocked(quodomApi.activosPorRubro).mockResolvedValue([QUODOM_CASA]);
    vi.mocked(quodomLines.add).mockRejectedValue(new ApiError('Err. Quodom no encontrado.', 400));

    const res = await agregarProducto(LINEA, { logueado: true, idrubro: 5 });

    expect(res.estado).toBe('elegir_destino');
    expect(abiertoDe(5)).toBeNull();
  });

  it('agregar a un destino lo deja abierto', async () => {
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 1 });

    await agregarADestino(LINEA, 5, 'q-depto');

    expect(abiertoDe(5)).toBe('q-depto');
  });

  it('crear y agregar deja abierto el nuevo', async () => {
    vi.mocked(quodomApi.create).mockResolvedValue({ res: true, idquodom: 'q-nuevo' });
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 1 });

    const id = await crearYAgregar(LINEA, 5, 'Mi Quodom');

    expect(id).toBe('q-nuevo');
    expect(abiertoDe(5)).toBe('q-nuevo');
  });

  // Dos `+` seguidos sin esperar al primero.
  it('dos agregados seguidos van los dos al mismo abierto', async () => {
    abrirQuodom(5, 'q-casa');
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 1 });

    await Promise.all([
      agregarProducto(LINEA, { logueado: true, idrubro: 5 }),
      agregarProducto(LINEA, { logueado: true, idrubro: 5 })
    ]);

    const destinos = vi.mocked(quodomLines.add).mock.calls.map(c => c[0].idquodom);
    expect(destinos).toEqual(['q-casa', 'q-casa']);
  });

  it('el invitado sigue teniendo un carrito por rubro y no elige nada', async () => {
    const res = await agregarProducto(LINEA, { logueado: false, idrubro: 5 });

    expect(res).toEqual({ estado: 'agregado', idquodom: null });
    expect(getGuestCart(5).lines).toEqual([LINEA]);
  });
});

// Con el panel cerrado no se ve el árbol: el panel muestra un aviso cuando
// algo entró, y para eso cada camino que agrega lo anuncia.
describe('agregarProducto anuncia lo que agregó', () => {
  beforeEach(() => { localStorage.clear(); clearGuestQuodoms(); vi.resetAllMocks(); });

  function escuchar() {
    const avisos: unknown[] = [];
    const oir = (e: Event) => avisos.push((e as CustomEvent).detail);
    window.addEventListener('quodom:agregado', oir);
    return { avisos, dejar: () => window.removeEventListener('quodom:agregado', oir) };
  }

  it('con + al abierto', async () => {
    abrirQuodom(5, 'q-casa');
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 1 });
    const { avisos, dejar } = escuchar();
    await agregarProducto(LINEA, { logueado: true, idrubro: 5 });
    dejar();
    expect(avisos).toEqual([{ nombre: 'Gaseosa 2L', idrubro: 5, idquodom: 'q-casa' }]);
  });

  it('a un destino elegido y a uno nuevo', async () => {
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 1 });
    vi.mocked(quodomApi.create).mockResolvedValue({ res: true, idquodom: 'q-nuevo' });
    const { avisos, dejar } = escuchar();
    await agregarADestino(LINEA, 5, 'q-depto');
    await crearYAgregar(LINEA, 5, 'Nuevo');
    dejar();
    expect(avisos).toEqual([
      { nombre: 'Gaseosa 2L', idrubro: 5, idquodom: 'q-depto' },
      { nombre: 'Gaseosa 2L', idrubro: 5, idquodom: 'q-nuevo' }
    ]);
  });

  it('al carrito del invitado', async () => {
    const { avisos, dejar } = escuchar();
    await agregarProducto(LINEA, { logueado: false, idrubro: 5 });
    dejar();
    expect(avisos).toEqual([{ nombre: 'Gaseosa 2L', idrubro: 5, idquodom: null }]);
  });

  it('si falla no anuncia nada', async () => {
    vi.mocked(quodomLines.add).mockRejectedValue(new Error('red'));
    const { avisos, dejar } = escuchar();
    await expect(agregarADestino(LINEA, 5, 'q-depto')).rejects.toThrow();
    dejar();
    expect(avisos).toEqual([]);
  });
});
