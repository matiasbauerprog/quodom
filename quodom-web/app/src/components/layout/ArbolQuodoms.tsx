import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Quodom } from '../../api/types';
import { abiertoDe, abrirQuodom, cerrarQuodom } from '../../quodom/quodomAbierto';
import { useArrastreActivo } from '../../quodom/useArrastreActivo';
import { RotuloRubro } from './RotuloRubro';
import { TarjetaDestino } from './TarjetaDestino';
import { quodom as quodomApi } from '../../api/quodom';
import { ApiError } from '../../api/client';
import './ArbolQuodoms.css';

export type RamaRubro = { idrubro: number; nombre: string; quodoms: Quodom[] };

export function cuentaProductos(n: number | null | undefined): string {
  return (n ?? 0) === 1 ? '1 producto' : (n ?? 0) + ' productos';
}

function cuentaQuodoms(n: number): string {
  if (n === 0) return 'Sin Quodoms';
  return n === 1 ? '1 Quodom' : n + ' Quodoms';
}

/**
 * Rubro padre, Quodoms en armado como hijos. El hijo abierto es el que recibe
 * lo que se agrega de ese rubro: desplegado y destino son la misma cosa, por eso
 * un solo clic hace las dos.
 *
 * El rubro que el usuario está mirando sube al tope de la lista y se resalta.
 * El `?rubro` se lee de la URL acá adentro, y no entra por prop, porque las dos
 * superficies que dibujan este árbol —el panel derecho y la barra inferior—
 * tendrían que leer lo mismo para pasárselo.
 *
 * Lo usan el panel derecho (escritorio) y la barra inferior (celular); nunca
 * están los dos en pantalla.
 */
