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

  const getStatusColor = (status: QuodomItem['status']) => {
    switch (status) {
      case 'Borrador': return 'var(--color-violet)';
      case 'Enviado': return 'var(--color-green)';
      case 'Recibido': return 'var(--color-dark-gray)';
      default: return 'var(--color-dark-gray)';
    }
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '2.5rem' }}>Mis Quodoms</h1>
        <p style={{ fontFamily: 'var(--font-family-space)', fontWeight: 500 }}>
          Historial y estado de tus listas de compras guardadas.
        </p>
      </header>

      {/* Filters */}
      <nav aria-label="Filtro de estados de Quodom" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {(['Todos', 'Borrador', 'Enviado', 'Recibido'] as const).map(option => (
          <button
            key={option}
            type="button"
            className={`btn ${filter === option ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
            onClick={() => setFilter(option)}
          >
            {option}
          </button>
        ))}
      </nav>

      {/* List */}
      <main aria-label="Listado de Quodoms">
        {filteredQuodoms.length === 0 ? (
          <article className="card-leaf" style={{ textAlign: 'center', padding: '3rem' }}>
            <p>No tienes Quodoms en este estado.</p>
          </article>
        ) : (
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {filteredQuodoms.map(quodom => {
              const progressPct = Math.round((quodom.itemsCount / quodom.totalItems) * 100);
              return (
                <li key={quodom.id}>
                  <article className="card-leaf" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <hgroup>
                        <h2 style={{ fontSize: '1.25rem' }}>{quodom.name}</h2>
                        <time style={{ fontSize: '0.85rem', color: 'var(--color-dark-gray)', fontFamily: 'var(--font-family-space)' }}>
                          Creado el: {quodom.date}
                        </time>
                      </hgroup>
                      <span
                        style={{
                          backgroundColor: getStatusColor(quodom.status),
                          color: 'var(--color-white)',
                          padding: '0.25rem 0.75rem',
                          fontFamily: 'var(--font-family-space)',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          textTransform: 'uppercase',
                          border: '2px solid var(--color-black)'
                        }}
                      >
                        {quodom.status}
                      </span>
                    </header>

                    <section style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <p style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 700 }}>
                        <span>Progreso: {quodom.itemsCount}/{quodom.totalItems} ítems</span>
                        <span>{progressPct}%</span>
                      </p>
                      {/* Custom brutalist progress bar */}
                      <div style={{ height: '14px', border: '2px solid var(--color-black)', backgroundColor: 'var(--color-light-gray)' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${progressPct}%`,
                            backgroundColor: 'var(--color-violet)',
                            transition: 'width 0.3s ease'
                          }}
                        ></div>
                      </div>
                    </section>

                    <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                        onClick={() => navigate(`/quodom/${quodom.id}`)}
                      >
                        Editar/Ver
                      </button>
                      {quodom.status === 'Borrador' && (
                        <button
                          type="button"
                          className="btn btn-success"
                          style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
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
