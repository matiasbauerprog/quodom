import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { users } from '../../api/users';
import { ApiError } from '../../api/client';
import './SignIn.css';

export function ValidarEmail() {
  const { token = '' } = useParams();
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [msg, setMsg] = useState<string>('');
  useEffect(() => {
    (async () => {
      try {
        const r = await users.validateEmail(token);
        setState(r.res ? 'ok' : 'error');
        setMsg(r.message);
      } catch (err) {
        setState('error');
        setMsg(err instanceof ApiError ? err.message : 'Error validando el correo.');
      }
    })();
  }, [token]);
  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <h1>Validar email</h1>
        {state === 'loading' && <p>Validando…</p>}
        {state === 'ok' && <><p>{msg}</p><Link to="/login" className="btn btn-block">Ir a ingresar</Link></>}
        {state === 'error' && <p className="auth-error">{msg}</p>}
      </div>
    </div>
  );
}
