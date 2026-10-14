import { useEffect, useState, type ReactNode } from 'react';
import type { Quodom } from '../../api/types';
import { abiertoDe, abrirQuodom, cerrarQuodom } from '../../quodom/quodomAbierto';
import './ArbolQuodoms.css';

export type RamaRubro = { idrubro: number; nombre: string; quodoms: Quodom[] };

/**
 * Rubro padre, Quodoms en armado como hijos. El hijo abierto es el que recibe
 * lo que se agrega de ese rubro: desplegado y destino son la misma cosa, por eso
 * un solo clic hace las dos.
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

  function alternarRubro(idrubro: number) {
    setPlegados(p => ({ ...p, [idrubro]: !p[idrubro] }));
  }

  function alternarQuodom(idrubro: number, idquodom: string) {
    if (abiertoDe(idrubro) === idquodom) cerrarQuodom(idrubro);
    else abrirQuodom(idrubro, idquodom);
    onCambio();
  }

  return (
    <div className="arbol">
      {ramas.map(rama => {
        const desplegado = !plegados[rama.idrubro];
        const abierto = abiertoDe(rama.idrubro);
        return (
          <section key={rama.idrubro} className={'arbol-rama' + (desplegado ? ' arbol-rama-abierta' : '')}>
            <button
              type="button"
              className="arbol-rubro"
              data-rubro-cab={rama.idrubro}
              aria-expanded={desplegado}
              onClick={() => alternarRubro(rama.idrubro)}
            >
              <span className="arbol-flecha" aria-hidden="true">▶</span>
              <span>{rama.nombre}</span>
              <span className="arbol-cuenta">{rama.quodoms.length || '—'}</span>
            </button>

            {desplegado && rama.quodoms.length === 0 && (
              <p className="arbol-vacio">Ningún Quodom en armado.</p>
            )}

            {desplegado && rama.quodoms.length > 0 && (
              <ul className="arbol-hijos">
                {rama.quodoms.map(q => (
                  <li key={q.id} className="arbol-hijo">
                    <button
                      type="button"
                      className="arbol-quodom"
                      data-destino={q.id}
                      data-rubro={rama.idrubro}
                      aria-expanded={abierto === q.id}
                      onClick={() => alternarQuodom(rama.idrubro, q.id)}
                    >
                      <span className="arbol-punto" aria-hidden="true" />
                      <span className="arbol-nombre">{q.descripcion || q.nro}</span>
                      <span className="arbol-n">{q.cantproductos ?? 0} prod.</span>
                    </button>
                    {abierto === q.id && renderAbierto && renderAbierto(q)}
                  </li>
                ))}
              </ul>
            )}

            {desplegado && (
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
