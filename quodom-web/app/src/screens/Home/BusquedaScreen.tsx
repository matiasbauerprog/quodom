import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { busqueda } from '../../api/busqueda';
import { historial } from '../../api/hist_busquedas';
import type { BusquedaResult } from '../../api/types';
import { ApiError } from '../../api/client';
import { useAgregarProducto } from '../../quodom/useAgregarProducto';
import { useAuth } from '../../auth/AuthContext';
import { Loader } from '../../components/Loader';
import { ProductImage } from '../../components/ProductImage';
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
  const { agregar: agregarLinea, agregando, error: errAgregar } = useAgregarProducto();

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

  function agregar(r: BusquedaResult) {
    agregarLinea({ idproducto: r.id, nombreProducto: r.nombre, cantidad: 1 });
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

      {!busy && results && (
        results.length === 0
          ? <p className="busqueda-empty">Sin resultados para "{q}".</p>
          : (
            <ul className="busqueda-list">
              {results.map(r => (
                <li key={r.id} className="prod-item card hoja">
                  <ProductImage idproducto={r.id} alt={r.nombre} size="sm" />
                  <span className="prod-name">{r.nombre}</span>
                  <button className="btn btn-exito prod-add" aria-label={'Agregar ' + r.nombre} disabled={agregando} onClick={() => agregar(r)}>+</button>
                </li>
              ))}
            </ul>
          )
      )}

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
    </section>
  );
}
