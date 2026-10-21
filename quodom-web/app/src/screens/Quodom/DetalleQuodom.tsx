import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import {
  getGuestCart, guestRubrosConLineas, removeGuestLine, setGuestDescripcion,
  updateGuestLineAtributos, updateGuestLineCantidad
} from '../../guest/guestQuodom';
import { quodom as quodomApi } from '../../api/quodom';
import { quodomLines as linesApi } from '../../api/quodom_lines';
import type { Quodom, QuodomLine } from '../../api/types';
import { ApiError } from '../../api/client';
import { AppBarBack } from '../../components/layout/AppBarBack';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { SelectorAtributo } from './SelectorAtributo';
import { ProductImage } from '../../components/ProductImage';
import { DialogoProveedores } from '../../quodom/DialogoProveedores';
import { ProveedoresContactados } from '../../quodom/ProveedoresContactados';
import { migrarRubro } from '../../guest/migrateGuestQuodom';
import { nombreRubro } from '../../quodom/rubros';
import { rubroDisponible } from '../../quodom/rubrosDisponibles';
import { abiertoDe, abrirQuodom as dejarAbierto } from '../../quodom/quodomAbierto';
import { bloqueoDeEnvioPorLineas } from '../../quodom/bloqueosEnvio';
import { useTieneDireccion } from '../../quodom/useTieneDireccion';
import './DetalleQuodom.css';

type Mode = 'guest' | 'server';

