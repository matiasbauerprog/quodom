import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import './Drawer.css';

export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, signout } = useAuth();
  return (
    <>
      {open && <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside className={'drawer' + (open ? ' drawer-open' : '')} aria-hidden={!open}>
        <div className="drawer-header">
          <span className="drawer-brand">QUODOM</span>
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
          {user && <NavLink to="/mis-quodoms" onClick={onClose}>Mis Quodoms</NavLink>}
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
