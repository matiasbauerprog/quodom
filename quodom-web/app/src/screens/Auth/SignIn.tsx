import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import './SignIn.css';

export function SignIn() {
  const { signin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const migratedId = await signin(username, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(migratedId ? '/quodom?id=' + encodeURIComponent(migratedId) : (from ?? '/'), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo ingresar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <h1>Ingresar</h1>
        <form onSubmit={onSubmit} noValidate>
          <label className="field">
            <span>Usuario o email</span>
            <input className="input" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="btn btn-block" disabled={busy || !username || !password}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
        </form>
        <div className="auth-links">
          <Link to="/recuperar">Olvidé mi contraseña</Link>
          <span>•</span>
          <Link to="/registro">Crear cuenta</Link>
        </div>
      </div>
    </div>
  );
}
