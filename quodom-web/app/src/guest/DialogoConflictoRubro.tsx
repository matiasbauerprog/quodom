import { useEffect } from 'react';
import type { AccionRubro, ConflictoRubro } from './migrateGuestQuodom';
import { nombreRubro } from '../quodom/rubros';
import './DialogoConflictoRubro.css';

type Props = {
  conflicto: ConflictoRubro;
  onElegir: (accion: AccionRubro | null) => void;
  ocupado?: boolean;
};

export function DialogoConflictoRubro({ conflicto, onElegir, ocupado }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !ocupado) onElegir(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onElegir, ocupado]);

  function cerrar() {
    if (ocupado) return;
    onElegir(null);
  }

  function elegir(accion: AccionRubro | null) {
    if (ocupado) return;
    onElegir(accion);
  }

  return (
    <div className="dcr-backdrop" onClick={cerrar}>
      <section
        className="dcr card hoja"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dcr-titulo"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="dcr-titulo" className="dcr-titulo">Quodom de {nombreRubro(conflicto.idrubro)} ya abierto</h2>
        <p className="dcr-texto">
          Ya tenés un Quodom abierto de <strong>{nombreRubro(conflicto.idrubro)}</strong> ({conflicto.quodomExistente.nro},
          {' '}{conflicto.quodomExistente.cantproductos ?? 0} productos) y armaste {conflicto.lineasInvitado} producto(s) sin
          iniciar sesión.
        </p>
        <div className="dcr-acciones">
          <button type="button" className="btn btn-exito" onClick={() => elegir('integrar')} disabled={ocupado}>
            {ocupado ? 'Migrando…' : 'Integrar los dos'}
          </button>
          <button type="button" className="btn btn-peligro" onClick={() => elegir('reemplazar')} disabled={ocupado}>
            {ocupado ? 'Migrando…' : `Reemplazar — se descarta ${conflicto.quodomExistente.nro} entero`}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => elegir(null)} disabled={ocupado}>
            Ahora no
          </button>
        </div>
      </section>
    </div>
  );
}
