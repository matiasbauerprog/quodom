import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { users } from '../../api/users';
import { ApiError } from '../../api/client';
import { minLen } from '../../utils/validation';
import './SignIn.css';

export function ResetPassword() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [valid, setValid] = useState<null | boolean>(null);
  const [tokenMsg, setTokenMsg] = useState<string | undefined>();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await users.validateReset(token);
        setValid(!!r.res);
        setTokenMsg(r.message);
      } catch (err) {
        setValid(false);
        setTokenMsg(err instanceof ApiError ? err.message : 'Token invalido.');
      }
    })();
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setBusy(true);
    try {
      const r = await users.changePass({ password, token });
      setMsg({ ok: !!r.res, text: r.message });
      if (r.res) setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Error.' });
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <h1>Nueva contraseña</h1>
        {valid === null && <p>Validando link…</p>}
        {valid === false && <p className="auth-error">{tokenMsg ?? 'Link invalido.'}</p>}
        {valid === true && (
          <form onSubmit={onSubmit}>
            <label className="field"><span>Contraseña nueva (mín. 6)</span><input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
            {msg && <p className={msg.ok ? '' : 'auth-error'}>{msg.text}</p>}
            <button className="btn btn-block" disabled={busy || !minLen(password, 6)}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
