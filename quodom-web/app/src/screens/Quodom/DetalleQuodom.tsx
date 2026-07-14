import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import {
  clearGuestQuodom, getGuestQuodom, removeGuestLine, setGuestDescripcion,
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
import { openWhatsappLink } from '../../utils/whatsapp';
import { migrateGuestQuodom } from '../../guest/migrateGuestQuodom';
import './DetalleQuodom.css';

type Mode = 'guest' | 'server';

export function DetalleQuodom() {
  const [sp] = useSearchParams();
  const id = sp.get('id');
  const { user } = useAuth();
  const navigate = useNavigate();
  const mode: Mode = id ? 'server' : 'guest';

  const [descripcion, setDescripcion] = useState<string>('');
  const [server, setServer] = useState<{ quodom: Quodom; lines: QuodomLine[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attr, setAttr] = useState<{ lineIndex?: number; lineId?: number; idproducto: number; nombreatributo: string; slot: 1 | 2; actual: string | null | undefined } | null>(null);
  const [nonce, setNonce] = useState(0);

  const guest = useMemo(() => getGuestQuodom(), [nonce]);

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
    if (mode === 'guest') { setGuestDescripcion(value); }
    else if (server) { try { await quodomApi.update(server.quodom.id, { descripcion: value.trim() || 'Mi Quodom' }); } catch {} }
  }, [mode, server]);

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

  async function enviarWhatsapp() {
    if (mode === 'guest') {
      if (!user) { navigate('/login', { state: { from: '/quodom' } }); return; }
      setBusy(true);
      try {
        const newId = await migrateGuestQuodom();
        if (!newId) { setErr('No hay productos en el Quodom.'); return; }
        const r = await quodomApi.whatsapp(newId);
        openWhatsappLink(r.link);
        clearGuestQuodom();
        navigate('/mis-quodoms', { replace: true });
      } catch (e) { setErr(e instanceof ApiError ? e.message : 'No se pudo enviar.'); }
      finally { setBusy(false); }
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
        onCantidad: (c: number) => { updateGuestLineCantidad(idx, c); setNonce(n => n + 1); window.dispatchEvent(new Event('quodom:changed')); },
        onRemove: () => { removeGuestLine(idx); setNonce(n => n + 1); window.dispatchEvent(new Event('quodom:changed')); },
        onAttr: (slot: 1 | 2, valor: string) => { updateGuestLineAtributos(idx, slot === 1 ? { atributo1: valor } : { atributo2: valor }); setNonce(n => n + 1); }
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

  const enviarDisabled = busy || lines.length === 0 || (mode === 'server' && server?.quodom.estado === 'ENVIADO');

  return (
    <>
      <AppBarBack title={mode === 'server' ? (server?.quodom.nro ?? 'Quodom') : 'Mi Quodom'} />
      <section className="container detalle-quodom">
        {err && <ErrorState message={err} onRetry={() => setNonce(n => n + 1)} />}
        {mode === 'server' && !server && !err && <Loader />}

        <label className="field"><span>Descripción</span>
          <input className="input" value={descripcion} onChange={e => setDescripcion(e.target.value)} onBlur={() => saveDescripcion(descripcion)} />
        </label>

        {lines.length === 0 && <p className="dq-empty">Tu Quodom está vacío. Sumá productos desde Inicio o Buscar.</p>}

        <ul className="dq-lines">
          {lines.map(l => (
            <li key={l.key} className="dq-line card hoja">
              <div className="dq-line-head">
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

        <button className="btn btn-exito btn-block dq-send" disabled={enviarDisabled} onClick={enviarWhatsapp}>
          {busy ? 'Enviando…' : (mode === 'server' && server?.quodom.estado === 'ENVIADO' ? 'Ya enviado' : 'Enviar por WhatsApp')}
        </button>

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
      </section>
    </>
  );
}
