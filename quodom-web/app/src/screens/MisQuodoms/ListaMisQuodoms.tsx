import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { quodom as quodomApi } from '../../api/quodom';
import type { Quodom } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { QuodomCard } from '../../components/QuodomCard';
import { RUBROS, nombreRubro } from '../../quodom/rubros';
import './ListaMisQuodoms.css';

export function ListaMisQuodoms() {
  const navigate = useNavigate();
  const [list, setList] = useState<Quodom[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [eligiendoRubro, setEligiendoRubro] = useState(false);
  const [creando, setCreando] = useState(false);
  const refresh = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    let alive = true;
    setList(null); setErr(null);
    quodomApi.misQuodom()
      .then(d => { if (alive) setList(d); })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error.'); });
    return () => { alive = false; };
  }, [nonce]);

  useEffect(() => {
    if (!eligiendoRubro) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !creando) setEligiendoRubro(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [eligiendoRubro, creando]);

  const rubrosOcupados = new Set((list ?? []).filter(q => q.estado === 'CREADO').map(q => q.idrubro));

  function cerrarPicker() {
    if (creando) return;
    setEligiendoRubro(false);
  }

  async function crearDeRubro(idrubro: number) {
    setCreando(true);
    try {
      const r = await quodomApi.create({ descripcion: 'Mi Quodom', idrubro });
      setEligiendoRubro(false);
      window.dispatchEvent(new Event('quodom:changed'));
      navigate('/quodom?id=' + encodeURIComponent(r.idquodom));
    } catch (e) {
      setEligiendoRubro(false);
      setErr(e instanceof ApiError ? e.message : 'No se pudo crear.');
    } finally {
      setCreando(false);
    }
  }

  return (
    <section className="container mq">
      <div className="pantalla-header">
        <h1>Mis Quodoms</h1>
        <button className="btn" onClick={() => setEligiendoRubro(true)}>Nuevo</button>
      </div>
      <div className="pantalla-contenido">
      {eligiendoRubro && (
        <div className="mq-rubros-backdrop" onClick={cerrarPicker}>
          <section
            className="mq-rubros card hoja"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mq-rubros-titulo"
            onClick={e => e.stopPropagation()}
          >
            <h2 id="mq-rubros-titulo" className="mq-rubros-titulo">¿De qué rubro es el Quodom?</h2>
            <ul className="mq-rubros-list">
              {Object.entries(RUBROS).map(([id, nombre]) => {
                const idrubro = Number(id);
                const ocupado = rubrosOcupados.has(idrubro);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className="btn btn-block"
                      disabled={ocupado || creando}
                      onClick={() => crearDeRubro(idrubro)}
                    >
                      {nombre}{ocupado ? ' — ya tenés uno abierto' : ''}
                    </button>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="btn btn-ghost" onClick={cerrarPicker} disabled={creando}>Cancelar</button>
          </section>
        </div>
      )}
      {/*
        Both aria-hidden and inert are set deliberately, not redundantly:
        - aria-hidden is what @testing-library/dom's byRole queries actually check
          (see isSubtreeInaccessible), so it keeps this background out of the
          picker's accessible-name queries in tests and for real screen readers.
        - inert is what real browsers use to pull this subtree out of Tab order.
          React 18 has no built-in prop for it (added in React 19), so it is
          passed as the empty-string attribute form, which is what actually
          reaches the DOM under React 18 (inert={true} does not).
      */}
      <div
        className="mq-content"
        aria-hidden={eligiendoRubro || undefined}
        // @ts-expect-error `inert` is a valid global HTML attribute; React 18's types add it only in v19.
        inert={eligiendoRubro ? '' : undefined}
      >
        {err && <ErrorState message={err} onRetry={refresh} />}
        {!err && !list && <Loader />}
        {list && list.length === 0 && (
          <EmptyState title="Todavía no tenés Quodoms" description="Armá uno desde el catálogo o creá uno vacío." />
        )}
        {list && list.length > 0 && (
          <ul className="mq-list">
            {list.map(q => (
              <li key={q.id} className="mq-item">
                <QuodomCard
                  quodom={q}
                  variant="page"
                  rubroLabel={q.nombrerubro || nombreRubro(q.idrubro)}
                  onChange={refresh}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
    </section>
  );
}
