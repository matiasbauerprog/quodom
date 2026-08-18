import { describe, it, expect, vi, beforeEach } from 'vitest';
import { planificarMigracion, migrarRubro } from '../src/guest/migrateGuestQuodom';
import { quodom as quodomApi } from '../src/api/quodom';
import { quodomLines } from '../src/api/quodom_lines';
import { addGuestLine, clearGuestQuodoms, getGuestCart } from '../src/guest/guestQuodom';

vi.mock('../src/api/quodom', () => ({
  quodom: { activoPorRubro: vi.fn(), create: vi.fn(), eliminar: vi.fn() }
}));
vi.mock('../src/api/quodom_lines', () => ({
  quodomLines: { add: vi.fn() }
}));

const activoPorRubro = quodomApi.activoPorRubro as unknown as ReturnType<typeof vi.fn>;
const create = quodomApi.create as unknown as ReturnType<typeof vi.fn>;
const eliminar = quodomApi.eliminar as unknown as ReturnType<typeof vi.fn>;
const addLine = quodomLines.add as unknown as ReturnType<typeof vi.fn>;

const GASEOSA = { idproducto: 700, nombreProducto: 'Gaseosa 2L', cantidad: 2 };
const CEMENTO = { idproducto: 400, nombreProducto: 'Cemento 50kg', cantidad: 1 };

describe('guest migration by rubro', () => {
  beforeEach(() => {
    clearGuestQuodoms();
    [activoPorRubro, create, eliminar, addLine].forEach(m => m.mockReset());
    create.mockResolvedValue({ res: true, idquodom: 'q-new' });
    addLine.mockResolvedValue({ res: true, id: 1 });
    eliminar.mockResolvedValue({ res: true });
  });

  it('splits rubros into conflicting and free ones', async () => {
    addGuestLine(7, GASEOSA);
    addGuestLine(4, CEMENTO);
    activoPorRubro.mockImplementation(async (r: number) => (r === 7 ? { id: 'q-7', idrubro: 7, nro: 'QD-1', cantproductos: 3 } : null));

    const plan = await planificarMigracion();

    expect(plan.sinConflicto).toEqual([4]);
    expect(plan.conflictos).toHaveLength(1);
    expect(plan.conflictos[0].idrubro).toBe(7);
    expect(plan.conflictos[0].lineasInvitado).toBe(1);
  });

  it('creates a new quodom for a rubro without conflict and clears its cart', async () => {
    addGuestLine(4, CEMENTO);

    const id = await migrarRubro(4, 'crear');

    expect(create).toHaveBeenCalledWith({ descripcion: 'Mi Quodom', idrubro: 4 });
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'q-new', idproducto: 400 }));
    expect(id).toBe('q-new');
    expect(getGuestCart(4).lines).toEqual([]);
  });

  it('integrar adds the guest lines into the existing quodom', async () => {
    addGuestLine(7, GASEOSA);
    activoPorRubro.mockResolvedValue({ id: 'q-7', idrubro: 7 });

    const id = await migrarRubro(7, 'integrar');

    expect(create).not.toHaveBeenCalled();
    expect(eliminar).not.toHaveBeenCalled();
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'q-7', cantidad: 2 }));
    expect(id).toBe('q-7');
  });

  it('reemplazar deletes the whole existing quodom and creates a new one', async () => {
    addGuestLine(7, GASEOSA);
    activoPorRubro.mockResolvedValue({ id: 'q-7', idrubro: 7 });

    const id = await migrarRubro(7, 'reemplazar');

    expect(eliminar).toHaveBeenCalledWith('q-7');
    expect(create).toHaveBeenCalledWith({ descripcion: 'Mi Quodom', idrubro: 7 });
    expect(id).toBe('q-new');
  });

  it('leaves the cart untouched when a rubro is never migrated', async () => {
    addGuestLine(7, GASEOSA);
    expect(getGuestCart(7).lines).toHaveLength(1);
  });
});
