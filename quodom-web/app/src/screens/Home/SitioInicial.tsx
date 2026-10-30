import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { conVentana } from '../../quodom/ventanaQuodom';
import { categorias } from '../../api/categorias';
import { busqueda as busquedaApi } from '../../api/busqueda';
import type { Category, BusquedaResult } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { ProductImage } from '../../components/ProductImage';
import { useAgregarProducto } from '../../quodom/useAgregarProducto';
import { DialogoDestino } from '../../quodom/DialogoDestino';
import { nombreRubro } from '../../quodom/rubros';
import { RubroSelector } from './RubroSelector';
import { SubcategoriaTabs, SubcategoriaTabsEsqueleto } from './SubcategoriaTabs';
import { ListaProductos } from './ListaProductos';
import type { ModoIa } from './PestanasIA';
import { PanelConversacion } from '../ModoIA/PanelConversacion';
// import { PanelLista } from '../ListaIA/PanelLista';
import { Logo } from '../../components/Logo';
import { intencionIa } from './intencionIa';
import { OfrecerModoIa, useAbrirModoIa, type EstadoPreguntaIa } from './OfrecerModoIa';
import './SitioInicial.css';

// Devuelve el número del param o null: "", "abc" y "0" son todos "sin valor".
function numParam(valor: string | null): number | null {
  const n = Number(valor);
  return valor && Number.isInteger(n) && n > 0 ? n : null;
}

