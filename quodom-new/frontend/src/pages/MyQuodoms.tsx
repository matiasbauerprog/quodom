import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface QuodomItem {
  id: string;
  name: string;
  date: string;
  status: 'Borrador' | 'Enviado' | 'Recibido';
  itemsCount: number;
  totalItems: number;
}

const MOCK_QUODOMS: QuodomItem[] = [
  { id: '1', name: 'Lista de Fin de Semana', date: '2026-07-08', status: 'Borrador', itemsCount: 4, totalItems: 10 },
  { id: '2', name: 'Compras Mensuales Almacén', date: '2026-07-05', status: 'Enviado', itemsCount: 15, totalItems: 15 },
  { id: '3', name: 'Asado con amigos', date: '2026-06-30', status: 'Recibido', itemsCount: 8, totalItems: 8 }
];

export default function MyQuodoms() {
  const [filter, setFilter] = useState<'Todos' | 'Borrador' | 'Enviado' | 'Recibido'>('Todos');
  const navigate = useNavigate();

  const filteredQuodoms = MOCK_QUODOMS.filter(q => {
    if (filter === 'Todos') return true;
    return q.status === filter;
  });

  return (
    <section className="page-container">
      <header>
        <h1 className="page-title">Mis Quodoms</h1>
        <p className="page-subtitle">
          Historial y estado de tus listas de compras guardadas.
        </p>
      </header>

      {/* Filters */}
      <nav aria-label="Filtro de estados de Quodom" className="filters-container">
        {(['Todos', 'Borrador', 'Enviado', 'Recibido'] as const).map(option => (
          <button
            key={option}
            type="button"
            className={`btn ${filter === option ? 'btn-primary' : 'btn-secondary'} btn-filter`}
            onClick={() => setFilter(option)}
          >
            {option}
          </button>
        ))}
      </nav>

      {/* List */}
      <main aria-label="Listado de Quodoms">
        {filteredQuodoms.length === 0 ? (
          <article className="card-leaf card-empty">
            <p>No tienes Quodoms en este estado.</p>
          </article>
        ) : (
          <ul className="quodoms-list">
            {filteredQuodoms.map(quodom => {
              const progressPct = Math.round((quodom.itemsCount / quodom.totalItems) * 100);
              return (
                <li key={quodom.id}>
                  <article className="card-leaf quodom-card">
                    <header className="quodom-card-header">
                      <div className="item-info-group">
                        <h2 className="quodom-card-title">{quodom.name}</h2>
                        <time className="quodom-card-time" dateTime={quodom.date}>
                          Creado el: {quodom.date}
                        </time>
                      </div>
                      <span className={`status-badge badge-${quodom.status.toLowerCase()}`}>
                        {quodom.status}
                      </span>
                    </header>

                    <section className="progress-container">
                      <p className="progress-text-wrapper">
                        <span>Progreso: {quodom.itemsCount}/{quodom.totalItems} ítems</span>
                        <span>{progressPct}%</span>
                      </p>
                      {/* Custom brutalist progress bar */}
                      <div
                        className="progress-bar-container"
                        role="progressbar"
                        aria-valuenow={progressPct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Progreso de la lista: ${quodom.itemsCount} de ${quodom.totalItems} ítems`}
                      >
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${progressPct}%` }}
                        ></div>
                      </div>
                    </section>

                    <footer className="card-footer-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-action"
                        onClick={() => navigate(`/quodom/${quodom.id}`)}
                      >
                        Editar/Ver
                      </button>
                      {quodom.status === 'Borrador' && (
                        <button
                          type="button"
                          className="btn btn-success btn-action"
                          onClick={() => alert('¡Enviado por WhatsApp!')}
                        >
                          Enviar WhatsApp
                        </button>
                      )}
                    </footer>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </section>
  );
}
