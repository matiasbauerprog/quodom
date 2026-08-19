import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { openWhatsappLink } from '../../utils/whatsapp';
import { migrarRubro } from '../../guest/migrateGuestQuodom';
import type { AccionRubro, ConflictoRubro } from '../../guest/migrateGuestQuodom';
import { DialogoConflictoRubro } from '../../guest/DialogoConflictoRubro';
import { nombreRubro } from '../../quodom/rubros';
import { rubroDisponible } from '../../quodom/rubrosDisponibles';
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

export function DetalleQuodom() {
  const [sp] = useSearchParams();
  const id = sp.get('id');
  const idrubro = parseIdrubro(sp.get('rubro'));
  const { user } = useAuth();
  const navigate = useNavigate();
  const mode: Mode = id ? 'server' : 'guest';

  const [descripcion, setDescripcion] = useState<string>('');
  const [server, setServer] = useState<{ quodom: Quodom; lines: QuodomLine[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [conflicto, setConflicto] = useState<ConflictoRubro | null>(null);
  const [attr, setAttr] = useState<{ lineIndex?: number; lineId?: number; idproducto: number; nombreatributo: string; slot: 1 | 2; actual: string | null | undefined } | null>(null);
  const [nonce, setNonce] = useState(0);
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
  // one exists.
  useEffect(() => {
    if (mode !== 'guest' || idrubro === null || !user || guest.lines.length > 0) return;
    let alive = true;
    quodomApi.activoPorRubro(idrubro)
      .then(activo => {
        if (alive && activo) navigate('/quodom?id=' + encodeURIComponent(activo.id), { replace: true });
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
      })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error al cargar el Quodom.'); });
    return () => { alive = false; };
  }, [mode, id, nonce, guest.descripcion]);

  const saveDescripcion = useCallback(async (value: string) => {
    if (mode === 'guest') { if (idrubro !== null) setGuestDescripcion(idrubro, value); }
    else if (server) { try { await quodomApi.update(server.quodom.id, { descripcion: value.trim() || 'Mi Quodom' }); } catch {} }
  }, [mode, idrubro, server]);

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
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'No se pudo actualizar el atributo.'); }
  }

  // Migrates just this rubro's guest cart and sends it. Called either
  // directly (no conflicting server Quodom for this rubro) or after the
  // user resolves DialogoConflictoRubro. The cart is only cleared by
  // migrarRubro once every line is confirmed on the server, so a failure
  // here always leaves the guest cart intact to retry.
  const enviarGuestConAccion = useCallback(async (rubro: number, accion: AccionRubro) => {
    setBusy(true);
    setErr(null);
    try {
      const idquodom = await migrarRubro(rubro, accion);
      if (!idquodom) { setErr('No hay productos en el Quodom.'); return; }
      const r = await quodomApi.whatsapp(idquodom);
      openWhatsappLink(r.link);
      setConflicto(null);
      navigate('/mis-quodoms', { replace: true });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'No se pudo enviar.');
    } finally {
      setBusy(false);
    }
  }, [navigate]);

  async function enviarWhatsapp() {
    if (mode === 'guest') {
      if (idrubro === null) return;
      if (!user) { navigate('/login', { state: { from: '/quodom?rubro=' + idrubro } }); return; }
      setBusy(true);
      try {
        const existente = await quodomApi.activoPorRubro(idrubro);
        if (existente) {
          setConflicto({ idrubro, quodomExistente: existente, lineasInvitado: guest.lines.length });
          setBusy(false);
          return;
        }
        await enviarGuestConAccion(idrubro, 'crear');
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : 'No se pudo enviar.');
        setBusy(false);
      }
      return;
    }
    if (!server) return;
    setBusy(true);
    try {
      const r = await quodomApi.whatsapp(server.quodom.id);
      openWhatsappLink(r.link);
      setNonce(n => n + 1);
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'No se pudo enviar.'); }
    finally { setBusy(false); }
  }

  const lines = mode === 'guest'
    ? guest.lines.map((l, idx) => ({
        key: 'g-' + idx, cantidad: l.cantidad, nombreProducto: l.nombreProducto,
        atributo1: l.atributo1, atributo2: l.atributo2,
        nombreAtributo1: l.nombreAtributo1, nombreAtributo2: l.nombreAtributo2,
        idproducto: l.idproducto,
        onCantidad: (c: number) => { if (idrubro !== null) updateGuestLineCantidad(idrubro, idx, c); setNonce(n => n + 1); window.dispatchEvent(new Event('quodom:changed')); },
        onRemove: () => { if (idrubro !== null) removeGuestLine(idrubro, idx); setNonce(n => n + 1); window.dispatchEvent(new Event('quodom:changed')); },
        onAttr: (slot: 1 | 2, valor: string) => { if (idrubro !== null) updateGuestLineAtributos(idrubro, idx, slot === 1 ? { atributo1: valor } : { atributo2: valor }); setNonce(n => n + 1); }
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

  const enviarDisabled = busy || lines.length === 0 || (mode === 'server' && server?.quodom.estado === 'ENVIADO');

  return (
    <>
      <AppBarBack title={mode === 'server' ? (server?.quodom.nro ?? 'Quodom') : (idrubro !== null ? nombreRubro(idrubro) : 'Mi Quodom')} />
      <section className="container detalle-quodom">
        {err && <ErrorState message={err} onRetry={() => setNonce(n => n + 1)} />}
        {mode === 'server' && !server && !err && <Loader />}

        <label className="field"><span>Descripción</span>
          <input className="input" value={descripcion} onChange={e => setDescripcion(e.target.value)} onBlur={() => saveDescripcion(descripcion)} />
        </label>

        {lines.length === 0 && <p className="dq-empty">Tu Quodom está vacío. Sumá productos desde Inicio.</p>}

        <ul className="dq-lines">
          {lines.map(l => (
            <li key={l.key} className="dq-line card hoja">
              <div className="dq-line-head">
                <ProductImage idproducto={l.idproducto} alt={l.nombreProducto} size="sm" />
                <span className="dq-line-name">{l.nombreProducto}</span>
                <button className="dq-line-remove" aria-label="Quitar" onClick={l.onRemove}>×</button>
              </div>
              <div className="dq-line-qty">
                <button className="btn btn-ghost dq-qty-btn" onClick={() => l.onCantidad(Math.max(0, l.cantidad - 1))} aria-label="Restar">−</button>
                <input className="input dq-qty-input" type="number" min={1} value={l.cantidad} onChange={e => l.onCantidad(Math.max(1, Number(e.target.value) || 1))} />
                <button className="btn btn-ghost dq-qty-btn" onClick={() => l.onCantidad(l.cantidad + 1)} aria-label="Sumar">+</button>
              </div>
              {l.nombreAtributo1 && (
                <button className="dq-attr" onClick={() => setAttr({ lineIndex: mode === 'guest' ? Number(l.key.slice(2)) : undefined, lineId: mode === 'server' ? Number(l.key.slice(2)) : undefined, idproducto: l.idproducto, nombreatributo: l.nombreAtributo1!, slot: 1, actual: l.atributo1 })}>
                  <span>{l.nombreAtributo1}:</span> <strong>{l.atributo1 ?? 'Elegir'}</strong>
                </button>
              )}
              {l.nombreAtributo2 && (
                <button className="dq-attr" onClick={() => setAttr({ lineIndex: mode === 'guest' ? Number(l.key.slice(2)) : undefined, lineId: mode === 'server' ? Number(l.key.slice(2)) : undefined, idproducto: l.idproducto, nombreatributo: l.nombreAtributo2!, slot: 2, actual: l.atributo2 })}>
                  <span>{l.nombreAtributo2}:</span> <strong>{l.atributo2 ?? 'Elegir'}</strong>
                </button>
              )}
            </li>
          ))}
        </ul>

        {rubroHabilitado ? (
          <button className="btn btn-exito btn-block dq-send" disabled={enviarDisabled} onClick={enviarWhatsapp}>
            {busy ? 'Enviando…' : (mode === 'server' && server?.quodom.estado === 'ENVIADO' ? 'Ya enviado' : 'Enviar por WhatsApp')}
          </button>
        ) : (
          <p className="dq-aviso hoja" role="status">
            {nombreRubro(idrubro!)} no está disponible por ahora, así que este Quodom no se puede enviar.
            Tus productos quedan guardados acá por si el rubro vuelve.
          </p>
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

        {conflicto && (
          <DialogoConflictoRubro
            conflicto={conflicto}
            ocupado={busy}
            // Acá el usuario abrió el diálogo a propósito, al mandar por
            // WhatsApp: cancelar lo devuelve a su carrito sin ensuciar nada.
            permitirCancelar
            onElegir={accion => {
              if (!accion) { setConflicto(null); return; }
              enviarGuestConAccion(conflicto.idrubro, accion);
            }}
          />
        )}
      </section>
    </>
  );
}
