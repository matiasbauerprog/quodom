import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { notificaciones } from '../../api/oper_notificaciones';
import './CampanitaNotificaciones.css';

export function CampanitaNotificaciones() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!user) { setCount(0); return; }
    let alive = true;
    const load = () => notificaciones.count().then(c => { if (alive) setCount(c); }).catch(() => {});
    load();
    const interval = window.setInterval(load, 60000);
    return () => { alive = false; window.clearInterval(interval); };
  }, [user]);
  return (
    <Link to="/notificaciones" className="campanita" aria-label={'Notificaciones' + (count > 0 ? ' (' + count + ' sin leer)' : '')}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" /><path d="M9 17a3 3 0 0 0 6 0" /></svg>
      {count > 0 && <span className="campanita-badge">{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}
