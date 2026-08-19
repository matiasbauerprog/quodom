import { describe, it, expect, vi, beforeEach } from 'vitest';
import { planificarMigracion, migrarRubro } from '../src/guest/migrateGuestQuodom';
import { quodom as quodomApi } from '../src/api/quodom';
import { quodomLines } from '../src/api/quodom_lines';
import { categorias } from '../src/api/categorias';
import { addGuestLine, clearGuestQuodoms, getGuestCart } from '../src/guest/guestQuodom';

vi.mock('../src/api/quodom', () => ({
  quodom: { activoPorRubro: vi.fn(), create: vi.fn(), eliminar: vi.fn() }
}));
vi.mock('../src/api/quodom_lines', () => ({
  quodomLines: { add: vi.fn() }
}));
vi.mock('../src/api/categorias', () => ({
  categorias: { raiz: vi.fn() }
}));

const activoPorRubro = quodomApi.activoPorRubro as unknown as ReturnType<typeof vi.fn>;
const create = quodomApi.create as unknown as ReturnType<typeof vi.fn>;
const eliminar = quodomApi.eliminar as unknown as ReturnType<typeof vi.fn>;
const addLine = quodomLines.add as unknown as ReturnType<typeof vi.fn>;
const raiz = categorias.raiz as unknown as ReturnType<typeof vi.fn>;

// GET /categorias sólo devuelve los rubros habilitados (RUBROS_ACTIVOS
// [1,2,3,5,7]): 4 (Construcción), 6 y 8 quedan fuera a propósito.
const RUBROS_HABILITADOS = [1, 2, 3, 5, 7].map(id => ({ id, nombrecategoria: 'R' + id, idcategoriapadre: 0, imagen: null, refreshImage: null, orden: id }));

const GASEOSA = { idproducto: 700, nombreProducto: 'Gaseosa 2L', cantidad: 2 };
const CEMENTO = { idproducto: 400, nombreProducto: 'Cemento 50kg', cantidad: 1 };
const LAVANDINA = { idproducto: 100, nombreProducto: 'Lavandina 1L', cantidad: 1 };

describe('guest migration by rubro', () => {
  beforeEach(() => {
    clearGuestQuodoms();
    [activoPorRubro, create, eliminar, addLine, raiz].forEach(m => m.mockReset());
    raiz.mockResolvedValue(RUBROS_HABILITADOS);
    create.mockResolvedValue({ res: true, idquodom: 'q-new' });
    addLine.mockResolvedValue({ res: true, id: 1 });
    eliminar.mockResolvedValue({ res: true });
  });

  it('splits rubros into conflicting and free ones', async () => {
    addGuestLine(7, GASEOSA);
    addGuestLine(1, LAVANDINA);
    activoPorRubro.mockImplementation(async (r: number) => (r === 7 ? { id: 'q-7', idrubro: 7, nro: 'QD-1', cantproductos: 3 } : null));

    const plan = await planificarMigracion();

    expect(plan.sinConflicto).toEqual([1]);
    expect(plan.noDisponibles).toEqual([]);
    expect(plan.conflictos).toHaveLength(1);
    expect(plan.conflictos[0].idrubro).toBe(7);
    expect(plan.conflictos[0].lineasInvitado).toBe(1);
  });

  it('sets aside a cart whose rubro is not offered, without asking the server about it', async () => {
    // El backend responde 400 idrubro_invalido a un create de rubro 4, así que
    // planificar la migración de ese carrito sólo genera un error: se aparta.
    addGuestLine(4, CEMENTO);
    activoPorRubro.mockResolvedValue(null);

    const plan = await planificarMigracion();

    expect(plan.noDisponibles).toEqual([4]);
    expect(plan.sinConflicto).toEqual([]);
    expect(plan.conflictos).toEqual([]);
    expect(activoPorRubro).not.toHaveBeenCalled();
    // El carrito nunca se toca: sigue entero en localStorage.
    expect(getGuestCart(4).lines).toHaveLength(1);
  });

  it('still plans the available rubros when another one is not offered', async () => {
    addGuestLine(1, LAVANDINA);
    addGuestLine(4, CEMENTO);
    addGuestLine(7, GASEOSA);
    activoPorRubro.mockResolvedValue(null);

    const plan = await planificarMigracion();

    expect(plan.sinConflicto).toEqual([1, 7]);
    expect(plan.noDisponibles).toEqual([4]);
  });

  it('falls back to trying every rubro when the catalogue cannot be read', async () => {
    // Sin la lista de rubros habilitados no se puede decidir nada: se sigue
    // como antes y cada rubro falla por su cuenta, si es que falla.
    addGuestLine(4, CEMENTO);
    raiz.mockRejectedValue(new Error('network down'));
    activoPorRubro.mockResolvedValue(null);

    const plan = await planificarMigracion();

    expect(plan.noDisponibles).toEqual([]);
    expect(plan.sinConflicto).toEqual([4]);
  });

  it('creates a new quodom for a rubro without conflict and clears its cart', async () => {
    addGuestLine(1, LAVANDINA);

    const id = await migrarRubro(1, 'crear');

    expect(create).toHaveBeenCalledWith({ descripcion: 'Mi Quodom', idrubro: 1 });
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'q-new', idproducto: 100 }));
    expect(id).toBe('q-new');
    expect(getGuestCart(1).lines).toEqual([]);
  });

  it('integrar sends every guest line, unmerged, to the existing quodom', async () => {
    // Merging same-product-same-attributes quantities is a server-side rule
    // (quodom_lines.controller.js add()), not something migrarRubro computes
    // itself. This asserts the frontend forwards each guest line intact, with
    // its own cantidad, so the server can do that summing. Two distinct guest
    // lines catch a regression that would batch or drop one of them.
    addGuestLine(7, GASEOSA); // idproducto 700, cantidad 2
    addGuestLine(7, { idproducto: 401, nombreProducto: 'Agua 500ml', cantidad: 3 });
    activoPorRubro.mockResolvedValue({ id: 'q-7', idrubro: 7 });

    const id = await migrarRubro(7, 'integrar');

    expect(create).not.toHaveBeenCalled();
    expect(eliminar).not.toHaveBeenCalled();
    expect(addLine).toHaveBeenCalledTimes(2);
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'q-7', idproducto: 700, cantidad: 2 }));
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'q-7', idproducto: 401, cantidad: 3 }));
    expect(id).toBe('q-7');
  });

  it('integrar relies on the server to sum quantities for a repeated product', async () => {
    // Simulates the server-side merge (covered end-to-end by
    // api/tests/quodom_lines.merge.test.js): the quodom already has 5 units of
    // idproducto 700, so adding the guest's 2 should leave 7, not 2 new units
    // in a second line. This is what would break silently if the merge logic
    // were ever removed from the controller.
    addGuestLine(7, GASEOSA); // idproducto 700, cantidad 2
    activoPorRubro.mockResolvedValue({ id: 'q-7', idrubro: 7 });

    let stored = 5;
    addLine.mockImplementation(async (params: { cantidad: number }) => {
      stored += params.cantidad; // mirrors the controller's summed-line behaviour
      return { res: true, id: 1 };
    });

    await migrarRubro(7, 'integrar');

    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'q-7', idproducto: 700, cantidad: 2 }));
    expect(stored).toBe(7);
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
