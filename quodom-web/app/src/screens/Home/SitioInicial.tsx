import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { categorias } from '../../api/categorias';
import type { Category } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { RubroIcon } from '../../components/icons/RubroIcon';
import './SitioInicial.css';

export function SitioInicial() {
  const [cats, setCats] = useState<Category[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setCats(null); setErr(null);
    categorias.raiz()
      .then(d => { if (alive) setCats(d); })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error al cargar categorías.'); });
    return () => { alive = false; };
  }, [nonce]);

  if (err) return <div className="container"><ErrorState message={err} onRetry={() => setNonce(n => n + 1)} /></div>;

  return (
    <section className="container home-inicial">
      <h1 className="home-wordmark">QUODOM</h1>
      <Link to="/modo-ia" className="btn home-modo-ia">
        Modo IA — armá tu Quodom conversando
      </Link>
      {!cats ? <Loader /> : (
        <div className="cat-grid">
          {cats.map(c => (
            <Link key={c.id} to={'/categoria/' + c.id} className="cat-card">
              <RubroIcon id={c.id} size={72} />
              <span className="cat-card-name">{c.nombrecategoria}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
