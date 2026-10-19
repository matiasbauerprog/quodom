import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { quodom as quodomApi } from '../../api/quodom';
import { Logo } from '../Logo';
import './Drawer.css';

/**
 * Cuántos pedidos ya se enviaron.
 *
 * Es la referencia de que un Quodom **pasó al historial**: al cotizar, el
 * backend lo pasa a `ENVIADO` y el árbol lo pierde, pero hasta acá nada decía
 * adónde fue. En escritorio el menú está siempre a la vista, así que el árbol
 * pierde uno y el historial gana uno en el mismo momento.
 *
 * Tiene su propia consulta, como la campanita: `useQuodomsEnArmado` ya corre
 * dos veces (panel derecho y barra inferior) y una tercera copia del mismo
 * estado es peor que un pedido más a nuestra propia API. Escucha
 * `quodom:changed`, que es el mismo evento con el que se entera el árbol: sin
 * eso la cuenta queda vieja justo en el momento que importa.
 *
 * Si la consulta falla la cuenta no se muestra y el menú sigue siendo un menú:
 * un número es un adorno al lado de la única forma de navegar la app.
 */
function useEnviados(userId: string | undefined): number {
  const [enviados, setEnviados] = useState(0);

  useEffect(() => {
    if (!userId) { setEnviados(0); return; }
    let vivo = true;
    const contar = () => {
      quodomApi.misQuodom()
        .then(l => { if (vivo) setEnviados(l.filter(q => q.estado === 'ENVIADO').length); })
        .catch(() => {});
    };
    contar();
    window.addEventListener('quodom:changed', contar);
    return () => {
      vivo = false;
      window.removeEventListener('quodom:changed', contar);
    };
  }, [userId]);

  return enviados;
}

export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, signout } = useAuth();
  const enviados = useEnviados(user?.id);
  return (
    <>
      {open && <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside className={'drawer' + (open ? ' drawer-open' : '')} aria-hidden={!open}>
        <div className="drawer-header">
          <Logo className="drawer-brand" />
          {user && <span className="drawer-user">{user.nombre}</span>}
        </div>
        <nav className="drawer-nav">
          <NavLink to="/" end onClick={onClose}>Inicio</NavLink>
          {/* "Buscar" salió del menú (2026-09-22): el buscador del home, que
              muestra resultados mientras se escribe, es la entrada a lo mismo.
              La pantalla, su ruta /busqueda y api/busqueda.ts siguen vivos y con
              sus tests — el home los usa, y esta entrada vuelve descomentando
              esta línea y el test de Drawer.test.tsx. */}
          {/* <NavLink to="/busqueda" onClick={onClose}>Buscar</NavLink> */}
          {user && (
            <NavLink to="/mis-quodoms" onClick={onClose}>
              Historial de pedidos
              {/* En gris y no en rojo: en este panel un círculo rojo ya se leyó
                  una vez como alerta, y acá no hay nada que atender. */}
              {enviados > 0 && (
                <span className="drawer-cuenta" aria-label={'(' + enviados + ' enviados)'}>
                  {enviados > 99 ? '99+' : enviados}
                </span>
              )}
            </NavLink>
          )}
          {user && <NavLink to="/perfil" onClick={onClose}>Perfil</NavLink>}
          {user && <NavLink to="/direcciones" onClick={onClose}>Direcciones</NavLink>}
          {user && <NavLink to="/notificaciones" onClick={onClose}>Notificaciones</NavLink>}
        </nav>
        <div className="drawer-footer">
          {user
            ? <button className="btn btn-ghost btn-block" onClick={() => { signout(); onClose(); }}>Cerrar sesión</button>
            : <NavLink to="/login" className="btn btn-block" onClick={onClose}>Ingresar</NavLink>}
        </div>
      </aside>
    </>
  );
}
