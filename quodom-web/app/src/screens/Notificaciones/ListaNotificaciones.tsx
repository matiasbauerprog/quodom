import { useEffect, useState } from 'react';
import { notificaciones } from '../../api/oper_notificaciones';
import { quodom as quodomApi } from '../../api/quodom';
import type { Notificacion, Quodom } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { AccionesNotificacion, repetirPedido } from '../../components/Notificaciones/AccionesNotificacion';
import { DialogoProveedores } from '../../quodom/DialogoProveedores';
import './ListaNotificaciones.css';

/**
 * Todas las notificaciones, con lo mismo que ofrece la campana: es adonde
 * lleva su "Ver todas". Entrar marca las no leídas como la campana al abrirse,
 * pero la lista conserva cómo llegaron para que se vea cuáles eran nuevas.
 */
export function ListaNotificaciones() {
  const [list, setList] = useState<Notificacion[] | null>(null);
  const [quodoms, setQuodoms] = useState<Record<string, Quodom>>({});
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [repitiendo, setRepitiendo] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [proveedoresDe, setProveedoresDe] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setList(null); setErr(null);
    Promise.all([
      notificaciones.list(),
      quodomApi.misQuodom().catch(() => [] as Quodom[])
    ]).then(async ([notifs, qs]) => {
      if (!alive) return;
      setList(notifs);
      setQuodoms(Object.fromEntries(qs.map(q => [q.id, q])));
      const noLeidas = notifs.filter(n => !n.leida);
      if (noLeidas.length > 0) {
        await Promise.allSettled(noLeidas.map(n => notificaciones.marcarLeida(n.id)));
        window.dispatchEvent(new Event('notificaciones:leidas'));
      }
    }).catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error.'); });
    return () => { alive = false; };
  }, [nonce]);

  async function repetir(q: Quodom) {
    if (repitiendo) return;
    setRepitiendo(q.id); setErrorAccion(null);
    try {
      await repetirPedido(q);
    } catch (e) {
      setErrorAccion(e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo repetir el pedido.');
    } finally {
      setRepitiendo(null);
    }
  }

  return (
    <>
      {/* Sin flecha: se llega desde el menú. Ver la nota en ProfileScreen. */}
      <section className="container notif">
        <div className="pantalla-header"><h1>Notificaciones</h1></div>
        <div className="pantalla-contenido">
        {err && <ErrorState message={err} onRetry={() => setNonce(n => n + 1)} />}
        {!err && !list && <Loader />}
        {errorAccion && <p className="notif-error" role="alert">{errorAccion}</p>}
        {list && list.length === 0 && <EmptyState title="No tenés notificaciones" />}
        {list && list.length > 0 && (
          <ul className="notif-list">
            {list.map(n => {
              const q = n.idquodom ? quodoms[n.idquodom] : undefined;
              return (
                <li key={n.id} className={'notif-item card hoja' + (n.leida ? ' notif-leida' : '')}>
                  <div className="notif-title">{q ? <>Se envió <strong>{q.descripcion || q.nro}</strong></> : n.titulo}</div>
                  <div className="notif-text">{q ? q.nro + ' · ' + q.nombrerubro : n.texto}</div>
                  <div className="notif-date">{new Date(n.createdAt).toLocaleString('es-AR')}</div>
                  {q && (
                    <AccionesNotificacion
                      q={q}
                      repitiendo={repitiendo}
                      onRepetir={repetir}
                      onOtroProveedor={x => setProveedoresDe(x.id)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        </div>
      </section>

      {/* Afuera de la lista, por la misma razón que en la campana. */}
      {proveedoresDe && (
        <DialogoProveedores idquodom={proveedoresDe} onCerrar={() => setProveedoresDe(null)} />
      )}
    </>
  );
}
