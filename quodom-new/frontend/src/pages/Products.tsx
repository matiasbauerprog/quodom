import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

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

export default function Products() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const categoryIdParam = searchParams.get('category');
  const rootCategoryId = categoryIdParam ? parseInt(categoryIdParam, 10) : null;
  const initialSearch = searchParams.get('search') || '';

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [activeSubcategoryId, setActiveSubcategoryId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState(initialSearch);

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  // 1. Fetch categories on mount
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
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  // 2. Fetch products under selected category/subcategory (with AbortController and 300ms debounce)
  useEffect(() => {
    const controller = new AbortController();
    
    setLoadingProducts(true);
    setProductsError(null);

    const fetchProducts = async () => {
      try {
        const queryParams = new URLSearchParams();
        
        // Use activeSubcategoryId if selected, otherwise fallback to rootCategoryId
        const catId = activeSubcategoryId !== null ? activeSubcategoryId : rootCategoryId;
        if (catId !== null) {
          queryParams.append('categoryId', catId.toString());
        }

        if (searchTerm.trim()) {
          queryParams.append('search', searchTerm.trim());
        }

        const response = await fetch(`/api/catalog/products?${queryParams.toString()}`, {
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error('No se pudieron cargar los productos');
        }
        let data;
        try {
          data = await response.json();
        } catch (jsonErr) {
          throw new Error('El servidor backend no está respondiendo. Por favor, asegúrate de que esté iniciado en el puerto 3000.');
        }
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
  }, [rootCategoryId, activeSubcategoryId, searchTerm]);

  // Find root category object
  const rootCategory = categories.find(c => c.id === rootCategoryId);
  const subcategories = rootCategory?.subcategories || [];
  const rootCategoryName = rootCategory ? rootCategory.name : 'Catálogo';

  const handleBackToHome = () => {
    navigate('/home');
  };

  return (
    <section className="page-container-grow home-page-container">
      <header className="page-header-row" style={{ alignItems: 'center' }}>
        <div className="page-header-text">
          <h1 className="page-title">
            {loadingCategories ? 'Cargando...' : rootCategoryName}
          </h1>
          <p className="page-subtitle">
            {rootCategoryId !== null
              ? `Explora los productos de la categoría ${rootCategoryName}.`
              : 'Explora y busca en todo el catálogo de productos.'}
          </p>
        </div>
        <button 
          type="button" 
          className="btn btn-secondary" 
          onClick={handleBackToHome}
        >
          Volver a Inicio
        </button>
      </header>

      {/* Buscador */}
      <section className="card-leaf search-card">
        <label htmlFor="products-search-input" className="form-group">
          <span className="form-label search-label">Buscar en el catálogo</span>
          <input
            id="products-search-input"
            type="search"
            className="form-input"
            placeholder={rootCategoryId !== null ? `Buscar en ${rootCategoryName}...` : 'Escribe para buscar productos...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </label>
      </section>

      <section className="catalog-panel">
        {/* Subcategories Selector */}
        {!loadingCategories && subcategories.length > 0 && (
          <nav aria-label="Subcategorías" className="subcategory-nav">
            <button
              type="button"
              className={`btn ${activeSubcategoryId === null ? 'btn-primary' : 'btn-secondary'} btn-sub-filter`}
              onClick={() => setActiveSubcategoryId(null)}
            >
              Todos
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

        {loadingProducts ? (
          <div className="catalog-loading">
            Cargando productos...
          </div>
        ) : productsError ? (
          <div className="catalog-error">
            ⚠️ {productsError}
          </div>
        ) : products.length === 0 ? (
          <div className="catalog-empty">
            No se encontraron productos en esta selección.
          </div>
        ) : (
          <ul className="catalog-list catalog-list-expanded">
            {products.map((product) => (
              <li key={product.id}>
                <article className="product-item-label product-item-home">
                  <div className="product-item-info">
                    {product.image ? (
                      <figure className="product-image-figure">
                        <img 
                          src={product.image} 
                          alt={product.name} 
                          className="product-image-preview" 
                        />
                      </figure>
                    ) : (
                      <div className="product-image-fallback">
                        📦
                      </div>
                    )}
                    <div className="product-details">
                      <h3 className="product-name product-name-home">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="product-desc-home">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="product-price product-unit-badge">
                    {product.unit}
                  </span>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
