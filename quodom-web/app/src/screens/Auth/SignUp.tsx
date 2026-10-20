import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { users } from '../../api/users';
import { ApiError } from '../../api/client';
import { isEmail, minLen, nonEmpty } from '../../utils/validation';
import { COD_AREA, soloDigitos, telefonoCompleto } from '../../utils/telefono';
import './SignIn.css';

export function SignUp() {
  const navigate = useNavigate();
  // Sin `username`: se entra con el mail. Sin `codArea`: es fijo y lo pone el
  // servidor. Ver utils/telefono.ts.
  const [f, setF] = useState({ email: '', nombre: '', apellido: '', password: '', telefono: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = isEmail(f.email) && nonEmpty(f.nombre)
    && minLen(f.password, 6) && telefonoCompleto(f.telefono);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      await users.signup(f);
      navigate('/cuenta-creada', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar.');
    } finally { setBusy(false); }
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <h1>Crear cuenta</h1>
        <form onSubmit={onSubmit} noValidate>
          <label className="field"><span>Nombre</span><input className="input" value={f.nombre} onChange={set('nombre')} required /></label>
          <label className="field"><span>Apellido</span><input className="input" value={f.apellido} onChange={set('apellido')} /></label>
          <label className="field"><span>Email</span><input className="input" type="email" value={f.email} onChange={set('email')} required /></label>
          <label className="field"><span>Contraseña (mín. 6)</span><input className="input" type="password" value={f.password} onChange={set('password')} required /></label>
          <div className="phone-row">
            <label className="field"><span>Cód. área</span><input className="input" value={COD_AREA} disabled /></label>
            <label className="field">
              <span>Teléfono sin el 0 y sin el 15</span>
              <input
                className="input" inputMode="numeric" value={f.telefono}
                onChange={e => setF({ ...f, telefono: soloDigitos(e.target.value) })}
                required
              />
            </label>
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="btn btn-block" disabled={!valid || busy}>{busy ? 'Creando…' : 'Crear cuenta'}</button>
        </form>
        <div className="auth-links"><Link to="/login">Ya tengo cuenta</Link></div>
      </div>
    </div>
  );
}
