import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface QuodomItem {
  id: string;
  title: string;
  status: 'En Proceso' | 'Enviado';
  createdAt: string;
  items?: {
    id: string;
    productId: number;
    quantity: number;
  }[];
}

export default function MyQuodoms() {
  const [quodoms, setQuodoms] = useState<QuodomItem[]>([]);
  const [filter, setFilter] = useState<'Todos' | 'En Proceso' | 'Enviado'>('Todos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('quodom_token');
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchQuodoms = async () => {
      try {
        const response = await fetch('/api/quodoms', {
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
          throw new Error('Error al cargar las listas de Quodoms');
        }

        const data = await response.json();
        setQuodoms(data);
      } catch (err: any) {
        console.error('Fetch Quodoms error:', err);
        setError(err.message || 'Error de conexión');
      } finally {
        setLoading(false);
      }
    };

    fetchQuodoms();
  }, [navigate]);

  const handleCreateQuodom = async () => {
    const token = localStorage.getItem('quodom_token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const response = await fetch('/api/quodoms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ title: 'Mi Quodom', items: [] }),
      });

      if (response.status === 401) {
        localStorage.removeItem('quodom_token');
        navigate('/login');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al crear el Quodom');
      }

      const newQuodom = await response.json();
      navigate(`/quodom/${newQuodom.id}`);
    } catch (err: any) {
      console.error('Create Quodom error:', err);
      alert(err.message || 'No se pudo crear la lista');
    }
  };

  const filteredQuodoms = quodoms.filter(q => {
    if (filter === 'Todos') return true;
    return q.status === filter;
  });

  return (
    <section className="page-container">
      <header className="page-header-row">
        <div className="page-header-text">
          <h1 className="page-title">Mis Quodoms</h1>
          <p className="page-subtitle">
            Historial y estado de tus listas de compras guardadas.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleCreateQuodom}
        >
          Crear Nueva Lista
        </button>
      </header>

      {/* Filters */}
      <nav aria-label="Filtro de estados de Quodom" className="filters-container">
        {(['Todos', 'En Proceso', 'Enviado'] as const).map(option => (
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
        {loading ? (
          <div className="card-leaf card-empty">
            <p>Cargando tus listas de Quodoms...</p>
          </div>
        ) : error ? (
          <article className="card-leaf card-empty">
            <p className="error-message">⚠️ Error: {error}</p>
          </article>
        ) : filteredQuodoms.length === 0 ? (
          <article className="card-leaf card-empty">
            <p>No tienes Quodoms en este estado.</p>
          </article>
        ) : (
          <ul className="quodoms-list">
            {filteredQuodoms.map(quodom => {
              const itemsCount = quodom.items?.length || 0;
              const totalItems = quodom.status === 'Enviado' ? itemsCount : Math.max(10, itemsCount);
              const progressPct = quodom.status === 'Enviado' ? 100 : (totalItems > 0 ? Math.round((itemsCount / totalItems) * 100) : 0);
              const formattedDate = quodom.createdAt ? quodom.createdAt.substring(0, 10) : '';

              return (
                <li key={quodom.id}>
                  <article className="card-leaf quodom-card">
                    <header className="quodom-card-header">
                      <div className="item-info-group">
                        <h2 className="quodom-card-title">{quodom.title}</h2>
                        <time className="quodom-card-time" dateTime={quodom.createdAt}>
                          Creado el: {formattedDate}
                        </time>
                      </div>
                      <span className={`status-badge ${quodom.status === 'Enviado' ? 'badge-enviado' : 'badge-borrador'}`}>
                        {quodom.status}
                      </span>
                    </header>

                    <section className="progress-container">
                      <p className="progress-text-wrapper">
                        <span>Progreso: {itemsCount}/{totalItems} ítems</span>
                        <span>{progressPct}%</span>
                      </p>
                      {/* Custom brutalist progress bar */}
                      <div
                        className="progress-bar-container"
                        role="progressbar"
                        aria-valuenow={progressPct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Progreso de la lista: ${itemsCount} de ${totalItems} ítems`}
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
