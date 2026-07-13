import type { Product } from '../../api/types';
import './DetalleProducto.css';

export function DetalleProducto({ product, onClose, onAdd }: { product: Product; onClose: () => void; onAdd: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card card hoja" onClick={e => e.stopPropagation()}>
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
