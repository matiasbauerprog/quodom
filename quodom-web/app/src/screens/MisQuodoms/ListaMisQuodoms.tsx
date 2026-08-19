import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { quodom as quodomApi } from '../../api/quodom';
import type { Quodom } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { QuodomCard } from '../../components/QuodomCard';
import { RUBROS } from '../../quodom/rubros';
import './ListaMisQuodoms.css';

export function ListaMisQuodoms() {
  const navigate = useNavigate();
  const [list, setList] = useState<Quodom[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [eligiendoRubro, setEligiendoRubro] = useState(false);
  const refresh = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    let alive = true;
    setList(null); setErr(null);
    quodomApi.misQuodom()
      .then(d => { if (alive) setList(d); })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error.'); });
    return () => { alive = false; };
  }, [nonce]);

  const rubrosOcupados = new Set((list ?? []).filter(q => q.estado === 'CREADO').map(q => q.idrubro));

  async function crearDeRubro(idrubro: number) {
    try {
      const r = await quodomApi.create({ descripcion: 'Mi Quodom', idrubro });
      setEligiendoRubro(false);
      window.dispatchEvent(new Event('quodom:changed'));
      navigate('/quodom?id=' + encodeURIComponent(r.idquodom));
    } catch (e) {
      setEligiendoRubro(false);
      setErr(e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo crear.');
    }
  }

  return (
    <section className="container mq">
      <div className="mq-header">
        <h1>Mis Quodoms</h1>
        <button className="btn" onClick={() => setEligiendoRubro(true)}>Nuevo</button>
      </div>
      {eligiendoRubro && (
        <section className="mq-rubros" aria-label="Elegí el rubro del Quodom">
          <h2 className="mq-rubros-titulo">¿De qué rubro es el Quodom?</h2>
          <ul className="mq-rubros-list">
            {Object.entries(RUBROS).map(([id, nombre]) => {
              const idrubro = Number(id);
              const ocupado = rubrosOcupados.has(idrubro);
              return (
                <li key={id}>
                  <button
                    type="button"
                    className="btn btn-block"
                    disabled={ocupado}
                    onClick={() => crearDeRubro(idrubro)}
                  >
                    {nombre}{ocupado ? ' — ya tenés uno abierto' : ''}
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn btn-ghost" onClick={() => setEligiendoRubro(false)}>Cancelar</button>
        </section>
      )}
      {!eligiendoRubro && err && <ErrorState message={err} onRetry={refresh} />}
      {!eligiendoRubro && !err && !list && <Loader />}
      {!eligiendoRubro && list && list.length === 0 && (
        <EmptyState title="Todavía no tenés Quodoms" description="Armá uno desde el catálogo o creá uno vacío." />
      )}
      {!eligiendoRubro && list && list.length > 0 && (
        <ul className="mq-list">
          {list.map(q => (
            <li key={q.id} className="mq-item">
              <QuodomCard quodom={q} variant="page" onChange={refresh} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
