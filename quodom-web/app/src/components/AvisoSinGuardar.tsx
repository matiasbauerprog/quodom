import { Link } from 'react-router-dom';
import './AvisoSinGuardar.css';

// Los carritos de invitado viven en localStorage: sobreviven a cerrar la
// pestaña, pero no salen de este navegador. El aviso dice eso y nada más —
// prometer que "se pierden al cerrar" sería falso.
export function AvisoSinGuardar({ onNavegar }: { onNavegar?: () => void }) {
  return (
    <div className="aviso-sin-guardar" role="status">
      <p className="aviso-sin-guardar-texto">
        <span aria-hidden="true">⚠ </span>
        Estos presupuestos se guardan sólo en este navegador. Si entrás desde otro
        dispositivo o borrás los datos del navegador, se pierden.
      </p>
      <Link to="/login" className="btn btn-block" onClick={onNavegar}>Ingresar para guardarlos</Link>
    </div>
  );
}
