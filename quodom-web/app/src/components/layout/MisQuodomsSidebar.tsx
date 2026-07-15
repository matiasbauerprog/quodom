import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { quodom as quodomApi } from '../../api/quodom';
import type { Quodom } from '../../api/types';
import { QuodomCard } from '../QuodomCard';
import './MisQuodomsSidebar.css';

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
          <p><strong>No tenés Quodoms activos.</strong></p>
          <p>Navegá, agregá productos y se creará uno.</p>
        </div>
      )}
      {user && list && list.length > 0 && (
        <ul className="mq-sidebar-list">
          {list.map(q => (
            <li key={q.id} className="mq-sidebar-item">
              <QuodomCard quodom={q} variant="sidebar" onChange={refresh} />
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
