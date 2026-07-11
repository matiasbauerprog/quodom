import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface Product {
  id: number;
  name: string;
  description: string | null;
  unit: string;
  image: string | null;
  categoryId: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface Category {
  id: number;
  name: string;
  parentId: number;
  image: string | null;
  subcategories: Category[];
}

export default function QuodomEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Active Quodom Info
  const [quodomName, setQuodomName] = useState('');
  const [selectedItems, setSelectedItems] = useState<CartItem[]>([]);
  const [loadingQuodom, setLoadingQuodom] = useState(true);
  const [quodomError, setQuodomError] = useState<string | null>(null);

  // Catalog Hierarchy & Products Filter
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  // 1. Fetch Quodom details on mount/ID change
  useEffect(() => {
    const token = localStorage.getItem('quodom_token');
    if (!token) {
      navigate('/login');
      return;
    }

    if (!id) {
      navigate('/my-quodoms');
      return;
    }

    const fetchQuodomDetails = async () => {
      try {
        const response = await fetch(`/api/quodoms/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          localStorage.removeItem('quodom_token');
          navigate('/login');
          return;
        }

        if (response.status === 403 || response.status === 404) {
          navigate('/my-quodoms');
          return;
        }

        if (!response.ok) {
          throw new Error('Error al cargar la información del Quodom');
        }

        const data = await response.json();
        setQuodomName(data.title);
        
        // Map items structure
        const mappedItems = (data.items || []).map((item: any) => ({
          product: item.product,
          quantity: item.quantity,
        }));
        setSelectedItems(mappedItems);
      } catch (err: any) {
        console.error('Fetch Quodom detail error:', err);
        setQuodomError(err.message || 'Error de conexión');
      } finally {
        setLoadingQuodom(false);
      }
    };

    fetchQuodomDetails();
  }, [id, navigate]);

  // 2. Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/catalog/categories');
        if (!response.ok) {
          throw new Error('No se pudieron cargar las categorías del catálogo');
        }
        const data = await response.json();
        setCategories(data);
      } catch (err: any) {
        console.error('Error fetching categories:', err);
      }
    };

    fetchCategories();
  }, []);

  // 3. Fetch products based on category, subcategory, and search term (with AbortController & debounce)
  useEffect(() => {
    const controller = new AbortController();
    setLoadingProducts(true);
    setProductsError(null);

    const fetchProducts = async () => {
      try {
        const queryParams = new URLSearchParams();
        
        // Prefer subcategory if set, fallback to root category
        const catId = activeSubcategoryId !== null ? activeSubcategoryId : selectedCategoryId;
        if (catId !== null) {
          queryParams.append('categoryId', catId.toString());
        }
        if (searchTerm.trim()) {
          queryParams.append('search', searchTerm.trim());
        }

        const response = await fetch(`/api/catalog/products?${queryParams.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Error al buscar los productos');
        }

        const data = await response.json();
        setProducts(data);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return;
        }
        console.error('Error fetching products:', err);
        setProductsError(err.message || 'Error de conexión');
      } finally {
        if (!controller.signal.aborted) {
          setLoadingProducts(false);
        }
      }
    };

    const delayDebounce = setTimeout(() => {
      fetchProducts();
    }, 300);

    return () => {
      clearTimeout(delayDebounce);
      controller.abort();
    };
  }, [selectedCategoryId, activeSubcategoryId, searchTerm]);

  // Product checkbox toggle
  const handleProductToggle = (product: Product) => {
    const exists = selectedItems.find(item => item.product.id === product.id);
    if (exists) {
      setSelectedItems(prev => prev.filter(item => item.product.id !== product.id));
    } else {
      setSelectedItems(prev => [...prev, { product, quantity: 1 }]);
    }
  };

  // Quantity control handlers
  const handleQuantityChange = (productId: number, increment: number) => {
    setSelectedItems(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(1, item.quantity + increment);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  // Save Draft PUT request
  const handleSaveDraft = async () => {
    const token = localStorage.getItem('quodom_token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const response = await fetch(`/api/quodoms/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: quodomName,
          items: selectedItems.map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
        }),
      });

      if (response.status === 401) {
        localStorage.removeItem('quodom_token');
        navigate('/login');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al guardar el borrador');
      }

      alert('¡Quodom guardado en borradores con éxito!');
      navigate('/my-quodoms');
    } catch (err: any) {
      console.error('Save draft error:', err);
      alert(err.message || 'No se pudo guardar la lista');
    }
  };

  // WhatsApp Send POST and redirection
  const handleSendWhatsApp = async () => {
    if (selectedItems.length === 0) {
      alert('Tu Quodom está vacío. Selecciona productos para enviar.');
      return;
    }

    const token = localStorage.getItem('quodom_token');
    if (!token) {
      navigate('/login');
      return;
    }

    // 1. Compile final text message
    const itemsText = selectedItems
      .map(item => `• ${item.product.name}: ${item.quantity} ${item.product.unit}`)
      .join('\n');
    const message = `¡Hola! Aquí está mi lista *${quodomName}*:\n\n${itemsText}\n\nEnviado desde Quodom 3.0.`;

    try {
      // 2. Call backend to update status to Enviado
      const response = await fetch(`/api/quodoms/${id}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        localStorage.removeItem('quodom_token');
        navigate('/login');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al enviar el Quodom');
      }

      // 3. Open WhatsApp link and redirect
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
      navigate('/my-quodoms');
    } catch (err: any) {
      console.error('Send WhatsApp error:', err);
      alert(err.message || 'No se pudo enviar el Quodom');
    }
  };

  // Find subcategories of selected root category
  const activeCategoryObj = categories.find(c => c.id === selectedCategoryId);
  const subcategories = activeCategoryObj?.subcategories || [];

  if (loadingQuodom) {
    return (
      <section className="page-container">
        <div className="card-leaf card-empty">
          <p>Cargando tu Quodom...</p>
        </div>
      </section>
    );
  }

  if (quodomError) {
    return (
      <section className="page-container">
        <article className="card-leaf card-empty">
          <p className="error-message">⚠️ Error: {quodomError}</p>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/my-quodoms')} style={{ marginTop: '1rem' }}>
            Volver a Mis Quodoms
          </button>
        </article>
      </section>
    );
  }

  return (
    <section className="page-container">
      <header className="page-header-small-gap">
        <input
          type="text"
          className="form-input editable-title-input"
          value={quodomName}
          onChange={(e) => setQuodomName(e.target.value)}
          aria-label="Nombre de Quodom"
          placeholder="Nombre del Quodom"
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

          {/* Search bar inside the catalog checklist */}
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Buscar productos en el catálogo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Buscar productos"
            />
          </div>

          {/* Root category filter tabs */}
          <nav aria-label="Categorías" className="subcategory-nav">
            <button
              type="button"
              className={`btn ${selectedCategoryId === null ? 'btn-primary' : 'btn-secondary'} btn-sub-filter`}
              onClick={() => {
                setSelectedCategoryId(null);
                setActiveSubcategoryId(null);
              }}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                className={`btn ${selectedCategoryId === cat.id ? 'btn-primary' : 'btn-secondary'} btn-sub-filter`}
                onClick={() => {
                  setSelectedCategoryId(cat.id);
                  setActiveSubcategoryId(null);
                }}
              >
                {cat.name}
              </button>
            ))}
          </nav>

          {/* Subcategory filter tabs (if root category selected has subcategories) */}
          {selectedCategoryId !== null && subcategories.length > 0 && (
            <nav aria-label="Subcategorías" className="subcategory-nav-secondary">
              <button
                type="button"
                className={`btn ${activeSubcategoryId === null ? 'btn-primary' : 'btn-secondary'} btn-sub-filter`}
                onClick={() => setActiveSubcategoryId(null)}
              >
                Todas
              </button>
              {subcategories.map(sub => (
                <button
                  key={sub.id}
                  type="button"
                  className={`btn ${activeSubcategoryId === sub.id ? 'btn-primary' : 'btn-secondary'} btn-sub-filter`}
                  onClick={() => setActiveSubcategoryId(sub.id)}
                >
                  {sub.name}
                </button>
              ))}
            </nav>
          )}

          {/* Product checklist */}
          {loadingProducts ? (
            <div style={{ padding: '1rem', textAlign: 'center' }}>
              <p>Buscando productos...</p>
            </div>
          ) : productsError ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-coral)' }}>
              <p>⚠️ Error: {productsError}</p>
            </div>
          ) : products.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <p>No se encontraron productos en esta categoría.</p>
            </div>
          ) : (
            <ul className="catalog-list">
              {products.map(product => {
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
                        {product.unit}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
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
                        {item.product.unit}
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

              {/* Summary Calculation */}
              <footer className="panel-footer">
                <p className="total-row">
                  <span>CANTIDAD DE ÍTEMS:</span>
                  <span>{selectedItems.length}</span>
                </p>

                <div className="panel-footer-actions">
                  <button type="button" className="btn btn-success btn-full-width" onClick={handleSendWhatsApp}>
                    Enviar vía WhatsApp
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-full-width"
                    onClick={handleSaveDraft}
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
