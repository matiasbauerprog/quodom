import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Simulate login for now
    localStorage.setItem('quodom_token', 'mock-token');
    navigate('/home');
  };

  return (
    <section className="auth-page">
      <article className="auth-card">
        <h1 className="auth-title">QUODOM</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="form-group" htmlFor="email-input">
            <span className="form-label">Email</span>
            <input
              id="email-input"
              type="email"
              className="form-input"
              placeholder="ejemplo@quodom.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="form-group" htmlFor="password-input">
            <span className="form-label">Contraseña</span>
            <input
              id="password-input"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn btn-violet" style={{ width: '100%', marginTop: '0.5rem' }}>
            Ingresar
          </button>
        </form>
        <nav className="auth-links" aria-label="Enlaces de autenticación">
          <Link to="/register" className="auth-link">¿No tienes cuenta? Regístrate</Link>
          <a href="#forgot" className="auth-link" onClick={(e) => { e.preventDefault(); alert('Recuperación en desarrollo'); }}>
            ¿Olvidaste tu contraseña?
          </a>
        </nav>
      </article>
    </section>
  );
}
