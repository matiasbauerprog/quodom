import { useEffect, useState } from 'react';
import { users } from '../../api/users';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import { AppBarBack } from '../../components/layout/AppBarBack';
import { COD_AREA, TELEFONO_DIGITOS, soloDigitos, telefonoCompleto, telefonoGuardado } from '../../utils/telefono';
import './DetalleUsuario.css';

export function DetalleUsuario() {
  const { user, refresh } = useAuth();
  const [f, setF] = useState({
    email: '', nombre: '', apellido: '', telefono: '',
    empresa: '', cuit: '', facturaA: false
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    setF({
      email: user.email ?? '', nombre: user.nombre ?? '', apellido: user.apellido ?? '',
      telefono: telefonoGuardado(user.telefono),
      empresa: user.empresa ?? '', cuit: user.cuit ?? '', facturaA: !!user.facturaA
    });
  }, [user]);

  const set = (k: 'email' | 'nombre' | 'apellido' | 'empresa' | 'cuit') =>
    (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!telefonoCompleto(f.telefono)) {
      setMsg({ ok: false, text: 'El teléfono tiene que tener ' + TELEFONO_DIGITOS + ' dígitos, sin el código de área.' });
      return;
    }
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
        <form onSubmit={onSubmit} noValidate>
          <label className="field"><span>Nombre</span><input className="input" value={f.nombre} onChange={set('nombre')} required /></label>
          <label className="field"><span>Apellido</span><input className="input" value={f.apellido} onChange={set('apellido')} /></label>
          <label className="field"><span>Email</span><input className="input" type="email" value={f.email} onChange={set('email')} required /></label>
          <div className="grid-2">
            {/* Fijo: por ahora el servicio es sólo del área 011, y el servidor
                lo garantiza igual. Se muestra para que el número se lea entero. */}
            <label className="field"><span>Cód. área</span><input className="input" value={COD_AREA} disabled /></label>
            <label className="field">
              <span>Teléfono</span>
              <input
                className="input" inputMode="numeric" value={f.telefono}
                onChange={e => setF({ ...f, telefono: soloDigitos(e.target.value) })}
                required
              />
            </label>
          </div>

          <fieldset className="du-empresa">
            <legend>Datos de empresa</legend>
            <p className="du-ayuda">Si los cargás, viajan en el pedido para que el proveedor pueda facturarte.</p>
            <label className="field"><span>Empresa</span><input className="input" value={f.empresa} onChange={set('empresa')} /></label>
            <label className="field"><span>CUIT</span><input className="input" inputMode="numeric" value={f.cuit} onChange={set('cuit')} /></label>
            <label className="du-check">
              <input type="checkbox" checked={f.facturaA} onChange={e => setF({ ...f, facturaA: e.target.checked })} />
              <span>Factura A</span>
            </label>
          </fieldset>

          {msg && <p className={msg.ok ? '' : 'auth-error'} role={msg.ok ? undefined : 'alert'}>{msg.text}</p>}
          <button className="btn btn-block" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </form>
      </section>
    </>
  );
}
