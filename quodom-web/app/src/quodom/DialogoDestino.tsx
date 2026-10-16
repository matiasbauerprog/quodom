import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Quodom } from '../api/types';
import { ProductImage } from '../components/ProductImage';
import './DialogoDestino.css';

/** Un atributo del producto y lo que el usuario eligió en la tarjeta (o nada). */
export type AtributoDeFicha = { nombre: string; valor: string | null };

/** La ficha del producto, para que elegir destino no sea elegir a ciegas. */
export type ProductoDelDialogo = {
  id: number;
  nombre: string;
  descripcion?: string | null;
  atributos?: AtributoDeFicha[];
};

type Props = {
  nombreRubro: string;
  candidatos: Quodom[];
  onElegir: (idquodom: string) => void;
  onCrear: () => void;
  onCancelar: () => void;
  ocupado?: boolean;
  error?: string | null;
  producto?: ProductoDelDialogo | null;
  /** Dónde estaba lo que se tocó: la ventana crece desde ahí y vuelve ahí. */
  origen?: DOMRect | null;
};

const DURACION = 260;
const CURVA = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

function sinMovimiento(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// The transform that puts the dialog over the card it came from.
function desdeElOrigen(el: HTMLElement, origen: DOMRect): string {
  // Unmeasured, the dialog is centered by its backdrop: aim from the card at the
  // middle of the window.
  const r = el.getBoundingClientRect();
  const cx = r.width ? r.left + r.width / 2 : window.innerWidth / 2;
  const cy = r.height ? r.top + r.height / 2 : window.innerHeight / 2;
  const dx = origen.left + origen.width / 2 - cx;
  const dy = origen.top + origen.height / 2 - cy;
  const escala = r.width && r.height ? Math.min(origen.width / r.width, origen.height / r.height, 1) : 0.4;
  return 'translate(' + dx + 'px, ' + dy + 'px) scale(' + escala + ')';
}

/**
 * Se pregunta una sola vez por rubro: lo que el usuario elija queda como el
 * Quodom abierto de ese rubro y los próximos "+" ya no vuelven a preguntar.
 *
 * `producto` trae la descripción y los atributos de lo que se está sumando.
 * Está acá porque en el catálogo este diálogo es lo que abre el clic en el
 * producto: sin la ficha, ese clic dejó de mostrar lo que el producto es.
 * Falta donde quien abre el diálogo no tiene esos datos (el buscador, o un
 * "+" que encoló varias líneas), y entonces el diálogo va sin ficha.
 *
 * Con `origen`, la ventana crece desde la tarjeta y al cancelar se achica de
 * vuelta hacia ella; recién al terminar avisa `onCancelar`, porque quien la
 * monta la desmonta en el acto. Elegir no anima la salida: el producto ya se
 * está agregando y el aviso de "agregado" es el que cuenta adónde fue.
 */
export function DialogoDestino({ nombreRubro, candidatos, onElegir, onCrear, onCancelar, ocupado, error, producto, origen }: Props) {
  const ventana = useRef<HTMLElement>(null);
  const fondo = useRef<HTMLDivElement>(null);
  const cerrando = useRef(false);

  useLayoutEffect(() => {
    const el = ventana.current;
    if (!origen || !el || typeof el.animate !== 'function' || sinMovimiento()) return;
    el.animate(
      [{ transform: desdeElOrigen(el, origen), opacity: 0.3 }, { transform: 'none', opacity: 1 }],
      { duration: DURACION, easing: CURVA }
    );
    // Sólo al montar: el origen es el de la tarjeta que lo abrió.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cerrar() {
    if (ocupado || cerrando.current) return;
    const el = ventana.current;
    if (!origen || !el || typeof el.animate !== 'function' || sinMovimiento()) {
      onCancelar();
      return;
    }
    cerrando.current = true;
    fondo.current?.classList.add('dd-backdrop-saliendo');
    const anim = el.animate(
      [{ transform: 'none', opacity: 1 }, { transform: desdeElOrigen(el, origen), opacity: 0 }],
      { duration: DURACION * 0.8, easing: CURVA, fill: 'forwards' }
    );
    anim.finished.then(onCancelar, onCancelar);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const atributos = producto?.atributos ?? [];

  return (
    <div className="dd-backdrop" ref={fondo} onClick={cerrar}>
      <section
        ref={ventana}
        className="dd hoja"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dd-titulo"
        onClick={e => e.stopPropagation()}
      >
        {producto && (
          <header className="dd-ficha">
            <ProductImage idproducto={producto.id} alt={producto.nombre} size="md" />
            <div className="dd-ficha-txt">
              <span className="dd-ficha-nombre">{producto.nombre}</span>
              {producto.descripcion && producto.descripcion !== producto.nombre && (
                <p className="dd-ficha-desc">{producto.descripcion}</p>
              )}
              {atributos.length > 0 && (
                <ul className="dd-attrs">
                  {atributos.map(a => (
                    <li key={a.nombre} className={'dd-attr' + (a.valor ? '' : ' dd-attr-vacio')}>
                      <span className="dd-attr-nombre">{a.nombre.toLowerCase()}</span>
                      <span>{a.valor ?? 'sin elegir'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </header>
        )}

        <div className="dd-cuerpo">
          <h2 id="dd-titulo" className="dd-titulo">Sumar a · {nombreRubro}</h2>
          <ul className="dd-lista">
            {candidatos.map(q => (
              <li key={q.id}>
                <button type="button" className="dd-opcion" onClick={() => onElegir(q.id)} disabled={ocupado}>
                  <span className="dd-nombre">{q.descripcion}</span>
                  <span className="dd-cant">{q.cantproductos ?? 0} {q.cantproductos === 1 ? 'producto' : 'productos'}</span>
                </button>
              </li>
            ))}
            <li>
              <button type="button" className="dd-opcion dd-nuevo" onClick={onCrear} disabled={ocupado}>
                {ocupado ? 'Agregando…' : '+ Un Quodom nuevo de ' + nombreRubro}
              </button>
            </li>
          </ul>
          {error && <p className="dd-error" role="alert">{error}</p>}
        </div>

        <footer className="dd-pie">
          <span className="dd-nota">El que elijas queda abierto para lo próximo de {nombreRubro}.</span>
          <button type="button" className="dd-cancelar" onClick={cerrar} disabled={ocupado}>Cancelar</button>
        </footer>
      </section>
    </div>
  );
}
