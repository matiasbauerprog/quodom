import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { quodom as quodomApi } from '../../api/quodom';
import { getGuestCart, guestRubrosConLineas } from '../../guest/guestQuodom';
import { nombreRubro } from '../../quodom/rubros';
import { PanelQuodomsActivos, quodomsAItems, type ItemActivo } from './PanelQuodomsActivos';
import './BarraQuodomInferior.css';

export function BarraQuodomInferior() {
  const { user } = useAuth();
  // `null` means "no data loaded yet" (distinct from an empty list, which
  // means "loaded, and there is nothing open"). Mirrors MisQuodomsSidebar
  // (Task 11) so a transient refresh failure can tell those two apart.
  const [items, setItems] = useState<ItemActivo[] | null>(null);
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    // Guards against `quodom:changed` firing repeatedly in quick succession:
    // only the response for the most recently started request is applied, so
    // an earlier request resolving after a later one can't overwrite it with
    // stale data. Matches MisQuodomsSidebar's approach (Task 11).
    let requestId = 0;
    const cargar = () => {
      if (!user) {
        setItems(guestRubrosConLineas().map(idrubro => {
          const cart = getGuestCart(idrubro);
          return {
            key: 'g-' + idrubro,
            to: '/quodom?rubro=' + idrubro,
            nombreRubro: nombreRubro(idrubro),
            descripcion: cart.descripcion || 'Sin guardar',
            cantproductos: cart.lines.length
          };
        }));
        return;
      }
      const thisRequestId = ++requestId;
      quodomApi.misQuodom()
        .then(lista => { if (alive && thisRequestId === requestId) setItems(quodomsAItems(lista)); })
        .catch(() => {
          if (!alive || thisRequestId !== requestId) return;
          // A refresh triggered by `quodom:changed` can fail transiently
          // (e.g. the network is busy right after the mutation that fired
          // the event). Only wipe the list when there was nothing good to
          // keep yet (the very first load); otherwise keep showing the
          // last-known-good list rather than blanking a correct bar.
          setItems(prev => (prev === null ? [] : prev));
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
  // Depend on the user's id (a primitive), not the `user` object itself: an
  // object reference can change across renders without the logged-in user
  // actually changing, which would otherwise re-fire this effect (and
  // refetch) on every unrelated re-render (e.g. toggling `abierto`).
  }, [user?.id]);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    const onClickFuera = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickFuera);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickFuera);
    };
  }, [abierto]);

  if (!items || items.length === 0) return null;

  return (
    <div className="barra-quodom-wrap" ref={contenedor}>
      {abierto && <PanelQuodomsActivos items={items} onNavegar={() => setAbierto(false)} />}
      <button
        type="button"
        className="barra-quodom"
        aria-expanded={abierto}
        onClick={() => setAbierto(a => !a)}
      >
        <span className="barra-quodom-count">{items.length}</span>
        <span className="barra-quodom-label">Mis Quodoms activos</span>
        <span className="barra-quodom-arrow" aria-hidden="true">{abierto ? '⌄' : '⌃'}</span>
      </button>
    </div>
  );
}
