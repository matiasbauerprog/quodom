import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { categorias } from '../../api/categorias';
import { busqueda as busquedaApi } from '../../api/busqueda';
import type { Category, BusquedaResult, Quodom } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { ProductImage } from '../../components/ProductImage';
import { useAgregarProducto } from '../../quodom/useAgregarProducto';
import { confirmarYAgregar } from '../../quodom/agregarProducto';
import { quodom as quodomApi } from '../../api/quodom';
import { useAuth } from '../../auth/AuthContext';
import { DialogoConflictoRubro } from '../../guest/DialogoConflictoRubro';
import type { AccionRubro } from '../../guest/migrateGuestQuodom';
import { DialogoNuevoRubro } from '../../quodom/DialogoNuevoRubro';
import { nombreRubro } from '../../quodom/rubros';
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
  // El chat vive en la URL y no en estado del componente. Si vive en memoria,
  // la barra de arriba no puede saber que está abierto, y como el wordmark
  // grande se esconde al abrirlo el usuario quedaba sin logo y sin forma de
  // volver al inicio. De paso el botón Atrás lo cierra, igual que sale de un
  // rubro, y el chat queda enlazable.
  const modoIa: ModoIa | null = params.get('ia') === 'chat' ? 'chat' : null;
  const [sugerencias, setSugerencias] = useState<BusquedaResult[] | null>(null);
  // Nombre del último producto agregado desde el buscador: sin este acuse,
  // tocar un resultado no se ve por ningún lado.
  const [agregado, setAgregado] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState<{ producto: BusquedaResult; quodomExistente: Quodom } | null>(null);
  const [errReemplazo, setErrReemplazo] = useState<string | null>(null);
  const { user } = useAuth();
  const {
    agregar: agregarLinea, agregando, error: errAgregar, pendiente, confirmar, cancelar
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
  // Abrirlo saca el rubro de la URL: son excluyentes, y desde un rubro el
  // botón hace las dos cosas de una (salir y abrir la conversación).
  function abrirModoIa() {
    setParams(modo === 'chat' ? {} : { ia: 'chat' });
  }

  const lineaDe = (r: BusquedaResult) => ({ idproducto: r.id, nombreProducto: r.nombre, cantidad: 1 });

  // Tocar un resultado agrega el producto y deja al usuario donde estaba. Antes
  // llevaba a la pantalla de búsqueda, o sea a buscar de nuevo lo que ya había
  // encontrado para recién ahí poder agregarlo.
  //
  // Si el rubro ya tiene un Quodom abierto no se suma solo: se pregunta. Meter
  // un producto suelto en la lista que el usuario venía armando, sin avisar, es
  // el mismo problema que tenía la propuesta del asistente.
  async function elegirSugerencia(r: BusquedaResult) {
    setSugerencias(null);
    setQ('');
    setAgregado(null);
    if (user) {
      const activo = await quodomApi.activoPorRubro(r.categoriaPadre).catch(() => null);
      if (activo) { setConflicto({ producto: r, quodomExistente: activo }); return; }
    }
    setAgregado(r.nombre);
    agregarLinea(lineaDe(r), r.categoriaPadre);
  }

  async function resolverConflicto(accion: AccionRubro | null) {
    if (!conflicto) return;
    const { producto, quodomExistente } = conflicto;
    if (!accion) { setConflicto(null); return; }
    setConflicto(null);
    if (accion === 'integrar') {
      setAgregado(producto.nombre);
      agregarLinea(lineaDe(producto), producto.categoriaPadre);
      return;
    }
    // Empezar uno nuevo del mismo rubro sólo puede significar reemplazar: el
    // backend admite un único Quodom abierto por rubro. Se llama derecho a
    // confirmarYAgregar en vez de pasar por `agregar`, que al no encontrar
    // ninguno abierto abriría un segundo diálogo para pedir lo ya decidido.
    try {
      await quodomApi.eliminar(quodomExistente.id);
      await confirmarYAgregar(lineaDe(producto), { logueado: true, idrubro: producto.categoriaPadre, descripcion: 'Mi Quodom' });
      setAgregado(producto.nombre);
    } catch (e) {
      setErrReemplazo(e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo crear el Quodom.');
    }
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
          </div>
        )}
      </form>
      )}

      {agregado && <p className="home-agregado" role="status">Agregado ✓ {agregado}</p>}
      {(errAgregar || errReemplazo) && (
        <p className="home-agregar-error" role="alert">{errAgregar || errReemplazo}</p>
      )}

      {conflicto && (
        <DialogoConflictoRubro
          conflicto={{
            idrubro: conflicto.producto.categoriaPadre,
            quodomExistente: conflicto.quodomExistente,
            lineasInvitado: 1
          }}
          descripcionEntrante={'querés agregar ' + conflicto.producto.nombre}
          permitirCancelar
          etiquetaCancelar="Cancelar"
          onElegir={resolverConflicto}
        />
      )}

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

      {pendiente && (
        <DialogoNuevoRubro
          nombreRubro={nombreRubro(pendiente.idrubro)}
          onConfirmar={confirmar}
          onCancelar={cancelar}
          ocupado={agregando}
        />
      )}
    </section>
  );
}
