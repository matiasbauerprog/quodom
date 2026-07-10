import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="auth-page">
      <article className="auth-card" style={{ maxWidth: '500px' }}>
        <h1 className="auth-title" style={{ fontSize: '4rem', marginBottom: '1rem' }}>404</h1>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Página No Encontrada</h2>
        <p style={{ marginBottom: '2rem', fontFamily: 'var(--font-family-space)' }}>
          El Quodom que buscas no existe o se ha movido de lugar.
        </p>
        <Link to="/home" className="btn btn-primary" style={{ width: '100%' }}>
          Volver al Inicio
        </Link>
      </article>
    </section>
  );
}
