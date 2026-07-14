import { Link } from 'react-router-dom';
import { CampanitaNotificaciones } from '../Notificaciones/CampanitaNotificaciones';
import './AppBar.css';

export function AppBar({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  return (
    <header className="appbar">
      <button className="appbar-hamburger" aria-label="Abrir menú" onClick={onOpenDrawer}>
        <span /><span /><span />
      </button>
      <Link to="/" className="appbar-brand">QUODOM</Link>
      <div className="appbar-actions">
        <CampanitaNotificaciones />
      </div>
    </header>
  );
}
