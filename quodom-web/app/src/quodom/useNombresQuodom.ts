import { useEffect, useState } from 'react';
import { quodom as quodomApi } from '../api/quodom';

/**
 * Nombre de cada Quodom del usuario, por id: lo que el cartel del "+" necesita
 * para decir adónde va. Es una consulta propia y no una tercera copia de
 * `useQuodomsEnArmado` (ver la nota del Drawer en CLAUDE.md). Se recarga con
 * `quodom:changed`, que es lo que dispara crear o renombrar uno. Sin sesión, o
 * si falla, queda vacío y el cartel dice algo más genérico.
 */
export function useNombresQuodom(userId: string | undefined): Record<string, string> {
  const [nombres, setNombres] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!userId) { setNombres({}); return; }
    let vivo = true;
    const cargar = () => {
      quodomApi.misQuodom()
        .then(lista => {
          if (vivo) setNombres(Object.fromEntries(lista.map(q => [q.id, q.descripcion || q.nro])));
        })
        .catch(() => {});
    };
    cargar();
    window.addEventListener('quodom:changed', cargar);
    return () => { vivo = false; window.removeEventListener('quodom:changed', cargar); };
  }, [userId]);

  return nombres;
}
