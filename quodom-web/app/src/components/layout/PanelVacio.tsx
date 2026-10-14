import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import './PanelVacio.css';

/**
 * Lo que muestran el panel derecho y la barra inferior cuando no hay nada en
 * armado: los tres pasos, no un aviso de que está vacío. No tener Quodoms es el
 * estado de quien recién llega, no un problema que haya que reportarle.
 *
 * Está compartido porque las dos superficies son el mismo panel en dos tamaños:
 * dos copias del mismo texto se despegan a la primera corrección.
 */
export function PanelVacio() {
  const { user } = useAuth();
  return (
    <div className="pv">
      <p className="pv-titulo">Armá tu primer Quodom</p>
      <ol className="pv-pasos">
        <li><span className="pv-n">1</span><span>Elegí un rubro en el catálogo.</span></li>
        <li><span className="pv-n">2</span><span>Tocá + en un producto para sumarlo.</span></li>
        <li><span className="pv-n">3</span><span>Cotizá el Quodom por WhatsApp.</span></li>
      </ol>
      {!user && <Link to="/login" className="btn btn-block pv-ingresar">Ingresar</Link>}
    </div>
  );
}
