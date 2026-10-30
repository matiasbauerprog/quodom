import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { busqueda } from '../../api/busqueda';
import { historial } from '../../api/hist_busquedas';
import type { BusquedaResult } from '../../api/types';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useAgregarProducto } from '../../quodom/useAgregarProducto';
import { DialogoDestino } from '../../quodom/DialogoDestino';
import { nombreRubro } from '../../quodom/rubros';
import { Loader } from '../../components/Loader';
import { ProductImage } from '../../components/ProductImage';
import { IconoMas } from '../../components/icons/IconoMas';
import { intencionIa } from './intencionIa';
import { OfrecerModoIa, useAbrirModoIa } from './OfrecerModoIa';
import './BusquedaScreen.css';

export function BusquedaScreen() {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const initial = sp.get('q') ?? '';
  const [q, setQ] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<BusquedaResult[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hist, setHist] = useState<string[]>([]);
  const { agregar: agregarLinea, agregando, error: errAgregar, destino, elegir, pedirDestino, crear, cancelar } = useAgregarProducto();
  const abrirModoIa = useAbrirModoIa();

  useEffect(() => {
    if (!user) return;
    historial.list()
      .then(h => setHist(h.slice(0, 10).map(x => x.valor)))
      .catch(() => {});
  }, [user]);

  const runSearch = useCallback(async (term: string) => {
    setErr(null); setBusy(true);
    try {
      const r = await busqueda.buscar(term);
      setResults(r);
      if (user) { historial.add(term).catch(() => {}); setHist(prev => [term, ...prev.filter(x => x !== term)].slice(0, 10)); }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Error de búsqueda.');
    } finally { setBusy(false); }
  }, [user]);

  useEffect(() => {
    const term = (sp.get('q') ?? '').trim();
    if (term.length >= 2) { setQ(term); runSearch(term); }
  }, [sp, runSearch]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term.length < 2) return;
    setSp({ q: term }, { replace: true });
    runSearch(term);
  }

  const pedido = !!results && intencionIa(q, results.length) === 'pedido';
  const ofrecerIa = !busy && results
    ? <OfrecerModoIa texto={q} destacada={pedido} onClick={() => abrirModoIa(q)} />
    : null;

  function agregar(r: BusquedaResult) {
    agregarLinea({ idproducto: r.id, nombreProducto: r.nombre, cantidad: 1 }, r.categoriaPadre);
  }

  function agregarEnOtro(r: BusquedaResult) {
    pedirDestino({ idproducto: r.id, nombreProducto: r.nombre, cantidad: 1 }, r.categoriaPadre);
  }

  // Acá el resultado no trae descripción ni atributos: la ficha es la imagen y
  // el nombre, que es lo que confirma que se manda lo que se tocó.
  function fichaDelDestino() {
    if (!destino || destino.items.length !== 1) return null;
    const idproducto = destino.items[0].line.idproducto;
    const r = results?.find(x => x.id === idproducto);
    return r ? { id: r.id, nombre: r.nombre } : null;
  }

  return (
    <section className="container busqueda">
      <h1>Buscar productos</h1>
      <form className="busqueda-form" onSubmit={onSubmit}>
        <input className="input" placeholder="Ej: pintura, latex, cemento…" value={q} onChange={e => setQ(e.target.value)} />
        <button className="btn" disabled={busy || q.trim().length < 2}>{busy ? 'Buscando…' : 'Buscar'}</button>
      </form>

      {err && <p className="auth-error">{err}</p>}
      {errAgregar && <p className="auth-error" role="alert">{errAgregar}</p>}
      {busy && <Loader />}

      {/* Lo mismo que el desplegable del inicio: a esta pantalla se llega con
          Enter, y ahí también tiene que estar el asistente. Destacado arriba
          para un pedido, discreto al final para un producto. */}
      {ofrecerIa && pedido && ofrecerIa}

      {!busy && results && (
        results.length === 0
          ? <p className="busqueda-empty">Sin resultados para "{q}".</p>
          : (
            <ul className="busqueda-list">
              {results.map(r => (
                <li key={r.id} className="prod-item prod-item-row">
                  {/* Acá no hay detalle que abrir, así que tocar el resultado
                      lleva directo a elegir el Quodom: el mismo gesto que en el
                      catálogo, con un paso menos porque no hay nada que leer.
                      Sin sesión no es un botón: un invitado no tiene a dónde elegir. */}
                  {user ? (
                    <button
                      className="prod-info"
                      aria-label={'Elegir el Quodom de ' + r.nombre}
                      disabled={agregando}
                      onClick={() => agregarEnOtro(r)}
                    >
                      <ProductImage idproducto={r.id} alt={r.nombre} size="sm" />
                      <span className="prod-name">{r.nombre}</span>
                    </button>
                  ) : (
                    <span className="prod-info">
                      <ProductImage idproducto={r.id} alt={r.nombre} size="sm" />
                      <span className="prod-name">{r.nombre}</span>
                    </span>
                  )}
                  <div className="prod-botones">
                    <button className="prod-add" aria-label={'Agregar ' + r.nombre} disabled={agregando} onClick={() => agregar(r)}>
                      <IconoMas />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
      )}

      {ofrecerIa && !pedido && ofrecerIa}

      {user && hist.length > 0 && !results && (
        <>
          <h3 className="busqueda-hist-title">Búsquedas recientes</h3>
          <ul className="busqueda-hist">
            {hist.map(h => (
              <li key={h}><button className="btn btn-ghost" onClick={() => { setQ(h); }}>{h}</button></li>
            ))}
          </ul>
        </>
      )}

      {destino && (
        <DialogoDestino
        nombreRubro={nombreRubro(destino.idrubro)}
        candidatos={destino.candidatos}
        producto={fichaDelDestino()}
        onElegir={elegir}
        onCrear={crear}
          onCancelar={cancelar}
          ocupado={agregando}
          error={errAgregar}
        />
      )}
    </section>
  );
}
