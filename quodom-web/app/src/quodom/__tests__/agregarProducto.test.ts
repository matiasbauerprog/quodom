import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agregarProducto } from '../agregarProducto';
import { quodom as quodomApi } from '../../api/quodom';
import { quodomLines } from '../../api/quodom_lines';
import { getGuestQuodom, clearGuestQuodom } from '../../guest/guestQuodom';

vi.mock('../../api/quodom', () => ({
  quodom: { getLastOrCreate: vi.fn() }
}));
vi.mock('../../api/quodom_lines', () => ({
  quodomLines: { add: vi.fn() }
}));

const getLastOrCreate = quodomApi.getLastOrCreate as unknown as ReturnType<typeof vi.fn>;
const addLine = quodomLines.add as unknown as ReturnType<typeof vi.fn>;

const LINE = {
  idproducto: 7,
  nombreProducto: 'Latex Interior',
  cantidad: 1,
  nombreAtributo1: 'Color'
};

describe('agregarProducto', () => {
  beforeEach(() => {
    clearGuestQuodom();
    getLastOrCreate.mockReset();
    addLine.mockReset();
  });

  describe('sin sesión (invitado)', () => {
    it('guarda la línea en el Quodom de invitado y no toca el backend', async () => {
      await agregarProducto(LINE, { logueado: false });

      expect(getGuestQuodom().lines).toEqual([LINE]);
      expect(getLastOrCreate).not.toHaveBeenCalled();
      expect(addLine).not.toHaveBeenCalled();
    });
  });

  describe('con sesión iniciada', () => {
    it('agrega la línea al Quodom activo del servidor, no al localStorage', async () => {
      getLastOrCreate.mockResolvedValue({ id: 'q-1', estado: 'CREADO' });
      addLine.mockResolvedValue({ res: true, id: 55 });

      await agregarProducto(LINE, { logueado: true });

      expect(getLastOrCreate).toHaveBeenCalledTimes(1);
      expect(addLine).toHaveBeenCalledWith({
        idquodom: 'q-1',
        idproducto: 7,
        cantidad: 1,
        nombreProducto: 'Latex Interior'
      });
      expect(getGuestQuodom().lines).toEqual([]);
    });

    it('devuelve el id del Quodom activo para poder navegar hacia él', async () => {
      getLastOrCreate.mockResolvedValue({ id: 'q-9', estado: 'CREADO' });
      addLine.mockResolvedValue({ res: true, id: 1 });

      const res = await agregarProducto(LINE, { logueado: true });

      expect(res.idquodom).toBe('q-9');
    });

    it('propaga el error del backend sin escribir en el Quodom de invitado', async () => {
      getLastOrCreate.mockRejectedValue(new Error('backend caído'));

      await expect(agregarProducto(LINE, { logueado: true })).rejects.toThrow('backend caído');
      expect(getGuestQuodom().lines).toEqual([]);
    });

    it('reutiliza el mismo Quodom activo en agregados sucesivos', async () => {
      getLastOrCreate.mockResolvedValue({ id: 'q-1', estado: 'CREADO' });
      addLine.mockResolvedValue({ res: true, id: 1 });

      await agregarProducto(LINE, { logueado: true });
      await agregarProducto({ ...LINE, idproducto: 8 }, { logueado: true });

      expect(addLine).toHaveBeenNthCalledWith(1, expect.objectContaining({ idquodom: 'q-1', idproducto: 7 }));
      expect(addLine).toHaveBeenNthCalledWith(2, expect.objectContaining({ idquodom: 'q-1', idproducto: 8 }));
    });
  });
});
