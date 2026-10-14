import { useCallback, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import type { Quodom } from '../api/types';
import { quodom as quodomApi } from '../api/quodom';
import { abrirQuodom } from './quodomAbierto';
import { conAbierto } from './agregarProducto';

type Lote<T> = { idrubro: number; items: T; candidatos: Quodom[] };

type Opts<T> = {
  /** Vuelca el lote en el Quodom indicado. Puede lanzar: el hook muestra el error. */
  agregar: (idquodom: string, items: T) => Promise<void>;
  /** Nombre del Quodom cuando el usuario pide uno nuevo. */
  descripcion: () => string;
};

/**
 * "Adónde va este lote" para quien agrega VARIOS productos de una vez (la
 * propuesta del asistente, una lista subida). Es la misma regla que el "+" de
 * una tarjeta, aplicada al lote entero: el Quodom abierto del rubro lo recibe
 * sin preguntar; si no hay ninguno abierto se expone `destino` para mostrar
 * DialogoDestino, y lo que el usuario elija queda como el abierto del rubro.
 *
 * Un rubro admite varios Quodoms en armado, así que nunca hay conflicto que
 * resolver: sumar a uno existente o crear uno nuevo son siempre salidas válidas.
 */
export function useDestinoLote<T>({ agregar, descripcion }: Opts<T>) {
  const [destino, setDestino] = useState<Lote<T> | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Quodom ya creado cuya carga quedó a medias: el reintento lo reutiliza en
  // vez de crear otro.
  const creado = useRef<string | null>(null);

  /** Devuelve el id del Quodom que recibió el lote, o null si queda esperando destino. */
  const resolver = useCallback(async (idrubro: number, items: T): Promise<string | null> => {
    const abierto = await conAbierto(idrubro, id => agregar(id, items));
    if (abierto) return abierto;
    const candidatos = await quodomApi.activosPorRubro(idrubro);
    setError(null);
    setDestino({ idrubro, items, candidatos });
    return null;
  }, [agregar]);

  const correr = useCallback(async (accion: (d: Lote<T>) => Promise<string>, fallo: string): Promise<string | null> => {
    if (!destino || ocupado) return null;
    setOcupado(true);
    setError(null);
    try {
      const id = await accion(destino);
      creado.current = null;
      abrirQuodom(destino.idrubro, id);
      setDestino(null);
      return id;
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : fallo);
      return null;
    } finally {
      setOcupado(false);
    }
  }, [destino, ocupado]);

  const elegir = useCallback(
    (idquodom: string) => correr(async d => { await agregar(idquodom, d.items); return idquodom; }, 'No se pudo agregar al Quodom.'),
    [correr, agregar]
  );

  const crear = useCallback(
    () => correr(async d => {
      if (!creado.current) {
        const nuevo = await quodomApi.create({ descripcion: descripcion(), idrubro: d.idrubro });
        creado.current = nuevo.idquodom;
      }
      await agregar(creado.current, d.items);
      return creado.current;
    }, 'No se pudo crear el Quodom.'),
    [correr, agregar, descripcion]
  );

  const cancelar = useCallback(() => { creado.current = null; setError(null); setDestino(null); }, []);

  return { resolver, destino, elegir, crear, cancelar, ocupado, error };
}
