import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { categorias } from '../../api/categorias';
import type { Category } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { RubroSelector } from './RubroSelector';
import { SubcategoriaTabs } from './SubcategoriaTabs';
import { ListaProductos } from './ListaProductos';
import { PestanasIA, type ModoIa } from './PestanasIA';
import { PanelConversacion } from '../ModoIA/PanelConversacion';
import { PanelLista } from '../ListaIA/PanelLista';
import './SitioInicial.css';

// Devuelve el número del param o null: "", "abc" y "0" son todos "sin valor".
function numParam(valor: string | null): number | null {
  const n = Number(valor);
  return valor && Number.isInteger(n) && n > 0 ? n : null;
}

export function SitioInicial() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [modoIa, setModoIa] = useState<ModoIa | null>(null);
  const rubroParam = numParam(params.get('rubro'));
  const subParam = numParam(params.get('sub'));

  const [rubros, setRubros] = useState<Category[] | null>(null);
  const [subs, setSubs] = useState<Category[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [errSubs, setErrSubs] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [nonceSubs, setNonceSubs] = useState(0);

  useEffect(() => {
    let alive = true;
    setRubros(null); setErr(null);
    categorias.raiz()
      .then(d => { if (alive) setRubros(d); })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error al cargar categorías.'); });
    return () => { alive = false; };
  }, [nonce]);

  // Un rubro que no está habilitado (link viejo, URL a mano, rubro apagado en
  // api/src/config/rubros.js) degrada al home, no muestra un error.
  const rubroValido = rubros !== null && rubroParam !== null && rubros.some(r => r.id === rubroParam);
  useEffect(() => {
    if (rubros !== null && rubroParam !== null && !rubroValido) setParams({}, { replace: true });
  }, [rubros, rubroParam, rubroValido, setParams]);

  const idrubro = rubroValido ? rubroParam : null;

  useEffect(() => {
    if (idrubro === null) { setSubs(null); setErrSubs(null); return; }
    let alive = true;
    setSubs(null); setErrSubs(null);
    categorias.subs(idrubro)
      .then(d => { if (alive) setSubs(d); })
      .catch(e => { if (alive) setErrSubs(e instanceof ApiError ? e.message : 'Error al cargar subcategorías.'); });
    return () => { alive = false; };
  }, [idrubro, nonceSubs]);

  // Normalización: llegar con ?rubro= sin sub, o con una sub de otro rubro,
  // abre la primera. `replace` para no dejar una entrada intermedia que haga
  // que el Atrás parezca no hacer nada.
  const subValida = subs !== null && subParam !== null && subs.some(s => s.id === subParam);
  useEffect(() => {
    if (idrubro === null || subs === null || subs.length === 0 || subValida) return;
    setParams({ rubro: String(idrubro), sub: String(subs[0].id) }, { replace: true });
  }, [idrubro, subs, subValida, setParams]);

  const idsub = subValida ? subParam : null;

  // Un ?rubro= puede volver sin remount (botón Atrás entre entradas de
  // historial que matchean la misma ruta): sin este derivado el panel
  // quedaría abierto con las pestañas y el catálogo ocultos, sin forma de
  // cerrarlo.
  const modo = idrubro === null ? modoIa : null;

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term.length < 2) return;
    navigate('/busqueda?q=' + encodeURIComponent(term));
  }

  if (err) return <div className="container"><ErrorState message={err} onRetry={() => setNonce(n => n + 1)} /></div>;

  return (
    <section className={'container home-inicial' + (idrubro !== null ? ' home-compacto' : '')}>
      {idrubro === null && modoIa === null && <h1 className="home-wordmark">QUODOM</h1>}

      {/* El buscador queda fuera del bloque que se oculta: con un rubro
          elegido sigue siendo la salida más rápida a otra cosa, y verlo
          desaparecer al entrar a un rubro se lee como que se perdió. */}
      <form className="home-search" onSubmit={onSearch} role="search">
        <span className="home-search-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        </span>
        <input className="input home-search-input" type="search" placeholder="¿Qué necesitás?" aria-label="Buscar productos" value={q} onChange={e => setQ(e.target.value)} />
      </form>

      {idrubro === null && <PestanasIA activo={modoIa} onElegir={setModoIa} />}

      {modo === 'chat' && <PanelConversacion />}
      {modo === 'lista' && <PanelLista />}

      {modo === null && (
        <>
          {!rubros ? <Loader /> : <RubroSelector rubros={rubros} idSeleccionado={idrubro} />}

          {idrubro !== null && errSubs && (
            <ErrorState message={errSubs} onRetry={() => setNonceSubs(n => n + 1)} />
          )}
          {idrubro !== null && !errSubs && !subs && <Loader />}
          {idrubro !== null && subs && subs.length > 0 && (
            <SubcategoriaTabs idrubro={idrubro} subs={subs} idSeleccionada={idsub} />
          )}
          {idrubro !== null && subs && subs.length === 0 && (
            <p className="prods-empty">Este rubro todavía no tiene subcategorías.</p>
          )}

          {idsub !== null && <ListaProductos idsubcategoria={idsub} />}
        </>
      )}
    </section>
  );
}
