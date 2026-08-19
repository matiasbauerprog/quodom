import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { quodom as quodomApi } from '../../api/quodom';
import type { Quodom } from '../../api/types';
import { QuodomCard } from '../QuodomCard';
import { TarjetaQuodomInvitado } from '../TarjetaQuodomInvitado';
import { LineasQuodomSidebar } from './LineasQuodomSidebar';
import { AvisoSinGuardar } from '../AvisoSinGuardar';
import { resumenCarritosInvitado, type ResumenInvitado } from '../../guest/resumenInvitado';
import { nombreRubro } from '../../quodom/rubros';
import './MisQuodomsSidebar.css';

export function MisQuodomsSidebar() {
  const { user } = useAuth();
  const [list, setList] = useState<Quodom[] | null>(null);
  const [invitado, setInvitado] = useState<ResumenInvitado[]>(resumenCarritosInvitado);
  const [nonce, setNonce] = useState(0);
  // Clave del Quodom desplegado: 'q:<id>' para los del servidor, 'g:<rubro>'
  // para los carritos. Uno solo a la vez — el elegido sube al tope, y eso no
  // tendría sentido con varios abiertos.
  const [abierto, setAbierto] = useState<string | null>(null);
  // Guards against `quodom:changed` firing repeatedly in quick succession:
  // only the response for the most recently started request is applied, so
  // an earlier request resolving after a later one can't overwrite it with
  // stale data.
  const requestIdRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const cargar = () => {
      // Los carritos de invitado se releen siempre: sobreviven a un login que
      // canceló la migración, así que también hay que mostrarlos con sesión.
      setInvitado(resumenCarritosInvitado());
      if (!user) { setList([]); return; }
      const requestId = ++requestIdRef.current;
      quodomApi.misQuodom()
        .then(d => { if (alive && requestId === requestIdRef.current) setList(d); })
        .catch(() => {
          if (!alive || requestId !== requestIdRef.current) return;
          // A refresh triggered by `quodom:changed` can fail transiently
          // (e.g. the network is busy right after the mutation that fired
          // the event). Only wipe the list when there was nothing good to
          // keep yet (the very first load); otherwise keep showing the
          // last-known-good list rather than blanking a correct sidebar.
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
  // Depend on the user's id (a primitive), not the `user` object itself:
  // an object reference can change across renders without the logged-in
  // user actually changing, which would otherwise re-fire this effect (and
  // refetch) on every unrelated re-render.
  }, [user?.id, nonce]);

  const refresh = useCallback(() => setNonce(n => n + 1), []);

  // A la derecha van sólo los activos: los enviados son historial y viven en
  // Mis Quodoms, a un clic de "Ver todos".
  const activos = list ? list.filter(q => q.estado === 'CREADO') : [];
  const hayActivos = activos.length > 0 || invitado.length > 0;

  // Una sola lista de carritos de invitado y Quodoms del servidor. El orden
  // NO cambia al desplegar: mover la tarjeta bajo el dedo hace saltar todo lo
  // demás y cuesta volver a encontrar dónde estabas.
  type Item =
    | { clave: string; tipo: 'invitado'; resumen: ResumenInvitado }
    | { clave: string; tipo: 'servidor'; quodom: Quodom };
  const items: Item[] = [
    ...invitado.map((r): Item => ({ clave: 'g:' + r.idrubro, tipo: 'invitado', resumen: r })),
    ...activos.map((q): Item => ({ clave: 'q:' + q.id, tipo: 'servidor', quodom: q }))
  ];
  const toggle = (clave: string) => setAbierto(a => (a === clave ? null : clave));
  // Sin sesión ya se ven los carritos de invitado, así que "ingresá para ver
  // tus Quodoms" dejó de ser cierto: el vacío es el mismo mensaje para los dos.
  const vacio = invitado.length === 0 && (!user || (list !== null && list.length === 0));

  return (
    <aside className="mq-sidebar" aria-label="Mis Quodoms">
      <h2 className="mq-sidebar-title">MIS QUODOMS</h2>

      {vacio && (
        <div className="mq-sidebar-empty">
          <p><strong>No tenés Quodoms.</strong></p>
          <p>Elegí un producto del catálogo y confirmá para crear tu primer Quodom.</p>
          {!user && <Link to="/login" className="btn btn-block">Ingresar</Link>}
        </div>
      )}

      {hayActivos && (
        <section className="mq-sidebar-section">
          <h3 className="mq-sidebar-section-title">Quodoms activos</h3>
          <ul className="mq-sidebar-list">
            {items.map(it => {
              const abierta = abierto === it.clave;
              return (
                <li key={it.clave} className={'mq-sidebar-item' + (abierta ? ' mq-sidebar-item-abierta' : '')}>
                  {it.tipo === 'invitado' ? (
                    <>
                      <TarjetaQuodomInvitado resumen={it.resumen} expandido={abierta} onToggle={() => toggle(it.clave)} />
                      {abierta && <LineasQuodomSidebar modo="invitado" idrubro={it.resumen.idrubro} onChange={refresh} />}
                    </>
                  ) : (
                    <>
                      <QuodomCard
                        quodom={it.quodom}
                        variant="sidebar"
                        rubroLabel={it.quodom.nombrerubro || nombreRubro(it.quodom.idrubro)}
                        onChange={refresh}
                        expandido={abierta}
                        onToggle={() => toggle(it.clave)}
                      />
                      {abierta && <LineasQuodomSidebar modo="servidor" idquodom={it.quodom.id} onChange={refresh} />}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!user && invitado.length > 0 && <AvisoSinGuardar />}

      {user && list && list.length > 0 && (
        <Link to="/mis-quodoms" className="btn mq-sidebar-vermas">Ver todos</Link>
      )}
    </aside>
  );
}
