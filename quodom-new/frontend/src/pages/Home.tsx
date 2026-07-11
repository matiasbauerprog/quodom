import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

interface Category {
  id: number;
  name: string;
  parentId: number;
  image: string | null;
  subcategories: Category[];
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

  const handleCategoryClick = (catId: number) => {
    navigate(`/products?category=${catId}`);
  };

  const handleCategoryKeyDown = (e: React.KeyboardEvent, catId: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCategoryClick(catId);
    }
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchTerm.trim())}`);
    }
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

  return (
    <section className="page-container-grow home-page-container">
      {/* Modo IA Loading Overlay */}
      {isIaLoading && (
        <div className="ia-loading-overlay">
          <div className="brutalist-spinner"></div>
          <h2 className="ia-loading-title">
            IA de Quodom procesando tus productos...
          </h2>
          <p className="ia-loading-text">
            Estamos analizando tu solicitud en lenguaje natural para armar la lista de materiales perfecta para tu proyecto. ¡Un momento, por favor!
          </p>
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
        <form onSubmit={handleSearchSubmit} className="form-group">
          <label htmlFor="search-input" className="form-label search-label">Buscar Productos</label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <input
              id="search-input"
              type="search"
              className="form-input"
              placeholder="Escribe para buscar productos... (ej. Pintura, Ladrillo, Cable) y presiona Enter"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flexGrow: 1 }}
            />
            <button type="submit" className="btn btn-primary" style={{ textTransform: 'uppercase' }}>
              Buscar
            </button>
          </div>
        </form>
      </section>

      {/* CATEGORIES GRID STATE */}
      <section aria-label="Categorías de productos">
        {loadingCategories ? (
          <div className="catalog-loading">
            Cargando categorías...
          </div>
        ) : categoriesError ? (
          <div className="catalog-error">
            ⚠️ {categoriesError}
          </div>
        ) : (
          <ul className="categories-grid">
            {categories.map(category => {
              const icon = getCategoryIcon(category.name);
              return (
                <li key={category.id}>
                  <article 
                    className="category-card"
                    tabIndex={0}
                    onClick={() => handleCategoryClick(category.id)} 
                    onKeyDown={(e) => handleCategoryKeyDown(e, category.id)}
                  >
                    <span className="category-icon category-icon-home" aria-hidden="true">
                      {category.image ? (
                        <img 
                          src={category.image} 
                          alt={category.name} 
                          className="category-img"
                        />
                      ) : icon}
                    </span>
                    <h2 className="category-title">{category.name}</h2>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Modo IA Drawer / Container */}
      <aside 
        className="modo-ia-container modo-ia-drawer" 
        aria-label="Asistente de Inteligencia Artificial"
      >
        <header 
          className="modo-ia-header" 
          onClick={() => setIsIaOpen(!isIaOpen)}
        >
          <h2 className="modo-ia-title">
            <span className="modo-ia-indicator"></span>
            MODO IA - GENERAR LISTA CON IA
          </h2>
          <button
            type="button"
            className="btn btn-secondary btn-icon btn-toggle-ia"
            aria-expanded={isIaOpen}
            aria-label={isIaOpen ? "Colapsar Modo IA" : "Expandir Modo IA"}
          >
            {isIaOpen ? '▼' : '▲'}
          </button>
        </header>

        {isIaOpen && (
          <section className="modo-ia-body">
            {iaError && (
              <div className="ia-error-message">
                ⚠️ {iaError}
              </div>
            )}
            
            <ul className="ia-chat-list">
              {iaChatHistory.map((chat) => (
                <li
                  key={chat.id}
                  className={`ia-chat-bubble bubble-${chat.sender}`}
                >
                  {chat.text}
                </li>
              ))}
            </ul>
            
            <form onSubmit={handleIaSubmit} className="modo-ia-input-wrapper">
              <input
                aria-label="Mensaje para la IA"
                type="text"
                className="modo-ia-input modo-ia-input-home"
                placeholder='Ej. "Quiero pintar una habitación de 4x4"'
                value={iaMessage}
                onChange={(e) => setIaMessage(e.target.value)}
              />
              <button 
                type="submit" 
                className="btn btn-primary btn-ia-send"
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
