import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { quodom as quodomApi } from '../../api/quodom';
import type { Quodom } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { QuodomCard } from '../../components/QuodomCard';
import './ListaMisQuodoms.css';

export function ListaMisQuodoms() {
  const navigate = useNavigate();
  const [list, setList] = useState<Quodom[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    let alive = true;
    setList(null); setErr(null);
    quodomApi.misQuodom()
      .then(d => { if (alive) setList(d); })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error.'); });
    return () => { alive = false; };
  }, [nonce]);

  async function crearNuevo() {
    try {
      const r = await quodomApi.create({ descripcion: 'Mi Quodom' });
      navigate('/quodom?id=' + encodeURIComponent(r.idquodom));
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'No se pudo crear.'); }
  }

  return (
    <section className="container mq">
      <div className="mq-header">
        <h1>Mis Quodoms</h1>
        <button className="btn" onClick={crearNuevo}>Nuevo</button>
      </div>
      {err && <ErrorState message={err} onRetry={refresh} />}
      {!err && !list && <Loader />}
      {list && list.length === 0 && (
        <EmptyState title="Todavía no tenés Quodoms" description="Armá uno desde el catálogo o creá uno vacío." />
      )}
      {list && list.length > 0 && (
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
