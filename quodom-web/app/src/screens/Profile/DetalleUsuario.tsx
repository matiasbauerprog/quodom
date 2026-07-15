import { useEffect, useState } from 'react';
import { users } from '../../api/users';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import { AppBarBack } from '../../components/layout/AppBarBack';
import './DetalleUsuario.css';

export function DetalleUsuario() {
  const { user, refresh } = useAuth();
  const [f, setF] = useState({ username: '', email: '', nombre: '', apellido: '', dni: '', codArea: '', telefono: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (!user) return;
    setF({
      username: user.username ?? '', email: user.email ?? '',
      nombre: user.nombre ?? '', apellido: user.apellido ?? '',
      dni: user.dni ?? '', codArea: user.codArea ?? '', telefono: user.telefono ?? ''
    });
  }, [user]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setBusy(true);
    try {
      const r = await users.update(f);
      await refresh();
      setMsg({ ok: !!r.res, text: r.message });
    } catch (e) { setMsg({ ok: false, text: e instanceof ApiError ? e.message : 'Error.' }); }
    finally { setBusy(false); }
  }
  return (
    <>
      <AppBarBack title="Mis datos" />
      <section className="container detalle-usuario">
        <form onSubmit={onSubmit}>
          <label className="field"><span>Nombre</span><input className="input" value={f.nombre} onChange={set('nombre')} required /></label>
          <label className="field"><span>Apellido</span><input className="input" value={f.apellido} onChange={set('apellido')} /></label>
          <label className="field"><span>DNI</span><input className="input" value={f.dni} onChange={set('dni')} /></label>
          <label className="field"><span>Email</span><input className="input" type="email" value={f.email} onChange={set('email')} required /></label>
          <label className="field"><span>Usuario</span><input className="input" value={f.username} onChange={set('username')} required /></label>
          <div className="grid-2">
            <label className="field"><span>Cód. área</span><input className="input" value={f.codArea} onChange={set('codArea')} /></label>
            <label className="field"><span>Teléfono</span><input className="input" value={f.telefono} onChange={set('telefono')} /></label>
          </div>
          {msg && <p className={msg.ok ? '' : 'auth-error'}>{msg.text}</p>}
          <button className="btn btn-block" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </form>
      </section>
    </>
  );
}
