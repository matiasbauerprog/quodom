import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agregarProducto, confirmarYAgregar } from '../agregarProducto';
import { quodom as quodomApi } from '../../api/quodom';
import { quodomLines } from '../../api/quodom_lines';
import { getGuestCart, clearGuestQuodoms } from '../../guest/guestQuodom';

vi.mock('../../api/quodom', () => ({
  quodom: { activoPorRubro: vi.fn(), create: vi.fn() }
}));
vi.mock('../../api/quodom_lines', () => ({
  quodomLines: { add: vi.fn() }
}));

const activoPorRubro = quodomApi.activoPorRubro as unknown as ReturnType<typeof vi.fn>;
const create = quodomApi.create as unknown as ReturnType<typeof vi.fn>;
const addLine = quodomLines.add as unknown as ReturnType<typeof vi.fn>;

const GASEOSA = { idproducto: 700, nombreProducto: 'Gaseosa 2L', cantidad: 1 };

describe('agregarProducto', () => {
  beforeEach(() => {
    clearGuestQuodoms();
    activoPorRubro.mockReset();
    create.mockReset();
    addLine.mockReset();
  });

  it('adds to the open quodom of that rubro without asking', async () => {
    activoPorRubro.mockResolvedValue({ id: 'q-7', idrubro: 7 });
    addLine.mockResolvedValue({ res: true, id: 1 });

    const res = await agregarProducto(GASEOSA, { logueado: true, idrubro: 7 });

    expect(res).toEqual({ estado: 'agregado', idquodom: 'q-7' });
    expect(activoPorRubro).toHaveBeenCalledWith(7);
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'q-7', idproducto: 700 }));
    expect(create).not.toHaveBeenCalled();
  });

  it('asks for confirmation and adds nothing when there is no quodom of that rubro', async () => {
    activoPorRubro.mockResolvedValue(null);

    const res = await agregarProducto(GASEOSA, { logueado: true, idrubro: 7 });

    expect(res).toEqual({ estado: 'necesita_confirmacion', idrubro: 7 });
    expect(create).not.toHaveBeenCalled();
    expect(addLine).not.toHaveBeenCalled();
  });

  it('creates with the right idrubro and then adds, on confirmation', async () => {
    create.mockResolvedValue({ res: true, idquodom: 'q-new' });
    addLine.mockResolvedValue({ res: true, id: 1 });

    const res = await confirmarYAgregar(GASEOSA, { logueado: true, idrubro: 7, descripcion: 'Bebidas' });

    expect(create).toHaveBeenCalledWith({ descripcion: 'Bebidas', idrubro: 7 });
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'q-new' }));
    expect(res.idquodom).toBe('q-new');
  });

  it('adds a guest line into the cart of that rubro, untouched backend', async () => {
    const res = await agregarProducto(GASEOSA, { logueado: false, idrubro: 7 });

    expect(res).toEqual({ estado: 'agregado', idquodom: null });
    expect(getGuestCart(7).lines).toEqual([GASEOSA]);
    expect(activoPorRubro).not.toHaveBeenCalled();
  });

  it('asks a guest for confirmation when the rubro has no cart yet but another does', async () => {
    await agregarProducto(GASEOSA, { logueado: false, idrubro: 7 });

    const res = await agregarProducto({ idproducto: 400, nombreProducto: 'Cemento', cantidad: 1 }, { logueado: false, idrubro: 4 });

    expect(res).toEqual({ estado: 'necesita_confirmacion', idrubro: 4 });
    expect(getGuestCart(4).lines).toEqual([]);
  });
});
