import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { quodom as quodomApi } from '../../api/quodom';
import type { Quodom } from '../../api/types';
import './MisQuodomsSidebar.css';

export function MisQuodomsSidebar() {
  const { user } = useAuth();
  const [list, setList] = useState<Quodom[] | null>(null);

  useEffect(() => {
    if (!user) { setList([]); return; }
    let alive = true;
    quodomApi.misQuodom()
      .then(d => { if (alive) setList(d); })
      .catch(() => { if (alive) setList([]); });
    return () => { alive = false; };
  }, [user]);

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
              <Link to={'/quodom?id=' + encodeURIComponent(q.id)} className="mq-sidebar-link">
                <div className="mq-sidebar-item-head">
                  <span className="mq-sidebar-nro">{q.nro}</span>
                  <span className={'mq-sidebar-badge mq-sidebar-badge-' + q.estado.toLowerCase()}>{q.estado}</span>
                </div>
                <div className="mq-sidebar-desc">{q.descripcion}</div>
                <div className="mq-sidebar-meta">{q.cantproductos ?? 0} productos · {q.porccompletado ?? 0}% completo</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
