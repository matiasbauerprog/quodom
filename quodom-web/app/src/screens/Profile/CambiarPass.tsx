import { useState } from 'react';
import { users } from '../../api/users';
import { ApiError } from '../../api/client';
import { AppBarBack } from '../../components/layout/AppBarBack';
import { minLen } from '../../utils/validation';
import './CambiarPass.css';

export function CambiarPass() {
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const valid = minLen(pw, 6) && pw === pw2;
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setBusy(true);
    try { const r = await users.update({ password: pw }); setMsg({ ok: !!r.res, text: r.message }); if (r.res) { setPw(''); setPw2(''); } }
    catch (e) { setMsg({ ok: false, text: e instanceof ApiError ? e.message : 'Error.' }); }
    finally { setBusy(false); }
  }
  return (
    <>
      <AppBarBack title="Cambiar contraseña" />
      <section className="container cambiar-pass">
        <form onSubmit={onSubmit}>
          <label className="field"><span>Contraseña nueva (mín. 6)</span><input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} required /></label>
          <label className="field"><span>Repetir</span><input className="input" type="password" value={pw2} onChange={e => setPw2(e.target.value)} required /></label>
          {!valid && pw2.length > 0 && pw !== pw2 && <p className="auth-error">Las contraseñas no coinciden.</p>}
          {msg && <p className={msg.ok ? '' : 'auth-error'}>{msg.text}</p>}
          <button className="btn btn-block" disabled={busy || !valid}>{busy ? 'Guardando…' : 'Cambiar'}</button>
        </form>
      </section>
    </>
  );
}
