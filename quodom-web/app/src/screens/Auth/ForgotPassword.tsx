import { useState } from 'react';
import { Link } from 'react-router-dom';
import { users } from '../../api/users';
import { ApiError } from '../../api/client';
import { isEmail } from '../../utils/validation';
import './SignIn.css';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setBusy(true);
    try {
      const r = await users.reset({ email });
      setMsg({ ok: !!r.res, text: r.message });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'No se pudo enviar.' });
    } finally { setBusy(false); }
  }
  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <h1>Recuperar contraseña</h1>
        <p>Escribí tu email y te enviamos un link para blanquear la contraseña.</p>
        <form onSubmit={onSubmit}>
          <label className="field"><span>Email</span><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          {msg && <p className={msg.ok ? '' : 'auth-error'}>{msg.text}</p>}
          <button className="btn btn-block" disabled={busy || !isEmail(email)}>{busy ? 'Enviando…' : 'Enviar link'}</button>
        </form>
        <div className="auth-links"><Link to="/login">Volver</Link></div>
      </div>
    </div>
  );
}
