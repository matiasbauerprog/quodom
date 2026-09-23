import { useEffect, useState } from 'react';
import { notificaciones } from '../../api/oper_notificaciones';
import type { Notificacion } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import './ListaNotificaciones.css';

export function ListaNotificaciones() {
  const [list, setList] = useState<Notificacion[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setList(null); setErr(null);
    notificaciones.list().then(d => { if (alive) setList(d); }).catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error.'); });
    return () => { alive = false; };
  }, [nonce]);

  async function marcar(n: Notificacion) {
    if (n.leida) return;
    try { await notificaciones.marcarLeida(n.id); setNonce(x => x + 1); } catch {}
  }

  return (
    <>
      {/* Sin flecha: se llega desde el menú. Ver la nota en ProfileScreen. */}
      <section className="container notif">
        <div className="pantalla-header"><h1>Notificaciones</h1></div>
        {err && <ErrorState message={err} onRetry={() => setNonce(n => n + 1)} />}
        {!err && !list && <Loader />}
        {list && list.length === 0 && <EmptyState title="No tenés notificaciones" />}
        {list && list.length > 0 && (
          <ul className="notif-list">
            {list.map(n => (
              <li key={n.id} className={'notif-item card hoja' + (n.leida ? ' notif-leida' : '')} onClick={() => marcar(n)}>
                <div className="notif-title">{n.titulo}</div>
                <div className="notif-text">{n.texto}</div>
                <div className="notif-date">{new Date(n.createdAt).toLocaleString('es-AR')}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
