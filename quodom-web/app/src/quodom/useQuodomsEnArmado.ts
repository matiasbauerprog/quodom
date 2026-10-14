import { useCallback, useEffect, useRef, useState } from 'react';
import { quodom as quodomApi } from '../api/quodom';
import type { Quodom } from '../api/types';
import type { RamaRubro } from '../components/layout/ArbolQuodoms';
import { sanearAbiertos } from './quodomAbierto';
import { ramasDeQuodoms } from './ramas';
import { rubrosDisponibles } from './rubrosDisponibles';

/**
 * Los Quodoms en armado del usuario, ya agrupados por rubro para el árbol.
 * Lo usan el panel derecho y la barra inferior, así que las reglas de carga
 * viven una sola vez acá:
 *
 * - Quodoms y rubros se piden con `allSettled`, no `all`: son preguntas distintas.
 *   Si fallan los rubros el árbol sale sin filtrar (el backend ya rechaza un rubro
 *   retirado con 400) en vez de desaparecer.
 * - `sanearAbiertos` corre sólo tras una carga buena de Quodoms: con una lista
 *   vacía por error cerraría todo lo que el usuario tenía abierto.
 * - Un refresco fallido no pisa lo último bueno; sólo vacía si nunca hubo nada.
 *
 * `list` es `null` hasta la primera respuesta (distinto de "cargó y no hay nada").
 */
export function useQuodomsEnArmado(userId: string | undefined): {
  list: Quodom[] | null;
  ramas: RamaRubro[];
  refresh: () => void;
} {
  const [list, setList] = useState<Quodom[] | null>(null);
  // null = no se pudo saber qué rubros hay: se muestra todo sin filtrar.
  const [disponibles, setDisponibles] = useState<number[] | null>(null);
  const [nonce, setNonce] = useState(0);
  // Sólo se aplica la respuesta del pedido más reciente.
  const requestIdRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const cargar = () => {
      if (!userId) { setList([]); return; }
      const requestId = ++requestIdRef.current;
      Promise.allSettled([quodomApi.misQuodom(), rubrosDisponibles()])
        .then(([quodoms, rubros]) => {
          if (!alive || requestId !== requestIdRef.current) return;
          if (quodoms.status === 'rejected') throw quodoms.reason;
          const d = quodoms.value;
          setList(d);
          setDisponibles(rubros.status === 'fulfilled' ? rubros.value : null);
          sanearAbiertos(d.filter(q => q.estado === 'CREADO').map(q => q.id));
        })
        .catch(() => {
          if (!alive || requestId !== requestIdRef.current) return;
          setList(prev => (prev === null ? [] : prev));
        });
    };
    cargar();
    window.addEventListener('quodom:changed', cargar);
    window.addEventListener('storage', cargar);
    return () => {
      alive = false;
      window.removeEventListener('quodom:changed', cargar);
      window.removeEventListener('storage', cargar);
    };
  }, [userId, nonce]);

  const refresh = useCallback(() => setNonce(n => n + 1), []);

  const todos = list ?? [];
  const ramas = ramasDeQuodoms(todos, disponibles ?? todos.map(q => q.idrubro));
  return { list, ramas, refresh };
}
