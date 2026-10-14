import { describe, it, expect, vi, beforeEach } from 'vitest';
import { planificarMigracion, migrarRubro } from '../src/guest/migrateGuestQuodom';
import { quodom as quodomApi } from '../src/api/quodom';
import { quodomLines } from '../src/api/quodom_lines';
import { categorias } from '../src/api/categorias';
import { addGuestLine, clearGuestQuodoms, getGuestCart } from '../src/guest/guestQuodom';
import { abiertoDe } from '../src/quodom/quodomAbierto';

vi.mock('../src/api/quodom', () => ({
  quodom: { activosPorRubro: vi.fn(), create: vi.fn(), eliminar: vi.fn() }
}));
vi.mock('../src/api/quodom_lines', () => ({
  quodomLines: { add: vi.fn() }
}));
vi.mock('../src/api/categorias', () => ({
  categorias: { raiz: vi.fn() }
}));

const activosPorRubro = quodomApi.activosPorRubro as unknown as ReturnType<typeof vi.fn>;
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
    localStorage.clear();
    [activosPorRubro, create, eliminar, addLine, raiz].forEach(m => m.mockReset());
    raiz.mockResolvedValue(RUBROS_HABILITADOS);
    create.mockResolvedValue({ res: true, idquodom: 'q-new' });
    addLine.mockResolvedValue({ res: true, id: 1 });
    eliminar.mockResolvedValue({ res: true });
  });

  it('plans every offered rubro to be migrated, without asking the server about open Quodoms', async () => {
    // Ya no hay conflicto posible: un rubro puede tener varios Quodoms abiertos,
    // así que el carrito siempre migra a uno nuevo y no hay nada que consultar.
    addGuestLine(7, GASEOSA);
    addGuestLine(1, LAVANDINA);

    const plan = await planificarMigracion();

    expect(plan.aMigrar).toEqual([1, 7]);
    expect(plan.noDisponibles).toEqual([]);
    expect(activosPorRubro).not.toHaveBeenCalled();
  });

  it('sets aside a cart whose rubro is not offered', async () => {
    // El backend responde 400 idrubro_invalido a un create de rubro 4, así que
    // planificar la migración de ese carrito sólo genera un error: se aparta.
    addGuestLine(4, CEMENTO);

    const plan = await planificarMigracion();

    expect(plan.noDisponibles).toEqual([4]);
    expect(plan.aMigrar).toEqual([]);
    // El carrito nunca se toca: sigue entero en localStorage.
    expect(getGuestCart(4).lines).toHaveLength(1);
  });

  it('still plans the available rubros when another one is not offered', async () => {
    addGuestLine(1, LAVANDINA);
    addGuestLine(4, CEMENTO);
    addGuestLine(7, GASEOSA);

    const plan = await planificarMigracion();

    expect(plan.aMigrar).toEqual([1, 7]);
    expect(plan.noDisponibles).toEqual([4]);
  });

  it('falls back to trying every rubro when the catalogue cannot be read', async () => {
    // Sin la lista de rubros habilitados no se puede decidir nada: se sigue
    // como antes y cada rubro falla por su cuenta, si es que falla.
    addGuestLine(4, CEMENTO);
    raiz.mockRejectedValue(new Error('network down'));

    const plan = await planificarMigracion();

    expect(plan.noDisponibles).toEqual([]);
    expect(plan.aMigrar).toEqual([4]);
  });

  it('creates a new quodom and clears the cart once every line is on the server', async () => {
    addGuestLine(1, LAVANDINA);

    const id = await migrarRubro(1);

    expect(create).toHaveBeenCalledWith({ descripcion: 'Mi Quodom', idrubro: 1 });
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'q-new', idproducto: 100 }));
    expect(id).toBe('q-new');
    expect(getGuestCart(1).lines).toEqual([]);
  });

  it('migra el carrito a un Quodom nuevo aunque el rubro ya tenga uno abierto', async () => {
    addGuestLine(7, GASEOSA);
    create.mockResolvedValue({ res: true, idquodom: 'q-nuevo' });

    const id = await migrarRubro(7);

    expect(id).toBe('q-nuevo');
    expect(activosPorRubro).not.toHaveBeenCalled();
    expect(eliminar).not.toHaveBeenCalled();
    expect(getGuestCart(7).lines).toHaveLength(0);
  });

  it('deja el Quodom recién migrado como el abierto del rubro', async () => {
    // Si no, el próximo "+" de ese rubro preguntaría a cuál sumar y ofrecería
    // el Quodom que se acaba de crear con el carrito del propio usuario.
    addGuestLine(7, GASEOSA);

    await migrarRubro(7);

    expect(abiertoDe(7)).toBe('q-new');
  });

  it('no deja nada abierto si la migración falla', async () => {
    addGuestLine(7, GASEOSA);
    addLine.mockRejectedValue(new Error('network down'));

    await expect(migrarRubro(7)).rejects.toThrow();

    expect(abiertoDe(7)).toBeNull();
  });

  it('sends every guest line, unmerged, to the new quodom', async () => {
    addGuestLine(7, GASEOSA); // idproducto 700, cantidad 2
    addGuestLine(7, { idproducto: 401, nombreProducto: 'Agua 500ml', cantidad: 3 });

    await migrarRubro(7);

    expect(addLine).toHaveBeenCalledTimes(2);
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'q-new', idproducto: 700, cantidad: 2 }));
    expect(addLine).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'q-new', idproducto: 401, cantidad: 3 }));
  });

  it('keeps the cart when a line fails, and does not leave a half-filled quodom behind', async () => {
    addGuestLine(7, GASEOSA);
    addGuestLine(7, { idproducto: 401, nombreProducto: 'Agua 500ml', cantidad: 3 });
    addLine.mockResolvedValueOnce({ res: true, id: 1 }).mockRejectedValueOnce(new Error('network down'));

    await expect(migrarRubro(7)).rejects.toThrow('network down');

    // El carrito sigue entero para reintentar; el Quodom a medias se descarta
    // para que el reintento no deje un duplicado.
    expect(getGuestCart(7).lines).toHaveLength(2);
    expect(eliminar).toHaveBeenCalledWith('q-new');
  });

  it('still reports the original failure when discarding the half-filled quodom fails too', async () => {
    addGuestLine(7, GASEOSA);
    addLine.mockRejectedValue(new Error('network down'));
    eliminar.mockRejectedValue(new Error('also down'));

    await expect(migrarRubro(7)).rejects.toThrow('network down');
    expect(getGuestCart(7).lines).toHaveLength(1);
  });

  it('returns null and creates nothing for an empty cart', async () => {
    expect(await migrarRubro(7)).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});
