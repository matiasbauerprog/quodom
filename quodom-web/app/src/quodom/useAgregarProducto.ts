import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import type { Quodom } from '../api/types';
import type { GuestLine } from '../guest/guestQuodom';
import { agregarProducto, agregarADestino, crearYAgregar } from './agregarProducto';

type Pendiente = { line: GuestLine; idrubro: number; candidatos: Quodom[] };
type Destino = { lines: GuestLine[]; idrubro: number; candidatos: Quodom[] };

/**
 * Shared "+" handler for the catalog screens: routes the line to the guest
 * Quodom or to the open Quodom of its rubro. Only when the rubro has no open
 * one is nothing added and the lines exposed as `destino`, so the caller can
 * show DialogoDestino; `elegir` / `crear` resolve it and make the choice the
 * open Quodom, which is what keeps the question from coming back.
 *
 * Varios "+" seguidos sin destino abierto se ENCOLAN (no se pisan ni se
 * ignoran): el destino elegido recibe todas las líneas de ese rubro, y
 * cancelar descarta la cola entera.
 */
export function useAgregarProducto() {
  const { user } = useAuth();
  const [agregando, setAgregando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cola, setCola] = useState<Pendiente[]>([]);

  const destino: Destino | null = useMemo(() => {
    if (cola.length === 0) return null;
    const { idrubro, candidatos } = cola[0];
    return { idrubro, candidatos, lines: cola.filter(p => p.idrubro === idrubro).map(p => p.line) };
  }, [cola]);

  const agregar = useCallback(async (line: GuestLine, idrubro: number) => {
    setAgregando(true);
    setError(null);
    try {
      const res = await agregarProducto(line, { logueado: !!user, idrubro });
      if (res.estado === 'elegir_destino') {
        setCola(c => [...c, { line, idrubro, candidatos: res.candidatos }]);
      }
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
      setCola(c => c.filter(p => p.idrubro !== destino.idrubro));
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : fallo);
    } finally {
      setAgregando(false);
    }
  }, [destino, agregando]);

  const elegir = useCallback(
    (idquodom: string) => resolver(async d => {
      for (const line of d.lines) await agregarADestino(line, d.idrubro, idquodom);
    }, 'No se pudo agregar el producto.'),
    [resolver]
  );

  const crear = useCallback(
    () => resolver(async d => {
      const [primera, ...resto] = d.lines;
      const id = await crearYAgregar(primera, d.idrubro, 'Mi Quodom');
      for (const line of resto) await agregarADestino(line, d.idrubro, id);
    }, 'No se pudo crear el Quodom.'),
    [resolver]
  );

  const cancelar = useCallback(() => setCola([]), []);

  return { agregar, agregando, error, destino, elegir, crear, cancelar };
}
