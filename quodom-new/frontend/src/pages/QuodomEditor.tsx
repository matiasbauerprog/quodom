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
    <section style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <input
          type="text"
          className="form-input"
          value={quodomName}
          onChange={(e) => setQuodomName(e.target.value)}
          style={{
            fontSize: '1.75rem',
            fontWeight: 900,
            textTransform: 'uppercase',
            fontFamily: 'var(--font-family-display)',
            border: 'none',
            borderBottom: '3px dashed var(--color-black)',
            background: 'transparent',
            padding: '0.25rem 0',
            borderRadius: 0,
            width: '100%',
            maxWidth: '500px'
          }}
          aria-label="Nombre de Quodom"
        />
        <p style={{ fontFamily: 'var(--font-family-space)', fontWeight: 500 }}>
          Agrega productos del catálogo y envía la orden por WhatsApp.
        </p>
      </header>

      {/* Editor Layout (Responsive Double Column on Desktop) */}
      <section className="editor-layout">
        {/* Catálogo Panel */}
        <article className="catalog-panel">
          <header style={{ borderBottom: '2px solid var(--color-black)', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem' }}>Catálogo de Productos</h2>
          </header>

          {/* Subcategory horizontal tabs */}
          <nav aria-label="Subcategorías" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            {(['todos', 'verduras', 'frutas'] as const).map(sub => (
              <button
                key={sub}
                type="button"
                className={`btn ${activeSubcategory === sub ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                onClick={() => setActiveSubcategory(sub)}
              >
                {sub}
              </button>
            ))}
          </nav>

          {/* Product checklist */}
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {filteredProducts.map(product => {
              const isChecked = selectedItems.some(item => item.product.id === product.id);
              return (
                <li key={product.id}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '0.75rem 1rem',
                      border: '2px solid var(--color-black)',
                      borderRadius: 'var(--border-radius-leaf)',
                      backgroundColor: isChecked ? '#f6f9f6' : 'var(--color-white)',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleProductToggle(product)}
                      style={{
                        width: '20px',
                        height: '20px',
                        accentColor: 'var(--color-green)',
                        cursor: 'pointer'
                      }}
                    />
                    <span style={{ flexGrow: 1, fontWeight: 700 }}>{product.name}</span>
                    <span style={{ fontFamily: 'var(--font-family-space)', fontSize: '0.9rem', color: 'var(--color-dark-gray)' }}>
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
          <header style={{ borderBottom: '2px solid var(--color-black)', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem' }}>Ítems Seleccionados ({selectedItems.length})</h2>
          </header>

          {selectedItems.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-dark-gray)' }}>
              No has seleccionado productos aún. Utiliza el checklist del catálogo.
            </p>
          ) : (
            <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
                {selectedItems.map(item => (
                  <li
                    key={item.product.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0',
                      borderBottom: '1px solid var(--color-light-gray)'
                    }}
                  >
                    <hgroup>
                      <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.product.name}</p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-dark-gray)' }}>
                        ${item.product.price * item.quantity} (${item.product.price} x {item.product.unit})
                      </p>
                    </hgroup>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.5rem', minWidth: '28px', height: '28px', fontSize: '0.8rem' }}
                        onClick={() => handleQuantityChange(item.product.id, -1)}
                      >
                        -
                      </button>
                      <span style={{ fontFamily: 'var(--font-family-space)', fontWeight: 700, minWidth: '24px', textAlign: 'center' }}>
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.5rem', minWidth: '28px', height: '28px', fontSize: '0.8rem' }}
                        onClick={() => handleQuantityChange(item.product.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Total Calculation */}
              <footer style={{ borderTop: '2px solid var(--color-black)', paddingTop: '1rem', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.2rem' }}>
                  <span>TOTAL ESTIMADO:</span>
                  <span>
                    ${selectedItems.reduce((acc, curr) => acc + (curr.product.price * curr.quantity), 0)}
                  </span>
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-success" style={{ width: '100%' }} onClick={handleSendWhatsApp}>
                    Enviar vía WhatsApp
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ width: '100%' }}
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
