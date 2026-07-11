import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

interface Category {
  id: number;
  name: string;
  parentId: number;
  image: string | null;
  subcategories: Category[];
}

interface Product {
  id: number;
  name: string;
  description: string | null;
  unit: string;
  image: string | null;
  categoryId: number;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ia';
  text: string;
}

// Map root categories to emojis as fallbacks
function getCategoryIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('construccion') || lower.includes('construcción')) return '🏗️';
  if (lower.includes('pintura') || lower.includes('pincel') || lower.includes('rodillo')) return '🎨';
  if (lower.includes('electricidad') || lower.includes('cable')) return '⚡';
  if (lower.includes('plomeria') || lower.includes('plomería') || lower.includes('tubo')) return '🔧';
  if (lower.includes('herramienta')) return '🔨';
  if (lower.includes('iluminacion') || lower.includes('iluminación')) return '💡';
  if (lower.includes('jardin') || lower.includes('jardín')) return '🌱';
  if (lower.includes('baño') || lower.includes('sanitario') || lower.includes('grifería')) return '🚽';
  if (lower.includes('cocina')) return '🍳';
  if (lower.includes('mueble') || lower.includes('madera')) return '🪑';
  if (lower.includes('limpieza') || lower.includes('higiene')) return '🧼';
  if (lower.includes('seguridad')) return '🛡️';
  if (lower.includes('ferreteria') || lower.includes('ferretería') || lower.includes('tornillo')) return '🔩';
  return '📦';
}

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<number | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [iaMessage, setIaMessage] = useState('');
  const [isIaOpen, setIsIaOpen] = useState(false);
  const [isIaLoading, setIsIaLoading] = useState(false);
  const [iaError, setIaError] = useState<string | null>(null);
  
  const [iaChatHistory, setIaChatHistory] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'ia',
      text: '¡Hola! Soy tu asistente IA de Quodom. Cuéntame qué proyecto quieres realizar (ej. "Quiero pintar una habitación de 4x4") y armaré la lista de materiales por ti.'
    }
  ]);

  const navigate = useNavigate();

  // Load root categories on mount
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
        setCategoriesError(err.message || 'Error al conectar con el servidor');
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  // Fetch products when selected category or search term changes
  useEffect(() => {
    // If no category is selected and search is empty, do nothing
    if (selectedCategoryId === null && !searchTerm.trim()) {
      setProducts([]);
      return;
    }

    const fetchProducts = async () => {
      setLoadingProducts(true);
      setProductsError(null);
      try {
        const queryParams = new URLSearchParams();
        
        // Use activeSubcategoryId if selected, otherwise fallback to selectedCategoryId
        const catId = activeSubcategoryId !== null ? activeSubcategoryId : selectedCategoryId;
        if (catId !== null) {
          queryParams.append('categoryId', catId.toString());
        }
        if (searchTerm.trim()) {
          queryParams.append('search', searchTerm.trim());
        }

        const response = await fetch(`/api/catalog/products?${queryParams.toString()}`);
        if (!response.ok) {
          throw new Error('No se pudieron cargar los productos');
        }
        const data = await response.json();
        setProducts(data);
      } catch (err: any) {
        console.error('Error fetching products:', err);
        setProductsError(err.message || 'Error de conexión');
      } finally {
        setLoadingProducts(false);
      }
    };

    // Debounce product fetches slightly (300ms) to accommodate typing in search
    const delayDebounce = setTimeout(() => {
      fetchProducts();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [selectedCategoryId, activeSubcategoryId, searchTerm]);

  const handleCategoryClick = (catId: number, catName: string) => {
    setSelectedCategoryId(catId);
    setSelectedCategoryName(catName);
    setActiveSubcategoryId(null); // Reset subcategory filter when root category changes
  };

  const handleClearFilters = () => {
    setSelectedCategoryId(null);
    setSelectedCategoryName(null);
    setActiveSubcategoryId(null);
    setSearchTerm('');
  };

  const handleIaSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!iaMessage.trim()) return;

    const promptText = iaMessage.trim();
    
    // Add user message to history
    const userMsgId = `msg-user-${Date.now()}`;
    setIaChatHistory(prev => [...prev, { id: userMsgId, sender: 'user', text: promptText }]);
    setIaMessage('');
    setIsIaLoading(true);
    setIaError(null);

    try {
      const token = localStorage.getItem('quodom_token');
      
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ prompt: promptText }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'La generación con IA falló');
      }

      // Add success response to chat just in case, though we redirect
      const iaMsgId = `msg-ia-${Date.now()}`;
      setIaChatHistory(prev => [...prev, {
        id: iaMsgId,
        sender: 'ia',
        text: `¡Éxito! Lista de materiales generada correctamente. Redirigiéndote...`
      }]);

      // Redirect user to the newly generated Quodom
      navigate(`/quodom/${data.id}`);
    } catch (err: any) {
      console.error('Error de IA:', err);
      setIaError(err.message || 'Error al conectar con el asistente de IA');
      
      const iaMsgErrorId = `msg-ia-err-${Date.now()}`;
      setIaChatHistory(prev => [...prev, {
        id: iaMsgErrorId,
        sender: 'ia',
        text: `Error: ${err.message || 'No se pudo generar la lista de materiales.'}`
      }]);
      
      setIsIaLoading(false);
    }
  };

  // Find subcategories of the active selected category
  const activeCategoryObj = categories.find(c => c.id === selectedCategoryId);
  const subcategories = activeCategoryObj?.subcategories || [];

  return (
    <section className="page-container-grow" style={{ paddingBottom: '80px' /* space for Modo IA drawer */ }}>
      {/* Modo IA Loading Overlay */}
      {isIaLoading && (
        <div 
          className="ia-loading-overlay" 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(246, 238, 93, 0.96)', // Quodom Yellow with transparency
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '2rem',
            textAlign: 'center'
          }}
        >
          <div 
            className="brutalist-spinner" 
            style={{
              width: '80px',
              height: '80px',
              border: '8px solid var(--color-black)',
              borderTop: '8px solid var(--color-violet)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '2rem',
              boxShadow: 'var(--box-shadow-brutal-large)'
            }}
          ></div>
          <h2 
            style={{ 
              fontFamily: 'var(--font-family-display)', 
              fontSize: '2rem', 
              color: 'var(--color-black)',
              marginBottom: '1rem',
              textTransform: 'uppercase'
            }}
          >
            IA de Quodom procesando tus productos...
          </h2>
          <p 
            style={{ 
              fontFamily: 'var(--font-family-space)', 
              color: 'var(--color-dark-gray)', 
              fontSize: '1.1rem',
              maxWidth: '500px',
              fontWeight: 500
            }}
          >
            Estamos analizando tu solicitud en lenguaje natural para armar la lista de materiales perfecta para tu proyecto. ¡Un momento, por favor!
          </p>
          
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      <header className="page-header">
        <h1 className="page-title">Selecciona Categorías</h1>
        <p className="page-subtitle">
          Arma tu Quodom seleccionando una categoría o usando el Modo IA abajo.
        </p>
      </header>

      {/* Buscador */}
      <section className="card-leaf search-card">
        <label htmlFor="search-input" className="form-group">
          <span className="form-label search-label">Buscar Productos</span>
          <input
            id="search-input"
            type="search"
            className="form-input"
            placeholder="Escribe para buscar productos... (ej. Pintura, Ladrillo, Cable)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </label>
      </section>

      {/* Main Catalog Area */}
      {selectedCategoryId !== null || searchTerm.trim() !== '' ? (
        /* PRODUCT LISTING STATE */
        <section aria-label="Listado de productos" className="catalog-panel">
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 className="panel-title" style={{ margin: 0, textTransform: 'uppercase', fontSize: '1.5rem' }}>
                {selectedCategoryName ? `Productos en ${selectedCategoryName}` : 'Resultados de Búsqueda'}
              </h2>
              {searchTerm.trim() && (
                <p className="page-subtitle" style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
                  Buscando: "{searchTerm}"
                </p>
              )}
            </div>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handleClearFilters}
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            >
              Volver a Categorías
            </button>
          </header>

          {/* Subcategories Selector */}
          {selectedCategoryId !== null && subcategories.length > 0 && (
            <nav aria-label="Subcategorías" className="subcategory-nav" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-light-gray)' }}>
              <button
                type="button"
                className={`btn ${activeSubcategoryId === null ? 'btn-primary' : 'btn-secondary'} btn-sub-filter`}
                onClick={() => setActiveSubcategoryId(null)}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', whiteSpace: 'nowrap' }}
              >
                Todos
              </button>
              {subcategories.map(sub => (
                <button
                  key={sub.id}
                  type="button"
                  className={`btn ${activeSubcategoryId === sub.id ? 'btn-primary' : 'btn-secondary'} btn-sub-filter`}
                  onClick={() => setActiveSubcategoryId(sub.id)}
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', whiteSpace: 'nowrap' }}
                >
                  {sub.name}
                </button>
              ))}
            </nav>
          )}

          {loadingProducts ? (
            <div style={{ textAlign: 'center', padding: '3rem', fontFamily: 'var(--font-family-space)', fontWeight: 'bold' }}>
              Cargando productos...
            </div>
          ) : productsError ? (
            <div style={{ color: 'var(--color-coral)', padding: '2rem', textAlign: 'center', fontWeight: 'bold' }}>
              ⚠️ {productsError}
            </div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', fontFamily: 'var(--font-family-space)' }}>
              No se encontraron productos en esta selección.
            </div>
          ) : (
            <ul className="catalog-list" style={{ maxLines: 'none', maxHeight: 'none', overflowY: 'visible' }}>
              {products.map((product) => (
                <li key={product.id}>
                  <article 
                    className="product-item-label" 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '1rem',
                      cursor: 'default',
                      gap: '1rem'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexGrow: 1 }}>
                      {product.image ? (
                        <figure style={{ margin: 0, flexShrink: 0 }}>
                          <img 
                            src={product.image} 
                            alt={product.name} 
                            style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--color-black)' }} 
                          />
                        </figure>
                      ) : (
                        <div style={{ width: '48px', height: '48px', backgroundColor: 'var(--color-light-gray)', border: '1px solid var(--color-black)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>
                          📦
                        </div>
                      )}
                      <div style={{ textAlign: 'left' }}>
                        <h3 className="product-name" style={{ margin: 0, fontSize: '1.05rem', textTransform: 'none', fontFamily: 'var(--font-family-body)', fontWeight: 700 }}>
                          {product.name}
                        </h3>
                        {product.description && (
                          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--color-dark-gray)', fontFamily: 'var(--font-family-body)' }}>
                            {product.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <span 
                      className="product-price" 
                      style={{
                        fontFamily: 'var(--font-family-space)',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        backgroundColor: 'var(--color-light-gray)',
                        padding: '0.3rem 0.75rem',
                        border: '2px solid var(--color-black)',
                        borderRadius: 'var(--border-radius-pill)',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {product.unit}
                    </span>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        /* CATEGORIES GRID STATE */
        <section aria-label="Categorías de productos">
          {loadingCategories ? (
            <div style={{ textAlign: 'center', padding: '3rem', fontFamily: 'var(--font-family-space)', fontWeight: 'bold' }}>
              Cargando categorías...
            </div>
          ) : categoriesError ? (
            <div style={{ color: 'var(--color-coral)', padding: '2rem', textAlign: 'center', fontWeight: 'bold' }}>
              ⚠️ {categoriesError}
            </div>
          ) : (
            <ul className="categories-grid" style={{ listStyle: 'none' }}>
              {categories.map(category => {
                const icon = getCategoryIcon(category.name);
                return (
                  <li key={category.id}>
                    <button 
                      type="button"
                      onClick={() => handleCategoryClick(category.id, category.name)} 
                      className="category-card"
                      style={{ width: '100%', background: 'var(--color-white)', border: '3px solid var(--color-black)' }}
                    >
                      <span className="category-icon" aria-hidden="true" style={{ fontSize: '2.5rem' }}>
                        {category.image ? (
                          <img 
                            src={category.image} 
                            alt={category.name} 
                            style={{ width: '50px', height: '50px', objectFit: 'contain' }}
                          />
                        ) : icon}
                      </span>
                      <h2 className="category-title" style={{ margin: 0 }}>{category.name}</h2>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Modo IA Drawer / Container */}
      <aside 
        className="modo-ia-container" 
        aria-label="Asistente de Inteligencia Artificial"
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '600px',
          zIndex: 900,
          boxShadow: '0px -6px 0px 0px var(--color-black)',
          transition: 'max-height 0.3s ease-out'
        }}
      >
        <header 
          className="modo-ia-header" 
          onClick={() => setIsIaOpen(!isIaOpen)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <h2 className="modo-ia-title" style={{ margin: 0, fontSize: '0.95rem', letterSpacing: '0.02em' }}>
            <span className="modo-ia-indicator"></span>
            MODO IA - GENERAR LISTA CON IA
          </h2>
          <button
            type="button"
            className="btn btn-secondary btn-icon btn-toggle-ia"
            aria-expanded={isIaOpen}
            aria-label={isIaOpen ? "Colapsar Modo IA" : "Expandir Modo IA"}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '2px solid var(--color-black)' }}
          >
            {isIaOpen ? '▼' : '▲'}
          </button>
        </header>

        {isIaOpen && (
          <section className="modo-ia-body" style={{ marginTop: '0.75rem' }}>
            {iaError && (
              <div style={{ color: 'var(--color-coral)', fontSize: '0.85rem', fontWeight: 'bold', padding: '0.25rem 0', textAlign: 'left' }}>
                ⚠️ {iaError}
              </div>
            )}
            
            <ul 
              className="ia-chat-list" 
              style={{ 
                listStyle: 'none', 
                padding: '0.5rem', 
                maxHeight: '150px', 
                overflowY: 'auto', 
                backgroundColor: 'var(--color-light-gray)', 
                border: '2px solid var(--color-black)',
                borderRadius: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}
            >
              {iaChatHistory.map((chat) => (
                <li
                  key={chat.id}
                  className={`ia-chat-bubble bubble-${chat.sender}`}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-family-body)',
                    alignSelf: chat.sender === 'user' ? 'flex-end' : 'flex-start',
                    backgroundColor: chat.sender === 'user' ? 'var(--color-violet)' : '#FFFFFF',
                    color: chat.sender === 'user' ? '#FFFFFF' : 'var(--color-black)',
                    border: '1.5px solid var(--color-black)',
                    maxWidth: '85%',
                    textAlign: 'left'
                  }}
                >
                  {chat.text}
                </li>
              ))}
            </ul>
            
            <form onSubmit={handleIaSubmit} className="modo-ia-input-wrapper" style={{ marginTop: '0.5rem' }}>
              <input
                aria-label="Mensaje para la IA"
                type="text"
                className="modo-ia-input"
                placeholder='Ej. "Quiero pintar una habitación de 4x4"'
                value={iaMessage}
                onChange={(e) => setIaMessage(e.target.value)}
                style={{ borderRadius: '4px', padding: '0.6rem 0.8rem', fontSize: '0.9rem' }}
              />
              <button 
                type="submit" 
                className="btn btn-primary btn-ia-send"
                style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', boxShadow: 'none' }}
              >
                Enviar
              </button>
            </form>
          </section>
        )}
      </aside>
    </section>
  );
}

