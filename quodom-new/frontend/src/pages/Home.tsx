import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';

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

interface ChatMessage {
  id: string;
  sender: 'user' | 'ia';
  text: string;
}

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');
  const [iaMessage, setIaMessage] = useState('');
  const [isIaOpen, setIsIaOpen] = useState(false);
  const [iaChatHistory, setIaChatHistory] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'ia',
      text: '¡Hola! Soy tu asistente IA Quodom. ¿Qué necesitas comprar hoy? Puedes dictarme tu lista de compras directamente aquí.'
    }
  ]);

  const filteredCategories = MOCK_CATEGORIES.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleIaSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!iaMessage.trim()) return;

    const userMsg = iaMessage;
    const userMsgId = `msg-user-${Date.now()}`;
    setIaChatHistory(prev => [...prev, { id: userMsgId, sender: 'user', text: userMsg }]);
    setIaMessage('');

    setTimeout(() => {
      const iaMsgId = `msg-ia-${Date.now()}`;
      setIaChatHistory(prev => [...prev, {
        id: iaMsgId,
        sender: 'ia',
        text: `Entendido. He procesado tu solicitud: "${userMsg}". Creando tu Quodom sugerido...`
      }]);
    }, 1000);
  };

  return (
    <section className="page-container-grow">
      <header className="page-header">
        <h1 className="page-title">Selecciona Categorías</h1>
        <p className="page-subtitle">
          Arma tu Quodom seleccionando una categoría o usando el Modo IA abajo.
        </p>
      </header>

      {/* Buscador */}
      <section className="card-leaf search-card">
        <label htmlFor="search-input" className="form-group">
          <span className="form-label search-label">Buscar Categorías</span>
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
        <ul className="categories-grid">
          {filteredCategories.map(category => (
            <li key={category.id}>
              <Link to={`/quodom/${category.id}`} className="category-card">
                <span className="category-icon" aria-hidden="true">{category.icon}</span>
                <h2 className="category-title">{category.name}</h2>
                <p className="category-desc">{category.description}</p>
              </Link>
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
            className="btn btn-secondary btn-icon btn-toggle-ia"
            aria-expanded={isIaOpen}
            aria-label={isIaOpen ? "Colapsar Modo IA" : "Expandir Modo IA"}
          >
            {isIaOpen ? '▼' : '▲'}
          </button>
        </header>

        {isIaOpen && (
          <section className="modo-ia-body">
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
                className="modo-ia-input"
                placeholder="Escribe tu lista... (ej. 3 leches, 1 kg pan)"
                value={iaMessage}
                onChange={(e) => setIaMessage(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-ia-send">
                Enviar
              </button>
            </form>
          </section>
        )}
      </aside>
    </section>
  );
}
