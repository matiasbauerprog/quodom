import { beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateGuestQuodom } from '../src/guest/migrateGuestQuodom';
import { addGuestLine, setGuestDescripcion, getGuestQuodom } from '../src/guest/guestQuodom';

const created: any[] = [];
const linesAdded: any[] = [];
vi.mock('../src/api/quodom', () => ({
  quodom: {
    create: vi.fn(async (body: any) => { created.push(body); return { res: true, idquodom: 'new-uuid' }; })
  }
}));
vi.mock('../src/api/quodom_lines', () => ({
  quodomLines: {
    add: vi.fn(async (body: any) => { linesAdded.push(body); return { res: true, id: linesAdded.length }; })
  }
}));

describe('migrateGuestQuodom', () => {
  beforeEach(() => {
    localStorage.clear();
    created.length = 0;
    linesAdded.length = 0;
  });

  it('does nothing when the guest quodom is empty', async () => {
    const id = await migrateGuestQuodom();
    expect(id).toBeNull();
    expect(created).toHaveLength(0);
    expect(linesAdded).toHaveLength(0);
  });

  it('creates a quodom and adds all lines then clears the guest', async () => {
    setGuestDescripcion('Pintura living');
    addGuestLine({ idproducto: 100, nombreProducto: 'Latex 20L', cantidad: 2, atributo1: 'Blanco' });
    addGuestLine({ idproducto: 101, nombreProducto: 'Rodillo', cantidad: 1 });
    const id = await migrateGuestQuodom();
    expect(id).toBe('new-uuid');
    expect(created[0]).toEqual({ descripcion: 'Pintura living' });
    expect(linesAdded).toHaveLength(2);
    expect(linesAdded[0]).toMatchObject({ idquodom: 'new-uuid', idproducto: 100, cantidad: 2, atributo1: 'Blanco' });
    expect(linesAdded[1]).toMatchObject({ idquodom: 'new-uuid', idproducto: 101, cantidad: 1 });
    expect(getGuestQuodom().lines).toEqual([]);
  });

  it('defaults descripcion to "Mi Quodom" when empty', async () => {
    addGuestLine({ idproducto: 100, nombreProducto: 'Latex', cantidad: 1 });
    await migrateGuestQuodom();
    expect(created[0].descripcion).toBe('Mi Quodom');
  });
});
