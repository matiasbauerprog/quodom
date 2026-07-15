import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { guestLineCount } from '../../guest/guestQuodom';
import './BarraQuodomInferior.css';

export function BarraQuodomInferior() {
  const [count, setCount] = useState<number>(() => guestLineCount());
  useEffect(() => {
    const onChanged = () => setCount(guestLineCount());
    window.addEventListener('quodom:changed', onChanged);
    window.addEventListener('storage', onChanged);
    return () => {
      window.removeEventListener('quodom:changed', onChanged);
      window.removeEventListener('storage', onChanged);
    };
  }, []);
  if (count === 0) return null;
  return (
    <Link to="/quodom" className="barra-quodom">
      <span className="barra-quodom-count">{count}</span>
      <span className="barra-quodom-label">Ver mi Quodom</span>
      <span className="barra-quodom-arrow">›</span>
    </Link>
  );
}
