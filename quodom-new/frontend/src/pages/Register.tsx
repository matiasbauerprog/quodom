import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }
    // Simulate registration
    localStorage.setItem('quodom_token', 'mock-token');
    navigate('/home');
  };

  return (
    <section className="auth-page">
      <article className="auth-card">
        <h1 className="auth-title">Registrarse</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="form-group" htmlFor="name-input">
            <span className="form-label">Nombre Completo</span>
            <input
              id="name-input"
              type="text"
              className="form-input"
              placeholder="Tu nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
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
          <label className="form-group" htmlFor="confirm-password-input">
            <span className="form-label">Confirmar Contraseña</span>
            <input
              id="confirm-password-input"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn btn-violet" style={{ width: '100%', marginTop: '0.5rem' }}>
            Crear Cuenta
          </button>
        </form>
        <nav className="auth-links" aria-label="Enlaces de autenticación">
          <Link to="/login" className="auth-link">¿Ya tienes cuenta? Inicia Sesión</Link>
        </nav>
      </article>
    </section>
  );
}