// `''` (an empty `?rubro=`), a non-numeric value, or the param being absent
// all mean the same thing here: "no rubro chosen". Anything else — including
// an id that doesn't match a known rubro — is taken at face value; it just
// resolves to an empty cart with a fallback name (see nombreRubro).
function parseIdrubro(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

type Props = {
  /** El Quodom del servidor; sin esto se lee `?id=` (la ruta) o es un carrito de invitado. */
  idquodom?: string;
  nombrar?: boolean;
  /** Ya seleccionó el nombre: quien lo pidió saca la marca de la URL. */
  onNombrado?: () => void;
  /** Con esto se dibuja como ventana (`VentanaQuodom`) y no como pantalla. */
  onCerrar?: () => void;
};

export function DetalleQuodom({ idquodom, nombrar: nombrarProp, onNombrado, onCerrar }: Props = {}) {
  const [sp, setSp] = useSearchParams();
  const id = idquodom ?? sp.get('id');
  const enVentana = !!onCerrar;
  // Viene de Repetir: el pedido nuevo nace con el nombre del original, así que
  // se abre con el nombre listo para cambiar. Si no, quedan dos iguales en el
  // árbol y no hay forma de saber cuál es cuál.
  const nombrar = nombrarProp ?? sp.get('nombrar') === '1';
  const [renombrando, setRenombrando] = useState(false);
  const campoNombre = useRef<HTMLInputElement>(null);
  const campoDetalle = useRef<HTMLTextAreaElement>(null);
  const idrubro = parseIdrubro(sp.get('rubro'));
  const { user } = useAuth();
  const tieneDireccion = useTieneDireccion(!!user);
  const navigate = useNavigate();
  const mode: Mode = id ? 'server' : 'guest';

  const [descripcion, setDescripcion] = useState<string>('');
  const [detalle, setDetalle] = useState<string>('');
  const [server, setServer] = useState<{ quodom: Quodom; lines: QuodomLine[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attr, setAttr] = useState<{ lineIndex?: number; lineId?: number; idproducto: number; nombreatributo: string; slot: 1 | 2; actual: string | null | undefined } | null>(null);
  const [nonce, setNonce] = useState(0);
  // El selector de proveedores abierto, y si al cerrarlo hay que salir de esta
  // pantalla: el envío de un carrito de invitado lo migra primero, así que el
  // carrito ya no existe y quedarse acá deja al comprador mirando un vacío.
  const [selector, setSelector] = useState<{ idquodom: string; migrado: boolean } | null>(null);
  // El selector ya se usó en esta visita. La sección de contactados no se monta
  // después: el comprador acaba de ver esa misma lista en el diálogo, y montarla
  // al cerrarlo gastaba una búsqueda **paga** más por envío (tres en total, una
  // necesaria) para repetirle lo que tenía delante. En la próxima entrada a la
  // pantalla aparece como siempre.
  const [selectorUsado, setSelectorUsado] = useState(false);
  // A cart can outlive its rubro: guest carts live in the user's own
  // localStorage and survive a deploy that retires one. Sending such a cart
  // always fails (POST /quodom/create -> 400 idrubro_invalido), so the send
  // is withdrawn instead of offered. Defaults to `true` and only flips on a
  // definite answer: a catalogue hiccup must not withdraw a valid send.
  const [rubroHabilitado, setRubroHabilitado] = useState(true);

  const guest = useMemo(
    () => (idrubro !== null ? getGuestCart(idrubro) : { descripcion: '', lines: [] }),
    [idrubro, nonce]
  );
  const rubrosDisponibles = useMemo(() => guestRubrosConLineas(), [nonce]);

  // No rubro chosen yet: a guest with exactly one open cart is dropped
  // straight into it; several carts wait for the chooser rendered below.
  useEffect(() => {
    if (mode !== 'guest' || idrubro !== null) return;
    if (rubrosDisponibles.length === 1) {
      navigate('/quodom?rubro=' + rubrosDisponibles[0], { replace: true });
    }
  }, [mode, idrubro, rubrosDisponibles, navigate]);

  // A logged-in user's Quodom lives on the server. Reaching /quodom without a
  // rubro and with no guest carts pending means "show me my Quodom" — send
  // them to the active one. Guest carts still pending take priority (they
  // must not be silently skipped past), so this only fires once there are
  // none left.
  useEffect(() => {
    if (mode !== 'guest' || idrubro !== null || !user || rubrosDisponibles.length > 0) return;
    let alive = true;
    quodomApi.misQuodom()
      .then(lista => {
        const activo = lista.find(q => q.estado === 'CREADO');
        if (alive && activo) navigate('/quodom?id=' + encodeURIComponent(activo.id), { replace: true });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [mode, idrubro, user, rubrosDisponibles.length, navigate]);

  // A logged-in user landing on /quodom?rubro=X whose guest cart for that
  // rubro is already empty (migrated already, e.g. by the login screen, or
  // it never had lines) gets sent to the server Quodom for that rubro, if
  // one exists. A rubro can have several: the open one wins (it is the one
  // the user was working in), otherwise the most recent.
  useEffect(() => {
    if (mode !== 'guest' || idrubro === null || !user || guest.lines.length > 0) return;
    let alive = true;
    quodomApi.activosPorRubro(idrubro)
      .then(lista => {
        const abierto = abiertoDe(idrubro);
        const destino = lista.find(q => q.id === abierto) ?? lista[0];
        if (alive && destino) navigate('/quodom?id=' + encodeURIComponent(destino.id), { replace: true });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [mode, idrubro, user, guest.lines.length, navigate]);

  useEffect(() => {
    if (mode !== 'guest' || idrubro === null) { setRubroHabilitado(true); return; }
    let alive = true;
    rubroDisponible(idrubro)
      .then(ok => { if (alive) setRubroHabilitado(ok); })
      .catch(() => {});
    return () => { alive = false; };
  }, [mode, idrubro]);

  useEffect(() => {
    if (mode === 'guest') { setDescripcion(guest.descripcion); return; }
    let alive = true;
    setServer(null); setErr(null);
    Promise.all([quodomApi.porId(id!), linesApi.porQuodom(id!)])
      .then(([q, lines]) => {
        if (!alive) return;
        setServer({ quodom: q, lines });
        setDescripcion(q.descripcion);
        setDetalle(q.detalle ?? '');
      })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error al cargar el Quodom.'); });
    return () => { alive = false; };
  }, [mode, id, nonce, guest.descripcion]);

  // Una sola vez, cuando ya cargó el nombre: el parámetro se saca de la URL para
  // que volver a esta pantalla o recargarla no vuelva a seleccionarlo.
  useEffect(() => {
    if (!nombrar || !server) return;
    setRenombrando(true);
    const campo = campoNombre.current;
    if (campo) { campo.focus(); campo.select(); }
    if (onNombrado) { onNombrado(); return; }
    const resto = new URLSearchParams(sp);
    resto.delete('nombrar');
    setSp(resto, { replace: true });
  }, [nombrar, server, sp, setSp, onNombrado]);

  // Escape cierra la ventana, salvo que haya otra encima (atributo o
  // proveedores): esa se cierra sola y la de abajo tiene que seguir.
  // El nombre se guarda al perder el foco, y Escape no lo saca: sin el blur,
  // lo que se escribió se perdía al cerrar.
  useEffect(() => {
    if (!onCerrar || attr || selector) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      campoNombre.current?.blur();
      campoDetalle.current?.blur();
      onCerrar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar, attr, selector]);

  const saveDescripcion = useCallback(async (value: string) => {
    if (mode === 'guest') { if (idrubro !== null) setGuestDescripcion(idrubro, value); }
    else if (server) {
      const nuevo = value.trim() || 'Mi Quodom';
      if (nuevo === server.quodom.descripcion) return;
      try {
        await quodomApi.update(server.quodom.id, { descripcion: nuevo });
        setServer(s => s && { ...s, quodom: { ...s.quodom, descripcion: nuevo } });
        // El árbol del panel muestra el nombre: sin esto seguía diciendo el
        // viejo, que es justo lo que renombrar una copia quiere evitar.
        window.dispatchEvent(new Event('quodom:changed'));
      } catch {}
    }
  }, [mode, idrubro, server]);

  const saveDetalle = useCallback(async (value: string) => {
    if (!server) return;
    const nuevo = value.trim() || null;
    if (nuevo === (server.quodom.detalle ?? null)) return;
    try {
      await quodomApi.update(server.quodom.id, { detalle: nuevo });
      setServer(s => s && { ...s, quodom: { ...s.quodom, detalle: nuevo } });
    } catch {}
  }, [server]);

  async function cambiarCantidadServer(line: QuodomLine, cantidad: number) {
    try {
      if (cantidad <= 0) await linesApi.eliminar(line.id);
      else await linesApi.update(line.id, { cantidad });
      setNonce(n => n + 1);
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'No se pudo actualizar la cantidad.'); }
  }
  async function cambiarAtributoServer(line: QuodomLine, slot: 1 | 2, valor: string) {
    try {
      await linesApi.update(line.id, slot === 1 ? { atributo1: valor } : { atributo2: valor });
      setNonce(n => n + 1);
      // El sidebar decide si puede enviar con `porccompletado`, que le llega
      // del servidor: sin este aviso se queda diciendo "falta elegir la
      // medida" sobre un Quodom que acaba de completarse.
      window.dispatchEvent(new Event('quodom:changed'));
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'No se pudo actualizar el atributo.'); }
  }

  async function enviarWhatsapp() {
    if (mode === 'guest') {
      if (idrubro === null) return;
      if (!user) { navigate('/login', { state: { from: '/quodom?rubro=' + idrubro } }); return; }
      setBusy(true);
      setErr(null);
      try {
        // Migrates just this rubro's guest cart into a new Quodom and sends it.
        // A rubro can have many open Quodoms, so there is no conflict to ask
        // about. The cart is only cleared by migrarRubro once every line is
        // confirmed on the server, so a failure here leaves it intact to retry.
        const idquodom = await migrarRubro(idrubro);
        if (!idquodom) { setErr('No hay productos en el Quodom.'); return; }
        // Migrado y recién ahora se elige a quién: el selector es el que envía.
        setSelector({ idquodom, migrado: true });
        setSelectorUsado(true);
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : 'No se pudo enviar.');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!server) return;
    setSelector({ idquodom: server.quodom.id, migrado: false });
    setSelectorUsado(true);
  }

  function cerrarSelector() {
    const migrado = selector?.migrado;
    setSelector(null);
    // El carrito de invitado ya migró: esta pantalla quedó vacía, así que el
    // lugar del Quodom es el historial.
    if (migrado) navigate('/mis-quodoms', { replace: true });
  }

  // El backend pasa el Quodom a ENVIADO al dar el link. Sin este aviso el
  // sidebar y la barra inferior lo seguían mostrando en armado. El selector
  // sigue abierto: mandarle a varios proveedores es para lo que existe.
  function avisarEnviado() {
    // El nonce sólo recarga datos del servidor. En modo invitado además
    // volvería a leer el carrito, que la migración dejó vacío, y eso dispara
    // la redirección al Quodom del rubro en medio del envío.
    if (mode === 'server') setNonce(n => n + 1);
    window.dispatchEvent(new Event('quodom:changed'));
  }

  const lines = mode === 'guest'
    ? guest.lines.map((l, idx) => ({
        key: 'g-' + idx, cantidad: l.cantidad, nombreProducto: l.nombreProducto,
        atributo1: l.atributo1, atributo2: l.atributo2,
        nombreAtributo1: l.nombreAtributo1, nombreAtributo2: l.nombreAtributo2,
        idproducto: l.idproducto,
        onCantidad: (c: number) => { if (idrubro !== null) updateGuestLineCantidad(idrubro, idx, c); setNonce(n => n + 1); window.dispatchEvent(new Event('quodom:changed')); },
        onRemove: () => { if (idrubro !== null) removeGuestLine(idrubro, idx); setNonce(n => n + 1); window.dispatchEvent(new Event('quodom:changed')); },
        onAttr: (slot: 1 | 2, valor: string) => { if (idrubro !== null) updateGuestLineAtributos(idrubro, idx, slot === 1 ? { atributo1: valor } : { atributo2: valor }); setNonce(n => n + 1); window.dispatchEvent(new Event('quodom:changed')); }
      }))
    : (server?.lines ?? []).map(l => ({
        key: 's-' + l.id, cantidad: l.cantidad, nombreProducto: l.nombreProducto,
        atributo1: l.atributo1, atributo2: l.atributo2,
        nombreAtributo1: l.nombreAtributo1, nombreAtributo2: l.nombreAtributo2,
        idproducto: l.idproducto,
        onCantidad: (c: number) => cambiarCantidadServer(l, c),
        onRemove: () => cambiarCantidadServer(l, 0),
        onAttr: (slot: 1 | 2, valor: string) => cambiarAtributoServer(l, slot, valor)
      }));

  // No rubro chosen: either offer a chooser (several guest carts open) or
  // show the empty state (none). The single-cart case never reaches this
  // render — the effect above redirects it before this point.
  if (mode === 'guest' && idrubro === null) {
    return (
      <>
        <AppBarBack title="Mi Quodom" />
        <section className="container detalle-quodom">
          {rubrosDisponibles.length > 1 && (
            <>
              <p>Tenés varios Quodoms en curso. Elegí uno para continuar:</p>
              <ul className="dq-chooser">
                {rubrosDisponibles.map(r => (
                  <li key={r}>
                    <Link className="card hoja dq-chooser-item" to={'/quodom?rubro=' + r}>
                      <strong>{nombreRubro(r)}</strong>
                      <span>{getGuestCart(r).lines.length} producto(s)</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {rubrosDisponibles.length === 0 && <p className="dq-empty">Tu Quodom está vacío. Sumá productos desde Inicio.</p>}
        </section>
      </>
    );
  }

  const yaEnviado = mode === 'server' && server?.quodom.estado === 'ENVIADO';
  // Lo que falta para que el proveedor pueda cotizar. Las líneas están acá, así
  // que se miran una por una en vez de confiar en `porccompletado`.
  const bloqueo = yaEnviado ? null : bloqueoDeEnvioPorLineas(lines, tieneDireccion);
  const enviarDisabled = busy || lines.length === 0 || yaEnviado || !!bloqueo;

  const rubroDelQuodom = mode === 'server'
    ? (server ? (server.quodom.nombrerubro || nombreRubro(server.quodom.idrubro)) : '')
    : (idrubro !== null ? nombreRubro(idrubro) : '');

  // En la ventana, el selector de proveedores la reemplaza en vez de apilarse
  // encima: dos ventanas oscureciendo el fondo no se lee como un paso, se lee
  // como un error. Al cerrarlo se vuelve al pedido, como en el historial.
  if (enVentana && selector) {
    return (
      <DialogoProveedores
        idquodom={selector.idquodom}
        onCerrar={cerrarSelector}
        onEnviado={avisarEnviado}
        onEnviadoSinProveedor={cerrarSelector}
      />
    );
  }

  function elegirAtributo(l: (typeof lines)[number], slot: 1 | 2) {
    const nombreatributo = slot === 1 ? l.nombreAtributo1 : l.nombreAtributo2;
    if (!nombreatributo) return;
    const n = Number(l.key.slice(2));
    setAttr({
      lineIndex: mode === 'guest' ? n : undefined,
      lineId: mode === 'server' ? n : undefined,
      idproducto: l.idproducto, nombreatributo, slot,
      actual: slot === 1 ? l.atributo1 : l.atributo2
    });
  }

  // El nombre es el título: el número (QD-49) se leía como un id interno, y
  // "Descripción" no decía que ese campo era el nombre del Quodom.
  const campoDelNombre = (
    <div className={'dq-nombre' + (renombrando ? ' dq-renombrando' : '')}>
      <input
        ref={campoNombre}
        className="dq-nombre-input"
        aria-label="Nombre del Quodom"
        placeholder="Ponele un nombre"
        // Un enviado no se renombra: el proveedor cotiza sobre lo que recibió.
        readOnly={yaEnviado}
        value={descripcion}
        onChange={e => setDescripcion(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        onBlur={() => { setRenombrando(false); saveDescripcion(descripcion); }}
      />
      {renombrando && <small className="dq-renombrar-ayuda">Es una copia de tu pedido. Ponele otro nombre para distinguirlo del original.</small>}
    </div>
  );

  const cuerpo = (
    <>
        {err && <ErrorState message={err} onRetry={() => setNonce(n => n + 1)} />}
        {mode === 'server' && !server && !err && <Loader />}

        {!enVentana && campoDelNombre}

        {/* Opcional y sólo en el servidor: el carrito de invitado no tiene
            dónde guardarlo y la migración no lo llevaría. */}
        {mode === 'server' && server && !(yaEnviado && !detalle) && (
          <textarea
            ref={campoDetalle}
            className="dq-detalle"
            aria-label="Descripción"
            placeholder="Agregá una descripción (opcional)"
            rows={2}
            maxLength={500}
            readOnly={yaEnviado}
            value={detalle}
            onChange={e => setDetalle(e.target.value)}
            onBlur={() => saveDetalle(detalle)}
          />
        )}

        {lines.length === 0 && (mode === 'guest' || server) && (
          <p className="dq-empty">Tu Quodom está vacío. Sumá productos desde Inicio.</p>
        )}

        {lines.length > 0 && (
          <>
            <p className="dq-lineas-cab">
              <span>Productos</span>
              <span>{lines.length}</span>
            </p>
            <ul className="dq-lineas">
              {lines.map(l => (
                <li key={l.key} className="dq-linea">
                  <ProductImage idproducto={l.idproducto} alt="" size="sm" />
                  <div className="dq-linea-info">
                    <span className="dq-linea-nombre" title={l.nombreProducto ?? ''}>{l.nombreProducto}</span>
                    {(l.nombreAtributo1 || l.nombreAtributo2) && (
                      <span className="dq-linea-attrs">
                        {([1, 2] as const).map(slot => {
                          const nombre = slot === 1 ? l.nombreAtributo1 : l.nombreAtributo2;
                          const valor = slot === 1 ? l.atributo1 : l.atributo2;
                          if (!nombre) return null;
                          return (
                            <button
                              key={slot}
                              type="button"
                              className={'dq-attr' + (valor ? '' : ' dq-attr-falta')}
                              aria-label={(valor ? 'Cambiar ' : 'Elegir ') + nombre.toLowerCase() + ' de ' + l.nombreProducto}
                              onClick={() => elegirAtributo(l, slot)}
                            >
                              {valor
                                ? <><span className="dq-attr-nombre">{nombre.toLowerCase()}</span> {valor}</>
                                : <>Elegir {nombre.toLowerCase()}</>}
                              <span aria-hidden="true"> ▾</span>
                            </button>
                          );
                        })}
                      </span>
                    )}
                  </div>
                  <span className="dq-stepper">
                    <button type="button" className="dq-step" aria-label={'Restar ' + l.nombreProducto} onClick={() => l.onCantidad(Math.max(0, l.cantidad - 1))}>−</button>
                    <span className="dq-cant">{l.cantidad}</span>
                    <button type="button" className="dq-step" aria-label={'Sumar ' + l.nombreProducto} onClick={() => l.onCantidad(l.cantidad + 1)}>+</button>
                  </span>
                  <button type="button" className="dq-quitar" aria-label={'Quitar ' + l.nombreProducto} onClick={l.onRemove}>×</button>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Enviado no es el final: el comprador le manda a uno, no le contestan
            y le manda a otro, y a quién ya le mandó sólo lo sabe el servidor.
            No se monta mientras el selector está abierto NI después de haberlo
            usado en esta visita, y eso no es cosmética: el envío pasa el Quodom
            a ENVIADO y el nonce lo recarga, así que la sección aparecía
            **detrás** del diálogo y gastaba una búsqueda paga más por cada
            envío (tres por el primero, una necesaria) para repetir la lista que
            el comprador tenía delante. Y eran dos `useProveedores` del mismo
            Quodom con estados separados: deshacer en uno dejaba al otro
            mostrándolo contactado. */}
        {yaEnviado && server && !selector && !selectorUsado && (
          <ProveedoresContactados idquodom={server.quodom.id} />
        )}

        {selector && !enVentana && (
          <DialogoProveedores
            idquodom={selector.idquodom}
            onCerrar={cerrarSelector}
            onEnviado={avisarEnviado}
            onEnviadoSinProveedor={cerrarSelector}
          />
        )}

        {attr && (
          <SelectorAtributo
            idproducto={attr.idproducto}
            nombreatributo={attr.nombreatributo}
            valorActual={attr.actual}
            onClose={() => setAttr(null)}
            onSelect={valor => {
              const l = lines.find(x => (mode === 'guest' ? Number(x.key.slice(2)) === attr.lineIndex : Number(x.key.slice(2)) === attr.lineId));
              l?.onAttr(attr.slot, valor);
              setAttr(null);
            }}
          />
        )}
    </>
  );

  // Seguir sumando productos a este Quodom: queda abierto en su rubro (el que
  // recibe el `+`) y se va al catálogo de ese rubro. Reemplaza la entrada de la
  // ventana, así Atrás vuelve a donde estaba el usuario y no a la ventana.
  function continuarEnRubro() {
    if (!server) return;
    const { id, idrubro: rubro } = server.quodom;
    dejarAbierto(rubro, id);
    navigate('/?rubro=' + rubro, { replace: true });
  }

  // El envío va al pie y no al final de la lista: con varios productos, en la
  // ventana quedaba fuera de la vista y había que bajar a buscarlo.
  const pie = rubroHabilitado ? (
    <>
      <button className="btn btn-whatsapp btn-block dq-send" disabled={enviarDisabled} onClick={enviarWhatsapp}>
        {busy ? 'Cotizando…' : (yaEnviado ? 'Ya cotizado' : 'Cotizar por WhatsApp')}
      </button>
      {bloqueo && lines.length > 0 && (
        <p className="dq-bloqueo" role="status">
          {bloqueo.texto}{' '}
          {bloqueo.motivo === 'direccion'
            ? <Link to="/direcciones/nuevo">{bloqueo.accion}</Link>
            : 'Tocá "Elegir" en el producto que lo tenga.'}
        </p>
      )}
      {enVentana && server && !yaEnviado && (
        <button type="button" className="btn btn-ghost btn-block dq-continuar" onClick={continuarEnRubro}>
          Continuar en el rubro
        </button>
      )}
    </>
  ) : (
    <p className="dq-aviso hoja" role="status">
      {nombreRubro(idrubro!)} no está disponible por ahora, así que este Quodom no se puede enviar.
      Tus productos quedan guardados acá por si el rubro vuelve.
    </p>
  );

  if (enVentana) {
    return (
      <div className="vq-backdrop" onClick={onCerrar}>
        <section
          className="vq card hoja"
          role="dialog"
          aria-modal="true"
          aria-label={descripcion || 'Quodom'}
          onClick={e => e.stopPropagation()}
        >
          <header className="vq-cab">
            <div className="vq-cab-texto">
              {rubroDelQuodom && (
                <p className="vq-rubro">
                  {rubroDelQuodom}
                  {yaEnviado && <span className="vq-estado">Enviado</span>}
                </p>
              )}
              {server && campoDelNombre}
            </div>
            <button type="button" className="vq-cerrar" aria-label="Cerrar" onClick={onCerrar}>×</button>
          </header>
          <div className="vq-cuerpo">{cuerpo}</div>
          {server && <footer className="vq-pie">{pie}</footer>}
        </section>
      </div>
    );
  }

  return (
    <>
      <AppBarBack title={rubroDelQuodom || 'Mi Quodom'} />
      <section className="container detalle-quodom">
        {cuerpo}
        <div className="dq-pie-pagina">{pie}</div>
      </section>
    </>
  );
}
