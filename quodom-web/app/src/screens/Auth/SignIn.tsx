import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import { planificarMigracion, migrarRubro } from '../../guest/migrateGuestQuodom';
import type { AccionRubro, ConflictoRubro } from '../../guest/migrateGuestQuodom';
import { DialogoConflictoRubro } from '../../guest/DialogoConflictoRubro';
import { nombreRubro } from '../../quodom/rubros';
import './SignIn.css';

const MENSAJE_MIGRACION_FALLIDA =
  'Ingresaste, pero algunos de tus carritos no se pudieron migrar. Tus productos siguen guardados; podés reintentarlo más tarde.';

function mensajeRubrosNoDisponibles(rubros: number[]): string {
  const nombres = rubros.map(nombreRubro).join(', ');
  return `Ingresaste. Tu carrito de ${nombres} quedó guardado, pero ese rubro no está disponible por ahora, así que no se puede enviar.`;
}

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
  // Sólo tras una migración fallida se ofrece seguir sin integrar: si no, un
  // servidor caído dejaría al usuario encerrado en el login.
  const [falloMigracion, setFalloMigracion] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    let signedIn = false;
    try {
      await signin(username, password);
      signedIn = true;
      const plan = await planificarMigracion();
      // Cada rubro se migra por su cuenta: uno que falle no puede impedir que
      // los demás lleguen al servidor. El carrito del que falla queda entero
      // en localStorage (migrarRubro sólo lo borra con todas sus líneas ya
      // confirmadas), así que se puede reintentar más tarde.
      const fallidos: number[] = [];
      for (const idrubro of plan.sinConflicto) {
        try {
          await migrarRubro(idrubro, 'crear');
        } catch {
          fallidos.push(idrubro);
        }
      }
      if (fallidos.length > 0) setError(MENSAJE_MIGRACION_FALLIDA);
      else if (plan.noDisponibles.length > 0) setError(mensajeRubrosNoDisponibles(plan.noDisponibles));
      if (plan.conflictos.length > 0) {
        setConflictos(plan.conflictos);   // el diálogo los resuelve de a uno
        return;                            // no navegamos todavía
      }
      navigate(from ?? '/', { replace: true });
    } catch (err) {
      if (signedIn) {
        // signin() already succeeded here — what failed is planning the guest
        // carts, not logging in. The generic "No se pudo ingresar." would read
        // as a failed login even though the user is authenticated, so this
        // needs its own message. The guest carts that didn't migrate are
        // untouched in localStorage (migrarRubro only clears one once every
        // line is confirmed), so nothing is lost.
        setError(MENSAJE_MIGRACION_FALLIDA);
        // Signing in always finishes. Being unable to move a cart must never
        // strand an already-authenticated user on /login, which is registered
        // outside <Layout> and therefore has no AppBar, Drawer or way out.
        navigate(from ?? '/', { replace: true });
      } else {
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'No se pudo ingresar.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function resolverConflicto(accion: AccionRubro | null) {
    const [actual, ...resto] = conflictos;
    if (!accion) {
      // La salida se ofrece sólo tras un fallo, y vale sólo para ese conflicto:
      // sin este reset el siguiente rubro de la cola la seguiría ofreciendo y
      // volvería a dejar carritos huérfanos sin que nada haya fallado.
      setFalloMigracion(false);
      setConflictos(resto);
      if (resto.length === 0) navigate(from ?? '/', { replace: true });
      return;
    }
    setError(null);
    setResolviendo(true);
    try {
      await migrarRubro(actual.idrubro, accion);
      setFalloMigracion(false);
      setConflictos(resto);
      if (resto.length === 0) navigate(from ?? '/', { replace: true });
    } catch (err) {
      // The guest cart for this rubro survives a failed migrarRubro (it only
      // clears once every line is confirmed), so keep the conflict on screen
      // instead of dropping it — the user can retry the same rubro.
      setFalloMigracion(true);
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
        <DialogoConflictoRubro
          conflicto={conflictos[0]}
          onElegir={resolverConflicto}
          ocupado={resolviendo}
          permitirCancelar={falloMigracion}
          etiquetaCancelar="Continuar sin integrar"
        />
      )}
    </div>
  );
}
