import { useCallback, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import type { GuestLine } from '../guest/guestQuodom';
import { agregarProducto } from './agregarProducto';

/**
 * Shared "+" handler for the catalog screens: routes the line to the guest
 * Quodom or to the server one depending on the session, and surfaces the error
 * instead of failing silently.
 */
export function useAgregarProducto() {
  const { user } = useAuth();
  const [agregando, setAgregando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agregar = useCallback(async (line: GuestLine) => {
    setAgregando(true);
    setError(null);
    try {
      await agregarProducto(line, { logueado: !!user });
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo agregar el producto.');
    } finally {
      setAgregando(false);
    }
  }, [user]);

  return { agregar, agregando, error };
}
