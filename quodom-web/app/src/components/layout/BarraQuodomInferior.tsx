import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { quodom as quodomApi } from '../../api/quodom';
import { guestLineCount } from '../../guest/guestQuodom';
import './BarraQuodomInferior.css';

export function BarraQuodomInferior() {
  const { user } = useAuth();
  const [count, setCount] = useState<number>(0);
  const [activoId, setActivoId] = useState<string | null>(null);

  // Guests count the localStorage lines; with a session the Quodom lives on the
  // server, so the count comes from the active (still 'CREADO') Quodom.
  const refrescar = useCallback(async () => {
    if (!user) {
      setActivoId(null);
      setCount(guestLineCount());
      return;
    }
    try {
      const lista = await quodomApi.misQuodom();
      const activo = lista.find(q => q.estado === 'CREADO') ?? null;
      setActivoId(activo?.id ?? null);
      setCount(activo?.cantproductos ?? 0);
    } catch {
      setCount(0);
    }
  }, [user]);

  useEffect(() => {
    let alive = true;
    const onChanged = () => { if (alive) refrescar(); };
    onChanged();
    window.addEventListener('quodom:changed', onChanged);
    window.addEventListener('storage', onChanged);
    return () => {
      alive = false;
      window.removeEventListener('quodom:changed', onChanged);
      window.removeEventListener('storage', onChanged);
    };
  }, [refrescar]);

  if (count === 0) return null;
  return (
    <Link to={activoId ? '/quodom?id=' + encodeURIComponent(activoId) : '/quodom'} className="barra-quodom">
      <span className="barra-quodom-count">{count}</span>
      <span className="barra-quodom-label">Ver mi Quodom</span>
      <span className="barra-quodom-arrow">›</span>
    </Link>
  );
}
