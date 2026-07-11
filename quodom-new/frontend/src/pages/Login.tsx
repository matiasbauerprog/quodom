import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Credenciales inválidas');
      }

      // Save token to localStorage and redirect to home
      localStorage.setItem('quodom_token', data.token);
      navigate('/home');
    } catch (err: any) {
      console.error('Error de login:', err);
      setError(err.message || 'Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-page">
      <article className="auth-card">
        <h1 className="auth-title">QUODOM</h1>
        
        {error && (
          <div 
            className="error-message" 
            role="alert" 
            style={{
              color: 'var(--color-coral)',
              backgroundColor: '#fff0f0',
              border: '2px solid var(--color-coral)',
              padding: '0.75rem',
              borderRadius: '4px',
              marginBottom: '1rem',
              fontFamily: 'var(--font-family-space)',
              fontWeight: 700,
              fontSize: '0.9rem',
              textAlign: 'left'
            }}
          >
            ⚠️ {error}
          </div>
        )}

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
              disabled={loading}
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
              disabled={loading}
              required
            />
          </label>
          <button 
            type="submit" 
            className="btn btn-violet" 
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
        <nav className="auth-links" aria-label="Enlaces de autenticación">
          <Link to="/register" className="auth-link">¿No tienes cuenta? Regístrate</Link>
          <a 
            href="#forgot" 
            className="auth-link" 
            onClick={(e) => { 
              e.preventDefault(); 
              alert('Recuperación de contraseña no disponible en esta versión'); 
            }}
          >
            ¿Olvidaste tu contraseña?
          </a>
        </nav>
      </article>
    </section>
  );
}

