import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { categorias } from '../../api/categorias';
import type { Category } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { RubroIcon } from '../../components/icons/RubroIcon';
import { MasBuscados } from './MasBuscados';
import { useAuth } from '../../auth/AuthContext';
import './SitioInicial.css';

export function SitioInicial() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cats, setCats] = useState<Category[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    setCats(null); setErr(null);
    categorias.raiz()
      .then(d => { if (alive) setCats(d); })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error al cargar categorías.'); });
    return () => { alive = false; };
  }, [nonce]);

  function goModoIA() {
    if (!user) {
      navigate('/login', { state: { from: '/modo-ia' } });
      return;
    }
    navigate('/modo-ia');
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term.length < 2) return;
    navigate('/busqueda?q=' + encodeURIComponent(term));
  }

  if (err) return <div className="container"><ErrorState message={err} onRetry={() => setNonce(n => n + 1)} /></div>;

  return (
    <section className="container home-inicial">
      <h1 className="home-wordmark">QUODOM</h1>
      <button type="button" className="btn home-modo-ia" onClick={goModoIA}>
        <span aria-hidden="true">🤖</span>
        <span>Modo IA — armá tu Quodom conversando</span>
      </button>
      <form className="home-search" onSubmit={onSearch}>
        <span className="home-search-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        </span>
        <input className="input home-search-input" type="search" placeholder="¿Qué necesitás?" value={q} onChange={e => setQ(e.target.value)} />
      </form>
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
      <MasBuscados />
    </section>
  );
}