export function ArbolQuodoms({ ramas, onCambio, renderAbierto }: {
  ramas: RamaRubro[];
  onCambio: () => void;
  renderAbierto?: (q: Quodom) => ReactNode;
}) {
  // Todo arranca desplegado: la lista ya trae sólo lo que está en armado, y plegar
  // un rubro con trabajo adentro escondería justo lo que este panel existe para mostrar.
  // Qué rubros se ofrecen lo decide quien arma las ramas, no este componente.
  const [plegados, setPlegados] = useState<Record<number, boolean>>({});
  const arrastrando = useArrastreActivo();
  const [params] = useSearchParams();
  const enPantalla = Number(params.get('rubro')) || null;

  // El Quodom abierto vive en localStorage, no en React: sin suscribirse, un cambio
  // hecho desde otro lado (o desde acá) no volvería a pintar el marcado.
  const [, setVersion] = useState(0);
  useEffect(() => {
    const releer = () => setVersion(v => v + 1);
    window.addEventListener('quodom:abierto', releer);
    return () => window.removeEventListener('quodom:abierto', releer);
  }, []);

  // Arrastrando un producto sobre un rubro plegado, se despliega: plegado no tiene
  // Quodoms montados y no habría dónde soltar. El aviso lo manda quien arrastra.
  useEffect(() => {
    const desplegar = (e: Event) => {
      const { idrubro } = (e as CustomEvent<{ idrubro: number }>).detail;
      setPlegados(p => (p[idrubro] ? { ...p, [idrubro]: false } : p));
    };
    window.addEventListener('arrastre:sobre-rubro', desplegar);
    return () => window.removeEventListener('arrastre:sobre-rubro', desplegar);
  }, []);

  // Entrar a un rubro deja el panel contestando por ese rubro: el resto se
  // pliega y queda a la vista lo que hay en el que se está mirando. Con un solo
  // Quodom se abre ese, porque ahí "cuál es el destino" no tiene alternativa;
  // con varios no se elige por el usuario — se muestran y él decide.
  //
  // Sólo en el cambio de rubro, no en cada render: si corriera siempre, cerrar
  // el único Quodom a mano lo volvería a abrir en el acto.
  const rubroAcomodado = useRef<number | null>(null);
  useEffect(() => {
    // `ramas` vacío es "todavía no cargó": acomodar ahora daría por hecho que el
    // rubro no tiene Quodoms, y no se volvería a intentar cuando lleguen.
    if (enPantalla === null || ramas.length === 0) return;
    if (rubroAcomodado.current === enPantalla) return;
    rubroAcomodado.current = enPantalla;

    setPlegados(Object.fromEntries(
      ramas.filter(r => r.idrubro !== enPantalla).map(r => [r.idrubro, true])
    ));

    const rama = ramas.find(r => r.idrubro === enPantalla);
    if (rama && rama.quodoms.length === 1 && !abiertoDe(enPantalla)) {
      abrirQuodom(enPantalla, rama.quodoms[0].id);
    }
  }, [enPantalla, ramas]);

  // Desplegar un rubro plegado lo muestra con todos sus Quodoms cerrados (lo
  // pidió el usuario: aparecía con uno abierto que no había elegido ahora). Como
  // abierto y destino son lo mismo, el rubro queda sin destino y el próximo `+`
  // pregunta a cuál va.
  function alternarRubro(idrubro: number) {
    const desplegando = !!plegados[idrubro];
    setPlegados(p => ({ ...p, [idrubro]: !p[idrubro] }));
    if (desplegando && abiertoDe(idrubro)) {
      cerrarQuodom(idrubro);
      onCambio();
    }
  }

  function alternarQuodom(idrubro: number, idquodom: string) {
    if (abiertoDe(idrubro) === idquodom) cerrarQuodom(idrubro);
    else abrirQuodom(idrubro, idquodom);
    onCambio();
  }

  // El rubro que se está mirando primero; el resto conserva su orden, que el
  // sort es estable. Sin rubro en pantalla la lista queda como viene.
  const ordenadas = enPantalla === null
    ? ramas
    : [...ramas].sort((a, b) => Number(b.idrubro === enPantalla) - Number(a.idrubro === enPantalla));

  // El evento recarga el árbol, la barra de celular y la ventana del detalle,
  // que muestran el mismo nombre.
  async function renombrar(idquodom: string, descripcion: string) {
    try {
      await quodomApi.update(idquodom, { descripcion });
    } catch (e) {
      throw new Error(e instanceof ApiError ? e.message : 'No se pudo cambiar el nombre.');
    }
    window.dispatchEvent(new Event('quodom:changed'));
  }

  return (
    <div className="arbol">
      {ordenadas.map(rama => {
        const desplegado = !plegados[rama.idrubro];
        const abierto = abiertoDe(rama.idrubro);
        // Mientras se arrastra, el rubro del producto es el único donde se puede
        // soltar. Los otros se apagan en vez de esconderse: esconderlos movería
        // los destinos de lugar con el gesto ya empezado.
        const ajeno = !!arrastrando && arrastrando.idrubro !== rama.idrubro;
        const destinoDelArrastre = !!arrastrando && !ajeno;
        return (
          <section
            key={rama.idrubro}
            className={'arbol-rama'
              + (destinoDelArrastre ? ' arbol-rama-destino' : '')
              + (ajeno ? ' arbol-rama-ajena' : '')
              + (rama.idrubro === enPantalla ? ' arbol-rama-foco' : '')}
          >
            <RotuloRubro
              nombre={rama.nombre}
              cuenta={ajeno ? 'Otro rubro' : cuentaQuodoms(rama.quodoms.length)}
              desplegado={desplegado}
              onAlternar={() => alternarRubro(rama.idrubro)}
              idrubro={rama.idrubro}
            />

            {desplegado && rama.quodoms.length === 0 && (
              <p className="arbol-vacio">Ningún Quodom en armado.</p>
            )}

            {desplegado && rama.quodoms.length > 0 && (
              <ul className="arbol-hijos">
                {rama.quodoms.map(q => (
                  <li key={q.id} className="arbol-hijo">
                    {abierto === q.id ? (
                      <TarjetaDestino
                        nombre={q.descripcion || q.nro}
                        chip={{ texto: 'Recibe lo que agregás', tono: 'ok' }}
                        cuenta={cuentaProductos(q.cantproductos)}
                        onActivar={() => alternarQuodom(rama.idrubro, q.id)}
                        expandido
                        dataDestino={q.id}
                        dataRubro={rama.idrubro}
                        onRenombrar={nuevo => renombrar(q.id, nuevo)}
                      >
                        {renderAbierto && renderAbierto(q)}
                      </TarjetaDestino>
                    ) : (
                      <button
                        type="button"
                        className="arbol-quodom"
                        data-destino={q.id}
                        data-rubro={rama.idrubro}
                        aria-expanded={false}
                        onClick={() => alternarQuodom(rama.idrubro, q.id)}
                      >
                        <span className="arbol-radio" aria-hidden="true" />
                        <span className="arbol-quodom-txt">
                          <span className="arbol-nombre">{q.descripcion || q.nro}</span>
                          <span className="arbol-n">{cuentaProductos(q.cantproductos)}</span>
                        </span>
                        <span className="arbol-chevron" aria-hidden="true">⌄</span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Un rubro con Quodoms pero ninguno abierto no tiene destino: el
                próximo `+` va a preguntar a cuál. Decirlo acá ahorra la sorpresa. */}
            {desplegado && rama.quodoms.length > 0 && !abierto && (
              <p className="arbol-sin-destino">
                Sin destino: al agregar algo de {rama.nombre} te preguntamos a cuál va.
              </p>
            )}

            {/* Crear un Quodom nuevo soltando sólo se ofrece en el rubro del
                producto que se está arrastrando: en cualquier otro, soltar es un
                409 del servidor, así que ofrecerlo era ofrecer un error. */}
            {desplegado && destinoDelArrastre && (
              <div className="arbol-nuevo" data-nuevo={rama.idrubro} data-rubro={rama.idrubro}>
                + Soltar en un Quodom nuevo
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
