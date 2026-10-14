import type { Product } from '../../api/types';
import { ProductImage } from '../../components/ProductImage';
import './DetalleProducto.css';

/**
 * La ficha del producto: descripción y atributos.
 *
 * Con sesión, tocar el producto va directo a elegir a qué Quodom lo sumás —lo
 * que hacía el "···"—, así que este detalle es lo que ve un invitado, que tiene
 * un carrito por rubro y ninguna decisión de destino que tomar.
 */
export function DetalleProducto({ product, onClose, onAdd }: {
  product: Product;
  onClose: () => void;
  onAdd: () => void;
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
          <button className="btn btn-exito" onClick={onAdd}>Agregar al Quodom</button>
        </div>
      </div>
    </div>
  );
}
