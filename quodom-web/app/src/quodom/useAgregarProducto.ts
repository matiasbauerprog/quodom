import { useCallback, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import type { Quodom } from '../api/types';
import type { GuestLine } from '../guest/guestQuodom';
import { agregarProducto, agregarADestino, crearYAgregar } from './agregarProducto';

type Destino = { line: GuestLine; idrubro: number; candidatos: Quodom[] };

/**
 * Shared "+" handler for the catalog screens: routes the line to the guest
 * Quodom or to the open Quodom of its rubro. Only when the rubro has no open
 * one is nothing added and the line exposed as `destino`, so the caller can
 * show DialogoDestino; `elegir` / `crear` resolve it and make the choice the
 * open Quodom, which is what keeps the question from coming back.
 */
export function useAgregarProducto() {
  const { user } = useAuth();
  const [agregando, setAgregando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destino, setDestino] = useState<Destino | null>(null);

  const agregar = useCallback(async (line: GuestLine, idrubro: number) => {
    setAgregando(true);
    setError(null);
    try {
      const res = await agregarProducto(line, { logueado: !!user, idrubro });
      if (res.estado === 'elegir_destino') setDestino({ line, idrubro, candidatos: res.candidatos });
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo agregar el producto.');
    } finally {
      setAgregando(false);
    }
  }, [user]);

  const resolver = useCallback(async (accion: (d: Destino) => Promise<unknown>, fallo: string) => {
    if (!destino || agregando) return;
    setAgregando(true);
    setError(null);
    try {
      await accion(destino);
      setDestino(null);
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : fallo);
    } finally {
      setAgregando(false);
    }
  }, [destino, agregando]);

  const elegir = useCallback(
    (idquodom: string) => resolver(d => agregarADestino(d.line, d.idrubro, idquodom), 'No se pudo agregar el producto.'),
    [resolver]
  );

  const crear = useCallback(
    () => resolver(d => crearYAgregar(d.line, d.idrubro, 'Mi Quodom'), 'No se pudo crear el Quodom.'),
    [resolver]
  );

  const cancelar = useCallback(() => setDestino(null), []);

  return { agregar, agregando, error, destino, elegir, crear, cancelar };
}
