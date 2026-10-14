import { useEffect } from 'react';
import type { Quodom } from '../api/types';
import { ProductImage } from '../components/ProductImage';
import './DialogoDestino.css';

/** La ficha del producto, para que elegir destino no sea elegir a ciegas. */
export type ProductoDelDialogo = {
  id: number;
  nombre: string;
  descripcion?: string | null;
  atributos?: (string | null | undefined)[];
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
};

/**
 * Se pregunta una sola vez por rubro: lo que el usuario elija queda como el
 * Quodom abierto de ese rubro y los próximos "+" ya no vuelven a preguntar.
 *
 * `producto` trae la descripción y los atributos de lo que se está sumando.
 * Está acá porque en el catálogo este diálogo es lo que abre el clic en el
 * producto: sin la ficha, ese clic dejó de mostrar lo que el producto es.
 * Falta donde quien abre el diálogo no tiene esos datos (el buscador, o un
 * "+" que encoló varias líneas), y entonces el diálogo va sin cabecera.
 */
export function DialogoDestino({ nombreRubro, candidatos, onElegir, onCrear, onCancelar, ocupado, error, producto }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !ocupado) onCancelar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancelar, ocupado]);

  function cerrar() {
    if (ocupado) return;
    onCancelar();
  }

  return (
    <div className="dd-backdrop" onClick={cerrar}>
      <section
        className="dd card hoja"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dd-titulo"
        onClick={e => e.stopPropagation()}
      >
        {producto && (
          <div className="dd-producto">
            <ProductImage idproducto={producto.id} alt={producto.nombre} size="md" />
            <div className="dd-producto-txt">
              <span className="dd-producto-nombre">{producto.nombre}</span>
              {producto.descripcion && <p className="dd-producto-desc">{producto.descripcion}</p>}
              {producto.atributos && producto.atributos.filter(Boolean).length > 0 && (
                <p className="dd-producto-attrs">
                  Atributos: {producto.atributos.filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </div>
        )}
        <h2 id="dd-titulo" className="dd-titulo">¿A qué Quodom de {nombreRubro} lo sumás?</h2>
        <p className="dd-texto">
          Elegí uno y queda abierto: los próximos productos de {nombreRubro} van directo ahí.
        </p>
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
              {ocupado ? 'Agregando…' : 'Un Quodom nuevo de ' + nombreRubro}
            </button>
          </li>
        </ul>
        {error && <p className="dd-error" role="alert">{error}</p>}
        <div className="dd-acciones">
          <button type="button" className="btn btn-ghost" onClick={cerrar} disabled={ocupado}>Cancelar</button>
        </div>
      </section>
    </div>
  );
}
