import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
}

const MOCK_CATEGORIES: Category[] = [
  { id: 'verduleria', name: 'Verdulería', icon: '🥬', description: 'Frutas y verduras frescas' },
  { id: 'carniceria', name: 'Carnicería', icon: '🥩', description: 'Carnes, pollo y embutidos' },
  { id: 'almacen', name: 'Almacén', icon: '🥫', description: 'Productos no perecederos' },
  { id: 'lacteos', name: 'Lácteos y Quesos', icon: '🥛', description: 'Leche, quesos, yogures' },
  { id: 'panaderia', name: 'Panadería', icon: '🥖', description: 'Panes, facturas y repostería' },
  { id: 'bebidas', name: 'Bebidas', icon: '🍷', description: 'Vinos, cervezas, gaseosas' },
  { id: 'limpieza', name: 'Limpieza', icon: '🧼', description: 'Cuidado del hogar y ropa' },
  { id: 'perfumeria', name: 'Perfumería', icon: '🧴', description: 'Cuidado personal e higiene' }
];

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');
  const [iaMessage, setIaMessage] = useState('');
  const [isIaOpen, setIsIaOpen] = useState(false);
  const [iaChatHistory, setIaChatHistory] = useState<Array<{ sender: 'user' | 'ia', text: string }>>([
    { sender: 'ia', text: '¡Hola! Soy tu asistente IA Quodom. ¿Qué necesitas comprar hoy? Puedes dictarme tu lista de compras directamente aquí.' }
  ]);
  const navigate = useNavigate();

  const filteredCategories = MOCK_CATEGORIES.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCategoryClick = (catId: string) => {
    navigate(`/quodom/${catId}`);
  };

  const handleIaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!iaMessage.trim()) return;

    const userMsg = iaMessage;
    setIaChatHistory(prev => [...prev, { sender: 'user', text: userMsg }]);
    setIaMessage('');

    setTimeout(() => {
      setIaChatHistory(prev => [...prev, {
        sender: 'ia',
        text: `Entendido. He procesado tu solicitud: "${userMsg}". Creando tu Quodom sugerido...`
      }]);
    }, 1000);
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, gap: '2rem' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h1 style={{ fontSize: '2.5rem' }}>Selecciona Categorías</h1>
        <p style={{ fontFamily: 'var(--font-family-space)', fontWeight: 500 }}>
          Arma tu Quodom seleccionando una categoría o usando el Modo IA abajo.
        </p>
      </header>

      {/* Buscador */}
      <section className="card-leaf" style={{ padding: '1.25rem' }}>
        <label htmlFor="search-input" className="form-group">
          <span className="form-label" style={{ fontSize: '0.8rem' }}>Buscar Categorías</span>
          <input
            id="search-input"
            type="search"
            className="form-input"
            placeholder="Escribe para buscar... (ej. Lácteos)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </label>
      </section>

      {/* Grilla de categorías */}
      <section aria-label="Categorías de productos">
        <ul className="categories-grid" style={{ listStyle: 'none' }}>
          {filteredCategories.map(category => (
            <li key={category.id}>
              <article
                className="category-card"
                onClick={() => handleCategoryClick(category.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCategoryClick(category.id); }}
              >
                <span className="category-icon" aria-hidden="true">{category.icon}</span>
                <h2 className="category-title">{category.name}</h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-dark-gray)' }}>{category.description}</p>
              </article>
            </li>
          ))}
        </ul>
      </section>

      {/* Modo IA Drawer / Container */}
      <aside className="modo-ia-container" aria-label="Asistente de Inteligencia Artificial">
        <header className="modo-ia-header" onClick={() => setIsIaOpen(!isIaOpen)}>
          <h2 className="modo-ia-title">
            <span className="modo-ia-indicator"></span>
            Modo IA - Asistente Inteligente
          </h2>
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            style={{ width: '28px', height: '28px', padding: 0, border: '2px solid black', fontSize: '0.75rem' }}
            aria-expanded={isIaOpen}
            aria-label={isIaOpen ? "Colapsar Modo IA" : "Expandir Modo IA"}
          >
            {isIaOpen ? '▼' : '▲'}
          </button>
        </header>

        {isIaOpen && (
          <section className="modo-ia-body">
            <ul style={{ listStyle: 'none', maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.5rem' }}>
              {iaChatHistory.map((chat, idx) => (
                <li
                  key={idx}
                  style={{
                    alignSelf: chat.sender === 'user' ? 'flex-end' : 'flex-start',
                    backgroundColor: chat.sender === 'user' ? 'var(--color-violet)' : 'var(--color-light-gray)',
                    color: chat.sender === 'user' ? 'var(--color-white)' : 'var(--color-black)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    maxWidth: '85%',
                    fontSize: '0.875rem',
                    fontFamily: 'var(--font-family-body)',
                    border: '2px solid var(--color-black)'
                  }}
                >
                  {chat.text}
                </li>
              ))}
            </ul>
            <form onSubmit={handleIaSubmit} className="modo-ia-input-wrapper">
              <input
                aria-label="Mensaje para la IA"
                type="text"
                className="modo-ia-input"
                placeholder="Escribe tu lista... (ej. 3 leches, 1 kg pan)"
                value={iaMessage}
                onChange={(e) => setIaMessage(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
                Enviar
              </button>
            </form>
          </section>
        )}
      </aside>
    </section>
  );
}
