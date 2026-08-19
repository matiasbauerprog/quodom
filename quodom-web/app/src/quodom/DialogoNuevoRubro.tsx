import { useEffect } from 'react';
import './DialogoNuevoRubro.css';

type Props = {
  nombreRubro: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  ocupado?: boolean;
};

export function DialogoNuevoRubro({ nombreRubro, onConfirmar, onCancelar, ocupado }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !ocupado) onCancelar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancelar, ocupado]);

  function cerrar() {
    if (ocupado) return;
    onCancelar();
  }

  return (
    <div className="dnr-backdrop" onClick={cerrar}>
      <section
        className="dnr card hoja"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dnr-titulo"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="dnr-titulo" className="dnr-titulo">Creá un Quodom de {nombreRubro}</h2>
        <p className="dnr-texto">
          Este producto es de <strong>{nombreRubro}</strong> y todavía no tenés un Quodom abierto de ese rubro.
          Cada Quodom lleva un solo rubro.
        </p>
        <div className="dnr-acciones">
          <button type="button" className="btn btn-ghost" onClick={cerrar} disabled={ocupado}>Cancelar</button>
          <button type="button" className="btn btn-exito" onClick={onConfirmar} disabled={ocupado}>
            {ocupado ? 'Creando…' : 'Crear Quodom de ' + nombreRubro}
          </button>
        </div>
      </section>
    </div>
  );
}
