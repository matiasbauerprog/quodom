import { useNavigate } from 'react-router-dom';
import type { Quodom } from '../../api/types';
export { repetirPedido, rutaRenombrar } from '../../quodom/repetirPedido';
import './AccionesNotificacion.css';

type Props = {
  q: Quodom;
  /** El id del que se está repitiendo, para deshabilitar los demás. */
  repitiendo: string | null;
  onRepetir: (q: Quodom) => void;
  /** El selector no se dibuja acá: quien lo use decide dónde montarlo. */
  onOtroProveedor: (q: Quodom) => void;
  /** Antes de navegar, para que la campana cierre su menú. */
  onAntesDeNavegar?: () => void;
};

/**
 * Lo que se puede hacer con el Quodom de una notificación. Lo comparten la
 * campana y la pantalla Notificaciones: antes la pantalla sólo listaba, y
 * "Ver todas" llevaba a un lugar donde no se podía hacer nada.
 */
export function AccionesNotificacion({ q, repitiendo, onRepetir, onOtroProveedor, onAntesDeNavegar }: Props) {
  const navigate = useNavigate();
  return (
    <div className="notq-acciones">
      <button
        type="button"
        aria-label="Ver en historial"
        title="Ver en historial"
        onClick={() => { onAntesDeNavegar?.(); navigate('/mis-quodoms?pedido=' + encodeURIComponent(q.id)); }}
      >Historial</button>
      <button
        type="button"
        aria-label="Repetir pedido"
        title="Repetir pedido: crea uno nuevo con los mismos productos"
        disabled={repitiendo !== null}
        onClick={() => onRepetir(q)}
      >{repitiendo === q.id ? 'Repitiendo…' : 'Repetir'}</button>
      {q.estado === 'ENVIADO' && (
        <button
          type="button"
          aria-label="Cotizar con otro proveedor"
          title="Cotizar con otro proveedor"
          onClick={() => onOtroProveedor(q)}
        >Otro proveedor</button>
      )}
    </div>
  );
}
