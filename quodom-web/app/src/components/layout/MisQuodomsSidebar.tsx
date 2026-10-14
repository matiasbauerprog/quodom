import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { quodom as quodomApi } from '../../api/quodom';
import { ApiError } from '../../api/client';
import { openWhatsappLink } from '../../utils/whatsapp';
import type { Quodom } from '../../api/types';
import { TarjetaQuodomInvitado } from '../TarjetaQuodomInvitado';
import { LineasQuodomSidebar } from './LineasQuodomSidebar';
import { ArbolQuodoms } from './ArbolQuodoms';
import { AvisoSinGuardar } from '../AvisoSinGuardar';
import { resumenCarritosInvitado, type ResumenInvitado } from '../../guest/resumenInvitado';
import { bloqueoDeEnvio } from '../../quodom/bloqueosEnvio';
import { sanearAbiertos } from '../../quodom/quodomAbierto';
import { ramasDeQuodoms } from '../../quodom/ramas';
import { rubrosDisponibles } from '../../quodom/rubrosDisponibles';
import { useTieneDireccion } from '../../quodom/useTieneDireccion';
import './MisQuodomsSidebar.css';

export function MisQuodomsSidebar() {
  const { user } = useAuth();
  const tieneDireccion = useTieneDireccion(!!user);
  const [list, setList] = useState<Quodom[] | null>(null);
  const [disponibles, setDisponibles] = useState<number[]>([]);
  const [invitado, setInvitado] = useState<ResumenInvitado[]>(resumenCarritosInvitado);
  const [nonce, setNonce] = useState(0);
  // Clave del carrito de invitado desplegado ('g:<rubro>'). Los del servidor se
  // despliegan en el árbol, que recuerda su propio abierto por rubro.
  const [abierto, setAbierto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [errEnviar, setErrEnviar] = useState<string | null>(null);
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
      Promise.all([quodomApi.misQuodom(), rubrosDisponibles()])
        .then(([d, rubros]) => {
          if (!alive || requestId !== requestIdRef.current) return;
          setList(d);
          setDisponibles(rubros);
          // Sólo tras una carga buena: sanear descarta todo lo que no esté en
          // la lista, así que con una carga pendiente o fallida cerraría los
          // Quodoms que el usuario tenía abiertos sin motivo.
          sanearAbiertos(d.filter(q => q.estado === 'CREADO').map(q => q.id));
        })
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

  // A la derecha va sólo lo que está en armado: los enviados son historial y
  // viven en Mis Quodoms, a un clic del pie del árbol.
  const ramas = ramasDeQuodoms(list ?? [], disponibles);
  const hayInvitado = invitado.length > 0;
  const toggle = (clave: string) => setAbierto(a => (a === clave ? null : clave));

  async function enviar(q: Quodom) {
    if (enviando) return;
    setEnviando(q.id); setErrEnviar(null);
    try {
      const r = await quodomApi.whatsapp(q.id);
      openWhatsappLink(r.link);
      // El estado lo cambia el backend al dar el link: este aviso hace que el
      // árbol y la barra inferior lo suelten, en vez de seguir mostrándolo activo.
      window.dispatchEvent(new Event('quodom:changed'));
      refresh();
    } catch (e) {
      setErrEnviar(e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo enviar.');
    } finally { setEnviando(null); }
  }

  // Sin sesión ya se ven los carritos de invitado, así que "ingresá para ver
  // tus Quodoms" dejó de ser cierto: el vacío es el mismo mensaje para los dos.
  const vacio = !hayInvitado && (!user || (list !== null && ramas.length === 0));

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

      {hayInvitado && (
        <section className="mq-sidebar-section">
          <h3 className="mq-sidebar-section-title">Quodoms activos</h3>
          <ul className="mq-sidebar-list">
            {invitado.map(r => {
              const clave = 'g:' + r.idrubro;
              const abierta = abierto === clave;
              return (
                <li key={clave} className={'mq-sidebar-item' + (abierta ? ' mq-sidebar-item-abierta' : '')}>
                  <TarjetaQuodomInvitado resumen={r} expandido={abierta} onToggle={() => toggle(clave)} />
                  {abierta && <LineasQuodomSidebar modo="invitado" idrubro={r.idrubro} onChange={refresh} />}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {ramas.length > 0 && (
        <ArbolQuodoms
          ramas={ramas}
          onCambio={refresh}
          renderAbierto={q => {
            const bloqueo = bloqueoDeEnvio(q, tieneDireccion);
            return (
              <>
                <LineasQuodomSidebar modo="servidor" idquodom={q.id} onChange={refresh} />
                <div className="mq-sidebar-enviar">
                  <button
                    type="button"
                    className="btn btn-block"
                    disabled={enviando === q.id || !!bloqueo}
                    onClick={() => { if (!bloqueo) enviar(q); }}
                  >
                    {enviando === q.id ? 'Enviando…' : 'Enviar por WhatsApp'}
                  </button>
                  {bloqueo && (
                    <p className="mq-sidebar-bloqueo">
                      {bloqueo.texto}{' '}
                      {bloqueo.motivo === 'direccion'
                        ? <Link to="/direcciones/nuevo">{bloqueo.accion}</Link>
                        : <span>{bloqueo.accion}</span>}
                    </p>
                  )}
                </div>
              </>
            );
          }}
        />
      )}

      {errEnviar && <p className="mq-sidebar-err" role="alert">{errEnviar}</p>}

      {!user && hayInvitado && <AvisoSinGuardar />}

      {/* Al pie de todo: lo enviado y repetir un pedido viven en la pantalla
          completa, y este panel queda para lo que está en armado. */}
      {user && <Link to="/mis-quodoms" className="btn btn-block mq-sidebar-vermas">Mis Quodoms</Link>}
    </aside>
  );
}
