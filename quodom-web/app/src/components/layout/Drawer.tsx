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
          <NavLink to="/modo-ia" onClick={onClose}>Modo IA</NavLink>
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
