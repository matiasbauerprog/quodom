import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { categorias } from '../../api/categorias';
import type { Category } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { AppBarBack } from '../../components/layout/AppBarBack';
import { RubroIcon } from '../../components/icons/RubroIcon';
import './SubcategoriaLista.css';

export function SubcategoriaLista() {
  const { id = '' } = useParams();
  const idPadre = Number(id);
  const [subs, setSubs] = useState<Category[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setSubs(null); setErr(null);
    categorias.subs(idPadre)
      .then(d => { if (alive) setSubs(d); })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error.'); });
    return () => { alive = false; };
  }, [idPadre, nonce]);
  return (
    <>
      <AppBarBack title="Subcategorías" />
      <section className="container subcat">
        {err && <ErrorState message={err} onRetry={() => setNonce(n => n + 1)} />}
        {!err && !subs && <Loader />}
        {subs && (
          <div className="subcat-grid">
            {subs.map(s => (
              <Link key={s.id} to={'/subcategoria/' + s.id} className="subcat-card">
                <RubroIcon id={idPadre} size={56} />
                <span className="subcat-card-name">{s.nombrecategoria}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
