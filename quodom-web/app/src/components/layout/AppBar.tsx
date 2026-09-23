import { Link, useLocation, useSearchParams } from 'react-router-dom';
import './AppBar.css';

export function AppBar({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  // El wordmark grande del home se esconde al elegir un rubro. Cuando no está
  // él, la marca aparece acá en chico, y de paso es el camino de vuelta al
  // inicio desde cualquier pantalla. En el home pelado sobra: ya está el grande.
  const enHomePelado = pathname === '/' && !params.get('rubro');

  return (
    <header className="appbar">
      <button className="appbar-hamburger" aria-label="Abrir menú" onClick={onOpenDrawer}>
        <span /><span /><span />
      </button>
      {!enHomePelado && (
        <Link to="/" className="appbar-marca" aria-label="Volver al inicio">QUODOM</Link>
      )}
    </header>
  );
}
