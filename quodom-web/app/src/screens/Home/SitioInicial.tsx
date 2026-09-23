import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { categorias } from '../../api/categorias';
import { busqueda as busquedaApi } from '../../api/busqueda';
import type { Category, BusquedaResult } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { ProductImage } from '../../components/ProductImage';
import { RubroSelector } from './RubroSelector';
import { SubcategoriaTabs } from './SubcategoriaTabs';
import { ListaProductos } from './ListaProductos';
import type { ModoIa } from './PestanasIA';
import { PanelConversacion } from '../ModoIA/PanelConversacion';
// import { PanelLista } from '../ListaIA/PanelLista';
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
  const [sugerencias, setSugerencias] = useState<BusquedaResult[] | null>(null);
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
    setSugerencias(null);
    navigate('/busqueda?q=' + encodeURIComponent(term));
  }

  // Vista previa mientras se escribe. Espera a que el usuario frene para no
  // disparar una consulta por tecla, y descarta las respuestas que llegan
  // tarde: sin el `alive` una búsqueda vieja y lenta pisa a la nueva.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setSugerencias(null); return; }
    let alive = true;
    const t = setTimeout(() => {
      busquedaApi.buscar(term)
        .then(r => { if (alive) setSugerencias(r); })
        .catch(() => { if (alive) setSugerencias(null); });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  // Desde un rubro, el botón hace las dos cosas de una: sale del rubro y abre
  // la conversación. Antes desaparecía acá adentro y había que volver al home
  // a mano para llegar al asistente.
  function abrirModoIa() {
    if (idrubro !== null) {
      setParams({});
      setModoIa('chat');
      return;
    }
    setModoIa(modo === 'chat' ? null : 'chat');
  }

  function elegirSugerencia(nombre: string) {
    setSugerencias(null);
    setQ('');
    navigate('/busqueda?q=' + encodeURIComponent(nombre));
  }

  if (err) return <div className="container"><ErrorState message={err} onRetry={() => setNonce(n => n + 1)} /></div>;

  return (
    <section className={'container home-inicial' + (idrubro !== null ? ' home-compacto' : '')}>
      {idrubro === null && modoIa === null && (
        <hgroup className="home-marca">
          <h1 className="home-wordmark">QUODOM</h1>
          <p className="home-claim">Cotizá todo junto, en un sólo lugar.</p>
        </hgroup>
      )}

      {/* El buscador queda fuera del bloque que se oculta: con un rubro
          elegido sigue siendo la salida más rápida a otra cosa, y verlo
          desaparecer al entrar a un rubro se lee como que se perdió. */}
      <form className="home-search" onSubmit={onSearch} role="search">
        <span className="home-search-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        </span>
        <input className="input home-search-input" type="search" placeholder="¿Qué necesitás?" aria-label="Buscar productos" value={q} onChange={e => setQ(e.target.value)} />

        {sugerencias !== null && (
          <div className="home-sugerencias card hoja" role="listbox" aria-label="Sugerencias">
            {sugerencias.length === 0
              ? <p className="home-sugerencias-vacio">Sin resultados para "{q.trim()}".</p>
              : sugerencias.slice(0, 8).map(s => (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="home-sugerencia"
                  onClick={() => elegirSugerencia(s.nombre)}
                >
                  <ProductImage idproducto={s.id} alt={s.nombre} size="sm" />
                  <span>{s.nombre}</span>
                </button>
              ))}
          </div>
        )}
      </form>

      {/* El botón es también la única forma de cerrar la conversación: la
          pantalla de chat con su flecha de volver ya no existe, así que si
          desapareciera al abrirse el usuario quedaría encerrado adentro. */}
      <button
        type="button"
        className={'btn home-modo-ia' + (modo === 'chat' ? ' home-modo-ia-activo' : '')}
        aria-pressed={modo === 'chat'}
        onClick={abrirModoIa}
      >
        Modo IA — armá tu Quodom conversando
      </button>

      {modo === 'chat' && <PanelConversacion />}

      {/* Subir un archivo está apagado por pedido del usuario (2026-08-23): en
          el home quedó sólo el botón de conversar. Para reactivarlo hay que
          descomentar esta línea, volver a importar PanelLista arriba, y
          reemplazar el botón de acá arriba por <PestanasIA activo={modoIa}
          onElegir={setModoIa} />, que sigue existiendo con sus tests. El resto
          de esa función — el endpoint, el matcheo contra el catálogo, elegir
          entre productos parecidos y sus cuatro componentes — sigue vivo y
          probado; lo único cortado es la entrada. */}
      {/* {modo === 'lista' && <PanelLista />} */}

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
