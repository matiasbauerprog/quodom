import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import { planificarMigracion, migrarRubro } from '../../guest/migrateGuestQuodom';
import type { AccionRubro, ConflictoRubro } from '../../guest/migrateGuestQuodom';
import { DialogoConflictoRubro } from '../../guest/DialogoConflictoRubro';
import './SignIn.css';

export function SignIn() {
  const { signin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictos, setConflictos] = useState<ConflictoRubro[]>([]);
  const [resolviendo, setResolviendo] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signin(username, password);
      const plan = await planificarMigracion();
      for (const idrubro of plan.sinConflicto) {
        await migrarRubro(idrubro, 'crear');
      }
      if (plan.conflictos.length > 0) {
        setConflictos(plan.conflictos);   // el diálogo los resuelve de a uno
        return;                            // no navegamos todavía
      }
      navigate(from ?? '/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'No se pudo ingresar.');
    } finally {
      setBusy(false);
    }
  }

  async function resolverConflicto(accion: AccionRubro | null) {
    const [actual, ...resto] = conflictos;
    if (!accion) {
      setConflictos(resto);
      if (resto.length === 0) navigate(from ?? '/', { replace: true });
      return;
    }
    setError(null);
    setResolviendo(true);
    try {
      await migrarRubro(actual.idrubro, accion);
      setConflictos(resto);
      if (resto.length === 0) navigate(from ?? '/', { replace: true });
    } catch (err) {
      // The guest cart for this rubro survives a failed migrarRubro (it only
      // clears once every line is confirmed), so keep the conflict on screen
      // instead of dropping it — the user can retry the same rubro.
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'No se pudo migrar el carrito.');
    } finally {
      setResolviendo(false);
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
      {conflictos.length > 0 && (
        <DialogoConflictoRubro conflicto={conflictos[0]} onElegir={resolverConflicto} ocupado={resolviendo} />
      )}
    </div>
  );
}
