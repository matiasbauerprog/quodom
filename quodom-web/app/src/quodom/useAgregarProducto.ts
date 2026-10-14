import { useCallback, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import type { Quodom } from '../api/types';
import type { GuestLine } from '../guest/guestQuodom';
import { agregarProducto, agregarADestino, crearYAgregar } from './agregarProducto';

type Pendiente = { line: GuestLine; idrubro: number; candidatos: Quodom[] };
type Destino = { items: Pendiente[]; idrubro: number; candidatos: Quodom[] };

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
  // Quodom ya creado por rubro cuya carga quedó a medias: el reintento lo reutiliza.
  const creados = useRef<Record<number, string>>({});

  const destino: Destino | null = useMemo(() => {
    if (cola.length === 0) return null;
    const { idrubro, candidatos } = cola[0];
    return { idrubro, candidatos, items: cola.filter(p => p.idrubro === idrubro) };
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
      delete creados.current[destino.idrubro];
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : fallo);
    } finally {
      setAgregando(false);
    }
  }, [destino, agregando]);

  // Cada línea sale de la cola apenas se agrega: si una falla, el reintento
  // retoma desde ahí y no repite las que ya llegaron. Se quitan esas entradas
  // exactas, no "todo lo del rubro", para no perder las que se encolen mientras.
  const sacar = (item: Pendiente) => setCola(c => c.filter(p => p !== item));

  const agregarItems = useCallback(async (items: Pendiente[], idrubro: number, idquodom: string) => {
    for (const item of items) {
      await agregarADestino(item.line, idrubro, idquodom);
      sacar(item);
    }
  }, []);

  const elegir = useCallback(
    (idquodom: string) => resolver(d => agregarItems(d.items, d.idrubro, idquodom), 'No se pudo agregar el producto.'),
    [resolver, agregarItems]
  );

  const crear = useCallback(
    () => resolver(async d => {
      let id = creados.current[d.idrubro];
      let resto = d.items;
      if (!id) {
        const [primera, ...otras] = d.items;
        id = await crearYAgregar(primera.line, d.idrubro, 'Mi Quodom');
        creados.current[d.idrubro] = id;
        sacar(primera);
        resto = otras;
      }
      await agregarItems(resto, d.idrubro, id);
    }, 'No se pudo crear el Quodom.'),
    [resolver, agregarItems]
  );

  const cancelar = useCallback(() => { creados.current = {}; setCola([]); }, []);

  return { agregar, agregando, error, destino, elegir, crear, cancelar };
}
