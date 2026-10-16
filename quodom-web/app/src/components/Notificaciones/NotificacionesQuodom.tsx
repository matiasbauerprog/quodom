import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { notificaciones as notificacionesApi } from '../../api/oper_notificaciones';
import { quodom as quodomApi } from '../../api/quodom';
import type { Notificacion, Quodom } from '../../api/types';
import { ApiError } from '../../api/client';
import { abrirQuodom } from '../../quodom/quodomAbierto';
import { DialogoProveedores } from '../../quodom/DialogoProveedores';
import { abrirPanel } from '../layout/panelLateral';
import './NotificacionesQuodom.css';

const CUANTAS = 5;

function haceCuanto(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return 'hace ' + min + ' min';
  const h = Math.floor(min / 60);
  if (h < 24) return 'hace ' + h + ' h';
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

/**
 * The bell next to "Mis Quodoms" (desktop panel and mobile bar). Opening the
 * menu marks everything read. The provider selector is mounted here and not
 * inside the menu: the menu closes when it opens, and drawn inside it the
 * selector would go with it halfway through a send.
 */
export function NotificacionesQuodom() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sinLeer, setSinLeer] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [lista, setLista] = useState<Notificacion[] | null>(null);
  const [quodoms, setQuodoms] = useState<Record<string, Quodom>>({});
  const [error, setError] = useState<string | null>(null);
  const [repitiendo, setRepitiendo] = useState<string | null>(null);
  const [proveedoresDe, setProveedoresDe] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement>(null);

  const contar = useCallback(() => {
    if (!user) return;
    notificacionesApi.count().then(setSinLeer).catch(() => {});
  }, [user]);

  // `quodom:changed` is what a send dispatches, so the number shows up the
  // moment the Quodom leaves the tree. `notificaciones:leidas` keeps the
  // panel's and the bar's copies in step (both are mounted, one hidden by CSS).
  useEffect(() => {
    if (!user) { setSinLeer(0); return; }
    contar();
    window.addEventListener('quodom:changed', contar);
    window.addEventListener('notificaciones:leidas', contar);
    return () => {
      window.removeEventListener('quodom:changed', contar);
      window.removeEventListener('notificaciones:leidas', contar);
    };
  }, [user, contar]);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    const onFuera = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onFuera);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onFuera);
    };
  }, [abierto]);

  async function abrir() {
    if (abierto) { setAbierto(false); return; }
    setAbierto(true); setError(null); setLista(null);
    try {
      const [notifs, qs] = await Promise.all([
        notificacionesApi.list(),
        quodomApi.misQuodom().catch(() => [] as Quodom[])
      ]);
      setLista(notifs.slice(0, CUANTAS));
      setQuodoms(Object.fromEntries(qs.map(q => [q.id, q])));
      const noLeidas = notifs.filter(n => !n.leida);
      setSinLeer(0);
      if (noLeidas.length > 0) {
        await Promise.allSettled(noLeidas.map(n => notificacionesApi.marcarLeida(n.id)));
        window.dispatchEvent(new Event('notificaciones:leidas'));
      }
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'No se pudieron leer las notificaciones.');
    }
  }

  async function repetir(q: Quodom) {
    if (repitiendo) return;
    setRepitiendo(q.id); setError(null);
    try {
      const r = await quodomApi.repetir(q.id);
      abrirQuodom(q.idrubro, r.idquodom);
      // Vuelve al árbol: con el panel cerrado no se vería adónde fue.
      abrirPanel();
      window.dispatchEvent(new Event('quodom:changed'));
      setAbierto(false);
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo repetir el pedido.');
    } finally {
      setRepitiendo(null);
    }
  }

  if (!user) return null;

  return (
    <div className="notq" ref={raiz}>
      <button
        type="button"
        className={'notq-boton' + (sinLeer > 0 ? ' notq-boton-con' : '')}
        aria-label={'Notificaciones' + (sinLeer > 0 ? ' (' + sinLeer + ' sin leer)' : '')}
        aria-expanded={abierto}
        onClick={abrir}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" /><path d="M9 17a3 3 0 0 0 6 0" />
        </svg>
        {sinLeer > 0 && <span className="notq-badge">{sinLeer > 99 ? '99+' : sinLeer}</span>}
      </button>

      {abierto && (
        <section className="notq-menu" role="region" aria-label="Notificaciones">
          <h3 className="notq-titulo">Notificaciones</h3>
          {error && <p className="notq-error" role="alert">{error}</p>}
          {!lista && !error && <p className="notq-vacio">Cargando…</p>}
          {lista && lista.length === 0 && <p className="notq-vacio">No tenés notificaciones.</p>}
          {lista && lista.length > 0 && (
            <ul className="notq-lista">
              {lista.map(n => {
                const q = n.idquodom ? quodoms[n.idquodom] : undefined;
                return (
                  <li key={n.id} className="notq-item">
                    <p className="notq-texto">
                      {q ? <>Se envió <strong>{q.descripcion || q.nro}</strong></> : n.texto}
                    </p>
                    <p className="notq-meta">
                      {q && <>{q.nro} · {q.nombrerubro} · </>}{haceCuanto(n.createdAt)}
                    </p>
                    {q && (
                      <div className="notq-acciones">
                        <button
                          type="button"
                          aria-label="Ver en historial"
                          title="Ver en historial"
                          onClick={() => { setAbierto(false); navigate('/mis-quodoms?pedido=' + encodeURIComponent(q.id)); }}
                        >Historial</button>
                        <button
                          type="button"
                          aria-label="Repetir pedido"
                          title="Repetir pedido: crea uno nuevo con los mismos productos"
                          disabled={repitiendo !== null}
                          onClick={() => repetir(q)}
                        >{repitiendo === q.id ? 'Repitiendo…' : 'Repetir'}</button>
                        {q.estado === 'ENVIADO' && (
                          <button
                            type="button"
                            aria-label="Cotizar con otro proveedor"
                            title="Cotizar con otro proveedor"
                            onClick={() => { setAbierto(false); setProveedoresDe(q.id); }}
                          >Otro proveedor</button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <Link to="/notificaciones" className="notq-todas" onClick={() => setAbierto(false)}>Ver todas →</Link>
        </section>
      )}

      {proveedoresDe && (
        <DialogoProveedores idquodom={proveedoresDe} onCerrar={() => setProveedoresDe(null)} />
      )}
    </div>
  );
}
