import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { quodom as quodomApi } from '../../api/quodom';
import type { Quodom } from '../../api/types';
import { QuodomCard } from '../QuodomCard';
import './MisQuodomsSidebar.css';

const MAX_ULTIMOS = 5;

export function MisQuodomsSidebar() {
  const { user } = useAuth();
  const [list, setList] = useState<Quodom[] | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!user) { setList([]); return; }
    let alive = true;
    quodomApi.misQuodom()
      .then(d => { if (alive) setList(d); })
      .catch(() => { if (alive) setList([]); });
    return () => { alive = false; };
  }, [user, nonce]);

  const refresh = useCallback(() => setNonce(n => n + 1), []);

  const activo = list ? list.find(q => q.estado === 'CREADO') : null;
  const otros = list ? list.filter(q => !activo || q.id !== activo.id).slice(0, MAX_ULTIMOS) : [];

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
          {activo && (
            <section className="mq-sidebar-section">
              <h3 className="mq-sidebar-section-title">Quodom activo</h3>
              <QuodomCard quodom={activo} variant="sidebar" onChange={refresh} />
            </section>
          )}

          {otros.length > 0 && (
            <section className="mq-sidebar-section">
              <h3 className="mq-sidebar-section-title">Últimos Quodoms</h3>
              <ul className="mq-sidebar-list">
                {otros.map(q => (
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
