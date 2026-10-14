import './RotuloRubro.css';

/**
 * El rubro, como rótulo con línea y no como fila con fondo propio.
 *
 * Con el rubro, el Quodom y el producto pintados como tres bloques del mismo
 * gris no se veía qué colgaba de qué. Bajándole el peso al rubro, el Quodom
 * queda como lo único que parece tocable, que es lo único que de verdad lo es.
 *
 * Con `onAlternar` es un botón que pliega (el árbol); sin él es un rótulo fijo,
 * que es lo que necesita un carrito de invitado, donde no hay nada que plegar.
 */
export function RotuloRubro({ nombre, cuenta, desplegado, onAlternar, idrubro }: {
  nombre: string;
  cuenta?: string;
  desplegado?: boolean;
  onAlternar?: () => void;
  idrubro?: number;
}) {
  const interior = (
    <>
      {onAlternar && <span className="rr-flecha" aria-hidden="true">▶</span>}
      <span className="rr-nombre">{nombre}</span>
      <span className="rr-regla" aria-hidden="true" />
      {cuenta && <span className="rr-cuenta">{cuenta}</span>}
    </>
  );

  if (!onAlternar) return <div className="rr">{interior}</div>;

  return (
    <button
      type="button"
      className={'rr rr-boton' + (desplegado ? ' rr-desplegado' : '')}
      // El arrastre reconoce las cabeceras por este atributo para desplegar un
      // rubro plegado al pasarle por encima.
      data-rubro-cab={idrubro}
      aria-expanded={desplegado}
      onClick={onAlternar}
    >
      {interior}
    </button>
  );
}
