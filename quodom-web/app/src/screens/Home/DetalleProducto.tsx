import type { Product } from '../../api/types';
import { ProductImage } from '../../components/ProductImage';
import './DetalleProducto.css';

/**
 * El detalle es también donde se decide a qué Quodom va el producto. Antes esa
 * decisión colgaba de un "···" en la tarjeta: un control chiquito y críptico
 * para una acción deliberada. Acá el usuario ya vino a mirar el producto.
 *
 * `onElegirDestino` falta para un invitado, que tiene un carrito por rubro y
 * nada que elegir: ofrecerle la opción sería prometerle una decisión que no existe.
 */
export function DetalleProducto({ product, onClose, onAdd, onElegirDestino }: {
  product: Product;
  onClose: () => void;
  onAdd: () => void;
  onElegirDestino?: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card card hoja" onClick={e => e.stopPropagation()}>
        <ProductImage idproducto={product.id} alt={product.nombreproducto} size="lg" />
        <h3>{product.nombreproducto}</h3>
        {product.descripcion && <p className="modal-desc">{product.descripcion}</p>}
        {(product.atributo1 || product.atributo2) && (
          <p className="modal-attrs">Atributos: {[product.atributo1, product.atributo2].filter(Boolean).join(', ')}</p>
        )}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          {onElegirDestino && (
            <button className="btn btn-ghost" onClick={onElegirDestino}>Agregar a otro Quodom</button>
          )}
          <button className="btn btn-exito" onClick={onAdd}>Agregar al Quodom</button>
        </div>
      </div>
    </div>
  );
}
