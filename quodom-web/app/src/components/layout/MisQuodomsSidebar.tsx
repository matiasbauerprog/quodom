import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { quodom as quodomApi } from '../../api/quodom';
import type { Quodom } from '../../api/types';
import { QuodomCard } from '../QuodomCard';
import { nombreRubro } from '../../quodom/rubros';
import './MisQuodomsSidebar.css';

const MAX_ULTIMOS = 5;

export function MisQuodomsSidebar() {
  const { user } = useAuth();
  const [list, setList] = useState<Quodom[] | null>(null);
  const [nonce, setNonce] = useState(0);
  // Guards against `quodom:changed` firing repeatedly in quick succession:
  // only the response for the most recently started request is applied, so
  // an earlier request resolving after a later one can't overwrite it with
  // stale data.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!user) { setList([]); return; }
    let alive = true;
    const cargar = () => {
      const requestId = ++requestIdRef.current;
      quodomApi.misQuodom()
        .then(d => { if (alive && requestId === requestIdRef.current) setList(d); })
        .catch(() => { if (alive && requestId === requestIdRef.current) setList([]); });
    };
    cargar();
    window.addEventListener('quodom:changed', cargar);
    return () => { alive = false; window.removeEventListener('quodom:changed', cargar); };
  }, [user, nonce]);

  const refresh = useCallback(() => setNonce(n => n + 1), []);

  const activos = list ? list.filter(q => q.estado === 'CREADO') : [];
  const enviados = list ? list.filter(q => q.estado === 'ENVIADO').slice(0, MAX_ULTIMOS) : [];

  return (
    <aside className="mq-sidebar" aria-label="Mis Quodoms">
      <h2 className="mq-sidebar-title">MIS QUODOMS</h2>

      {!user && (
        <div className="mq-sidebar-empty">
          <p>Ingresá para ver tus Quodoms.</p>
          <Link to="/login" className="btn btn-block">Ingresar</Link>
        </div>
      )}

      {user && list && list.length === 0 && (
        <div className="mq-sidebar-empty">
          <p><strong>No tenés Quodoms.</strong></p>
          <p>Navegá, agregá productos y se creará uno.</p>
        </div>
      )}

      {user && list && list.length > 0 && (
        <>
          {activos.length > 0 && (
            <section className="mq-sidebar-section">
              <h3 className="mq-sidebar-section-title">Quodoms activos</h3>
              <ul className="mq-sidebar-list">
                {activos.map(q => (
                  <li key={q.id} className="mq-sidebar-item">
                    <QuodomCard
                      quodom={q}
                      variant="sidebar"
                      rubroLabel={q.nombrerubro || nombreRubro(q.idrubro)}
                      onChange={refresh}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {enviados.length > 0 && (
            <section className="mq-sidebar-section">
              <h3 className="mq-sidebar-section-title">Últimos Quodoms</h3>
              <ul className="mq-sidebar-list">
                {enviados.map(q => (
                  <li key={q.id} className="mq-sidebar-item">
                    <QuodomCard quodom={q} variant="sidebar" onChange={refresh} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Link to="/mis-quodoms" className="btn mq-sidebar-vermas">Ver todos</Link>
        </>
      )}
    </aside>
  );
}
