import { Link } from 'react-router-dom';
import './AppBar.css';

export function AppBar({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  return (
    <header className="appbar">
      <button className="appbar-hamburger" aria-label="Abrir menú" onClick={onOpenDrawer}>
        <span /><span /><span />
      </button>
      <Link to="/" className="appbar-brand">QUODOM</Link>
      <div className="appbar-actions">
        <Link to="/notificaciones" className="appbar-bell" aria-label="Notificaciones">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" /><path d="M9 17a3 3 0 0 0 6 0" /></svg>
        </Link>
      </div>
    </header>
  );
}