export function SitioInicial() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [q, setQ] = useState('');
  // El chat vive en la URL y no en estado del componente. Si vive en memoria,
  // la barra de arriba no puede saber que está abierto, y como el wordmark
  // grande se esconde al abrirlo el usuario quedaba sin logo y sin forma de
  // volver al inicio. De paso el botón Atrás lo cierra, igual que sale de un
  // rubro, y el chat queda enlazable.
  const modoIa: ModoIa | null = params.get('ia') === 'chat' ? 'chat' : null;
  const [sugerencias, setSugerencias] = useState<BusquedaResult[] | null>(null);
  // Lo que se escribió en el buscador cuando se eligió preguntarle al
  // asistente: el chat arranca con eso en vez de vacío. Llega en el estado de
  // la navegación (useAbrirModoIa, también desde la pantalla de búsqueda) y se
  // pasa acá para sacarlo del historial: si quedara, Atrás y Adelante lo
  // volverían a mandar. El primer render ya lo lee de la navegación, que es
  // cuando el chat se monta.
  const [preguntaIa, setPreguntaIa] = useState<string | undefined>(undefined);
  const preguntaDeRuta = (location.state as EstadoPreguntaIa | null)?.preguntaIa;
  const abrirConPregunta = useAbrirModoIa();
  useEffect(() => {
    if (!preguntaDeRuta) return;
    setPreguntaIa(preguntaDeRuta);
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
  }, [preguntaDeRuta, navigate, location.pathname, location.search]);
  // Nombre del último producto agregado desde el buscador: sin este acuse,
  // tocar un resultado no se ve por ningún lado.
  const [agregado, setAgregado] = useState<string | null>(null);
  const {
    agregar: agregarLinea, agregando, error: errAgregar, destino, elegir, crear, cancelar
  } = useAgregarProducto();
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
    if (rubros !== null && rubroParam !== null && !rubroValido) {
      setParams(p => conVentana({}, p), { replace: true, state: location.state });
    }
  }, [rubros, rubroParam, rubroValido, setParams, location.state]);

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
    // La ventana del Quodom (y su estado) sobreviven: si no, abrirla sobre un
    // rubro la cerraba en el acto.
    setParams(p => conVentana({ rubro: String(idrubro), sub: String(subs[0].id) }, p), { replace: true, state: location.state });
  }, [idrubro, subs, subValida, setParams, location.state]);

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
    // Un pedido con Enter va directo al asistente: un tester escribió
    // "pintar", apretó Enter y terminó en una lista de productos (2026-10-30).
    // Sin los resultados todavía (Enter antes de que contesten) no se cuenta
    // "ninguno" como señal.
    if (intencionIa(term, sugerencias?.length ?? 1) === 'pedido') {
      setQ('');
      abrirConPregunta(term);
      return;
    }
    navigate('/busqueda?q=' + encodeURIComponent(term));
  }

  // El acuse es un aviso de que algo pasó, no un estado: sin esto se quedaba
  // colgado en pantalla para siempre, y a la tercera búsqueda ya no se sabía a
  // qué producto se refería.
  useEffect(() => {
    if (!agregado) return;
    const t = setTimeout(() => setAgregado(null), 4000);
    return () => clearTimeout(t);
  }, [agregado]);

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
  // Abrirlo saca el rubro de la URL: son excluyentes, y desde un rubro el
  // botón hace las dos cosas de una (salir y abrir la conversación).
  function abrirModoIa() {
    setPreguntaIa(undefined);
    setParams(modo === 'chat' ? {} : { ia: 'chat' });
  }

  // Quienes probaron la app escribieron acá lo que hay que escribirle al
  // asistente (2026-10-29): el desplegable lo ofrece, y abrirlo lleva el texto.
  function preguntarAlAsistente() {
    const texto = q.trim();
    setSugerencias(null);
    setQ('');
    abrirConPregunta(texto);
  }

  // Tocar un resultado agrega el producto y deja al usuario donde estaba. Antes
  // llevaba a la pantalla de búsqueda, o sea a buscar de nuevo lo que ya había
  // encontrado para recién ahí poder agregarlo.
  //
  // Va por el mismo camino que cualquier otro "+": el Quodom abierto del rubro
  // lo recibe sin preguntar, y si no hay ninguno el hook abre el diálogo de
  // destino. Un rubro admite varios Quodoms, así que no hay conflicto que
  // resolver acá.
  // Cancelar el diálogo de destino es no haber agregado nada: el acuse que
  // se anticipó al tocar el resultado ya no es verdad.
  function cancelarDestino() {
    setAgregado(null);
    cancelar();
  }

  function elegirSugerencia(r: BusquedaResult) {
    setSugerencias(null);
    setQ('');
    setAgregado(r.nombre);
    agregarLinea({ idproducto: r.id, nombreProducto: r.nombre, cantidad: 1 }, r.categoriaPadre);
  }

  if (err) return <div className="container"><ErrorState message={err} onRetry={() => setNonce(n => n + 1)} /></div>;

  return (
    <section className={'container home-inicial' + (idrubro !== null ? ' home-compacto' : '')}>
      {idrubro === null && modoIa === null && (
        <hgroup className="home-marca">
          <h1 className="home-wordmark"><Logo /></h1>
          <p className="home-claim">Cotizá todo junto, en un sólo lugar.</p>
        </hgroup>
      )}

      {/* Con un rubro elegido el buscador se queda: sigue siendo la salida más
          rápida a otra cosa, y verlo desaparecer al entrar a un rubro se lee
          como que se perdió. Dentro de la conversación no: ahí lo que se busca
          se pide escribiéndolo, y el campo queda sin nada a qué responder. */}
      {modo !== 'chat' && (
      <form className="home-search" onSubmit={onSearch} role="search">
        <span className="home-search-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        </span>
        <input className="input home-search-input" type="search" placeholder="¿Qué necesitás?" aria-label="Buscar productos" value={q} onChange={e => setQ(e.target.value)} />

        {sugerencias !== null && (() => {
          // Siempre está; lo que cambia es dónde y cuánto se nota. Un pedido
          // ("quiero pintar mi casa") lo pone primero y destacado; el nombre
          // de un producto, discreto y al final, para no taparle los resultados.
          const pedido = intencionIa(q, sugerencias.length) === 'pedido';
          const ofrecerIa = <OfrecerModoIa texto={q} destacada={pedido} onClick={preguntarAlAsistente} />;
          return (
          <div className="home-sugerencias card hoja" role="listbox" aria-label="Sugerencias">
            {pedido && ofrecerIa}
            {/* Con el asistente destacado arriba, "sin resultados" sobra: la
                respuesta a eso es el botón. */}
            {sugerencias.length === 0
              ? !pedido && <p className="home-sugerencias-vacio">Sin resultados para "{q.trim()}".</p>
              : sugerencias.slice(0, 8).map(s => (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="home-sugerencia"
                  disabled={agregando}
                  onClick={() => elegirSugerencia(s)}
                >
                  <ProductImage idproducto={s.id} alt={s.nombre} size="sm" />
                  <span className="home-sugerencia-nombre">{s.nombre}</span>
                  {/* Aparece al pasar el mouse o al llegar con el teclado: sin
                      esto, una fila de resultados no dice qué va a pasar si la
                      tocás. */}
                  <span className="home-sugerencia-accion" aria-hidden="true">+ Agregar</span>
                </button>
              ))}
            {!pedido && ofrecerIa}
          </div>
          );
        })()}
      </form>
      )}

      {/* Mientras el diálogo de destino pregunta todavía no se agregó nada. */}
      {agregado && !destino && !errAgregar && <p className="home-agregado" role="status">Agregado ✓ {agregado}</p>}
      {errAgregar && !destino && <p className="home-agregar-error" role="alert">{errAgregar}</p>}

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

      {modo === 'chat' && <PanelConversacion preguntaInicial={preguntaIa ?? preguntaDeRuta} />}

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
          {idrubro !== null && !errSubs && !subs && <SubcategoriaTabsEsqueleto />}
          {idrubro !== null && subs && subs.length > 0 && (
            <SubcategoriaTabs idrubro={idrubro} subs={subs} idSeleccionada={idsub} />
          )}
          {idrubro !== null && subs && subs.length === 0 && (
            <p className="prods-empty">Este rubro todavía no tiene subcategorías.</p>
          )}

          {idsub !== null && <ListaProductos idsubcategoria={idsub} />}
        </>
      )}

      {destino && (
        <DialogoDestino
        nombreRubro={nombreRubro(destino.idrubro)}
        candidatos={destino.candidatos}
        onElegir={elegir}
        onCrear={crear}
          onCancelar={cancelarDestino}
          ocupado={agregando}
          error={errAgregar}
        />
      )}
    </section>
  );
}
