import { useCallback, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import type { GuestLine } from '../guest/guestQuodom';
import { agregarProducto, confirmarYAgregar } from './agregarProducto';

type Pendiente = { line: GuestLine; idrubro: number };

/**
 * Shared "+" handler for the catalog screens: routes the line to the guest
 * Quodom or to the server one depending on the session and rubro. When the
 * rubro has no open Quodom, nothing is added and the line is exposed as
 * `pendiente` so the caller can show a confirmation dialog before creating one.
 */
export function useAgregarProducto() {
  const { user } = useAuth();
  const [agregando, setAgregando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);

  const agregar = useCallback(async (line: GuestLine, idrubro: number) => {
    setAgregando(true);
    setError(null);
    try {
      const res = await agregarProducto(line, { logueado: !!user, idrubro });
      if (res.estado === 'necesita_confirmacion') setPendiente({ line, idrubro });
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo agregar el producto.');
    } finally {
      setAgregando(false);
    }
  }, [user]);

  const confirmar = useCallback(async () => {
    if (!pendiente || agregando) return;
    setAgregando(true);
    setError(null);
    try {
      await confirmarYAgregar(pendiente.line, {
        logueado: !!user,
        idrubro: pendiente.idrubro,
        descripcion: 'Mi Quodom'
      });
      setPendiente(null);
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo crear el Quodom.');
    } finally {
      setAgregando(false);
    }
  }, [pendiente, user, agregando]);

  const cancelar = useCallback(() => setPendiente(null), []);

  return { agregar, agregando, error, pendiente, confirmar, cancelar };
}
