import { useNavigate } from 'react-router-dom';
import type { ResumenInvitado } from '../guest/resumenInvitado';
import './QuodomCard.css';
import './TarjetaQuodomInvitado.css';

// Un carrito de invitado con la misma forma que QuodomCard, pero sin el menú
// de acciones: repetir, eliminar y ocultar son operaciones del servidor y este
// Quodom todavía no existe ahí.
export function TarjetaQuodomInvitado({ resumen, expandido, onToggle }: {
  resumen: ResumenInvitado;
  expandido?: boolean;
  onToggle?: () => void;
}) {
  const navigate = useNavigate();
  const abrir = () => navigate('/quodom?rubro=' + resumen.idrubro);

  function activar() {
    if (onToggle) onToggle();
    else abrir();
  }

  return (
    <article
      className={'qc qc-sidebar qc-estado-creado qc-invitado' + (expandido ? ' qc-expandida' : '')}
      onClick={activar}
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activar(); }
      }}
      role="button"
      tabIndex={0}
      aria-expanded={onToggle ? !!expandido : undefined}
      aria-label={resumen.nombreRubro + ' · ' + resumen.descripcion}
    >
      <div className="qc-left">
        <div className="qc-rubro">
          {resumen.nombreRubro}
          <span className="qc-sin-guardar">sin guardar</span>
        </div>
        <div className="qc-nombre">{resumen.descripcion}</div>
      </div>

      <div className="qc-right">
        <div className="qc-estado-label qc-estado-creado-label">EN ARMADO</div>
        <div className="qc-detail">{resumen.cantproductos} productos</div>
        <button className="qc-action" onClick={e => { e.stopPropagation(); abrir(); }}>Continuar</button>
      </div>
    </article>
  );
}
