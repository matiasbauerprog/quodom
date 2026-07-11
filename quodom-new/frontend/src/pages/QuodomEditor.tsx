import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

const MOCK_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Lechuga Capuchina', category: 'verduras', price: 1200, unit: 'un.' },
  { id: 'p2', name: 'Tomate Redondo', category: 'verduras', price: 1800, unit: 'kg' },
  { id: 'p3', name: 'Zanahoria', category: 'verduras', price: 950, unit: 'kg' },
  { id: 'p4', name: 'Manzana Roja', category: 'frutas', price: 1600, unit: 'kg' },
  { id: 'p5', name: 'Banana', category: 'frutas', price: 1400, unit: 'kg' },
  { id: 'p6', name: 'Naranja para Jugo', category: 'frutas', price: 1100, unit: 'kg' },
  { id: 'p7', name: 'Papa Negra', category: 'verduras', price: 800, unit: 'kg' },
  { id: 'p8', name: 'Cebolla', category: 'verduras', price: 900, unit: 'kg' }
];

export default function QuodomEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeSubcategory, setActiveSubcategory] = useState<'todos' | 'verduras' | 'frutas'>('todos');
  const [selectedItems, setSelectedItems] = useState<CartItem[]>([]);
  const [quodomName, setQuodomName] = useState(`Mi Quodom - ${id ? id.toUpperCase() : 'Nueva Lista'}`);

  const filteredProducts = MOCK_PRODUCTS.filter(p => {
    if (activeSubcategory === 'todos') return true;
    return p.category === activeSubcategory;
  });

  const handleProductToggle = (product: Product) => {
    const exists = selectedItems.find(item => item.product.id === product.id);
    if (exists) {
      setSelectedItems(prev => prev.filter(item => item.product.id !== product.id));
    } else {
      setSelectedItems(prev => [...prev, { product, quantity: 1 }]);
    }
  };

  const handleQuantityChange = (productId: string, increment: number) => {
    setSelectedItems(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(1, item.quantity + increment);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const handleSendWhatsApp = () => {
    if (selectedItems.length === 0) {
      alert('Tu Quodom está vacío');
      return;
    }

    const itemsText = selectedItems
      .map(item => `• ${item.product.name}: ${item.quantity} ${item.product.unit}`)
      .join('\n');
    
    const message = `¡Hola! Aquí está mi lista *${quodomName}*:\n\n${itemsText}\n\nEnviado desde Quodom 3.0.`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    
    alert('Estado de Quodom actualizado a "Enviado"');
    navigate('/my-quodoms');
  };

  return (
    <section className="page-container">
      <header className="page-header-small-gap">
        <input
          type="text"
          className="form-input editable-title-input"
          value={quodomName}
          onChange={(e) => setQuodomName(e.target.value)}
          aria-label="Nombre de Quodom"
        />
        <p className="page-subtitle">
          Agrega productos del catálogo y envía la orden por WhatsApp.
        </p>
      </header>

      {/* Editor Layout (Responsive Double Column on Desktop) */}
      <section className="editor-layout">
        {/* Catálogo Panel */}
        <article className="catalog-panel">
          <header className="panel-header">
            <h2 className="panel-title">Catálogo de Productos</h2>
          </header>

          {/* Subcategory horizontal tabs */}
          <nav aria-label="Subcategorías" className="subcategory-nav">
            {(['todos', 'verduras', 'frutas'] as const).map(sub => (
              <button
                key={sub}
                type="button"
                className={`btn ${activeSubcategory === sub ? 'btn-primary' : 'btn-secondary'} btn-sub-filter`}
                onClick={() => setActiveSubcategory(sub)}
              >
                {sub}
              </button>
            ))}
          </nav>

          {/* Product checklist */}
          <ul className="catalog-list">
            {filteredProducts.map(product => {
              const isChecked = selectedItems.some(item => item.product.id === product.id);
              return (
                <li key={product.id}>
                  <label className={`product-item-label ${isChecked ? 'checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleProductToggle(product)}
                      className="product-item-checkbox"
                    />
                    <span className="product-name">{product.name}</span>
                    <span className="product-price">
                      ${product.price} / {product.unit}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </article>

        {/* Selected Items Panel */}
        <aside className="selected-items-panel">
          <header className="panel-header">
            <h2 className="panel-title">Ítems Seleccionados ({selectedItems.length})</h2>
          </header>

          {selectedItems.length === 0 ? (
            <p className="empty-cart-text">
              No has seleccionado productos aún. Utiliza el checklist del catálogo.
            </p>
          ) : (
            <section className="selected-items-container">
              <ul className="selected-items-list">
                {selectedItems.map(item => (
                  <li key={item.product.id} className="selected-item-row">
                    <div className="item-info-group">
                      <p className="selected-item-name">{item.product.name}</p>
                      <p className="selected-item-meta">
                        ${item.product.price * item.quantity} (${item.product.price} x {item.product.unit})
                      </p>
                    </div>

                    <div className="quantity-controls">
                      <button
                        type="button"
                        className="btn btn-secondary btn-quantity"
                        onClick={() => handleQuantityChange(item.product.id, -1)}
                      >
                        -
                      </button>
                      <span className="quantity-value">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-quantity"
                        onClick={() => handleQuantityChange(item.product.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Total Calculation */}
              <footer className="panel-footer">
                <p className="total-row">
                  <span>TOTAL ESTIMADO:</span>
                  <span>
                    ${selectedItems.reduce((acc, curr) => acc + (curr.product.price * curr.quantity), 0)}
                  </span>
                </p>

                <div className="panel-footer-actions">
                  <button type="button" className="btn btn-success btn-full-width" onClick={handleSendWhatsApp}>
                    Enviar vía WhatsApp
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-full-width"
                    onClick={() => {
                      alert('Quodom guardado en borradores');
                      navigate('/my-quodoms');
                    }}
                  >
                    Guardar Borrador
                  </button>
                </div>
              </footer>
            </section>
          )}
        </aside>
      </section>
    </section>
  );
}
