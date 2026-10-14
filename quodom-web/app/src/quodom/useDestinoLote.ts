import { useCallback, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import type { Quodom } from '../api/types';
import { quodom as quodomApi } from '../api/quodom';
import { abrirQuodom } from './quodomAbierto';
import { conAbierto } from './agregarProducto';

type Lote<T> = { idrubro: number; items: T[]; candidatos: Quodom[] };

type Opts<T> = {
  /** Agrega UN ítem al Quodom indicado. Puede lanzar: el hook muestra el error. */
  agregarItem: (idquodom: string, item: T) => Promise<void>;
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
 * Retoma, no reinicia: cada ítem sale del lote apenas se agrega. Si el abierto
 * resulta no existir a mitad de camino, el diálogo sólo recibe lo que falta;
 * si no, lo que ya llegó entraría dos veces (o quedaría repartido en dos
 * Quodoms). Igual que la cola de useAgregarProducto.
 *
 * Un rubro admite varios Quodoms en armado, así que nunca hay conflicto que
 * resolver: sumar a uno existente o crear uno nuevo son siempre salidas válidas.
 */
export function useDestinoLote<T>({ agregarItem, descripcion }: Opts<T>) {
  const [destino, setDestino] = useState<Lote<T> | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Quodom ya creado cuya carga quedó a medias: el reintento lo reutiliza en
  // vez de crear otro.
  const creado = useRef<string | null>(null);
  // Lo que falta de un lote cuyo volcado se cortó por un error que no es de la API.
  const resto = useRef<{ clave: string; pendientes: T[] } | null>(null);

  // Vuelca de a uno y va sacando del lote (mutándolo) lo que ya llegó.
  const volcar = useCallback(async (idquodom: string, pendientes: T[]) => {
    let alguno = false;
    try {
      while (pendientes.length > 0) {
        await agregarItem(idquodom, pendientes[0]);
        pendientes.shift();
        alguno = true;
      }
    } finally {
      if (alguno) window.dispatchEvent(new Event('quodom:changed'));
    }
  }, [agregarItem]);

  /** Devuelve el id del Quodom que recibió el lote, o null si queda esperando destino. */
  const resolver = useCallback(async (idrubro: number, items: T[]): Promise<string | null> => {
    // Un reintento del mismo lote (tras un error de red que cortó el volcado)
    // retoma lo que faltaba: el backend suma cantidades, así que reenviar lo que
    // ya llegó lo duplicaría.
    const clave = idrubro + ':' + JSON.stringify(items);
    const pendientes = resto.current?.clave === clave ? resto.current.pendientes : [...items];
    let abierto: string | null;
    try {
      abierto = await conAbierto(idrubro, id => volcar(id, pendientes));
    } catch (e) {
      resto.current = { clave, pendientes };
      throw e;
    }
    resto.current = null;
    if (abierto) return abierto;
    const candidatos = await quodomApi.activosPorRubro(idrubro);
    setError(null);
    setDestino({ idrubro, items: pendientes, candidatos });
    return null;
  }, [volcar]);

  const correr = useCallback(async (accion: (d: Lote<T>) => Promise<string>, fallo: string): Promise<string | null> => {
    if (!destino || ocupado) return null;
    setOcupado(true);
    setError(null);
    // `accion` consume `d.items` en el lugar: una copia de trabajo, y si falla
    // el diálogo queda con lo que todavía falta.
    const trabajo: Lote<T> = { ...destino, items: [...destino.items] };
    try {
      const id = await accion(trabajo);
      creado.current = null;
      abrirQuodom(destino.idrubro, id);
      setDestino(null);
      return id;
    } catch (e) {
      setDestino({ ...destino, items: trabajo.items });
      setError(e instanceof ApiError || e instanceof Error ? e.message : fallo);
      return null;
    } finally {
      setOcupado(false);
    }
  }, [destino, ocupado]);

  const elegir = useCallback(
    (idquodom: string) => correr(async d => { await volcar(idquodom, d.items); return idquodom; }, 'No se pudo agregar al Quodom.'),
    [correr, volcar]
  );

  const crear = useCallback(
    () => correr(async d => {
      if (!creado.current) {
        const nuevo = await quodomApi.create({ descripcion: descripcion(), idrubro: d.idrubro });
        creado.current = nuevo.idquodom;
      }
      await volcar(creado.current, d.items);
      return creado.current;
    }, 'No se pudo crear el Quodom.'),
    [correr, volcar, descripcion]
  );

  const cancelar = useCallback(() => { creado.current = null; setError(null); setDestino(null); }, []);

  return { resolver, destino, elegir, crear, cancelar, ocupado, error };
}
