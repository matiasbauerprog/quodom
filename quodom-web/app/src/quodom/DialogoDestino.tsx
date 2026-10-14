import { useEffect } from 'react';
import type { Quodom } from '../api/types';
import './DialogoDestino.css';

type Props = {
  nombreRubro: string;
  candidatos: Quodom[];
  onElegir: (idquodom: string) => void;
  onCrear: () => void;
  onCancelar: () => void;
  ocupado?: boolean;
  error?: string | null;
};

/**
 * Se pregunta una sola vez por rubro: lo que el usuario elija queda como el
 * Quodom abierto de ese rubro y los próximos "+" ya no vuelven a preguntar.
 */
export function DialogoDestino({ nombreRubro, candidatos, onElegir, onCrear, onCancelar, ocupado, error }: Props) {
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
    <div className="dd-backdrop" onClick={cerrar}>
      <section
        className="dd card hoja"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dd-titulo"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="dd-titulo" className="dd-titulo">¿A qué Quodom de {nombreRubro} lo sumás?</h2>
        <p className="dd-texto">
          Elegí uno y queda abierto: los próximos productos de {nombreRubro} van directo ahí.
        </p>
        <ul className="dd-lista">
          {candidatos.map(q => (
            <li key={q.id}>
              <button type="button" className="dd-opcion" onClick={() => onElegir(q.id)} disabled={ocupado}>
                <span className="dd-nombre">{q.descripcion}</span>
                <span className="dd-cant">{q.cantproductos ?? 0} {q.cantproductos === 1 ? 'producto' : 'productos'}</span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="dd-opcion dd-nuevo" onClick={onCrear} disabled={ocupado}>
              {ocupado ? 'Agregando…' : 'Un Quodom nuevo de ' + nombreRubro}
            </button>
          </li>
        </ul>
        {error && <p className="dd-error" role="alert">{error}</p>}
        <div className="dd-acciones">
          <button type="button" className="btn btn-ghost" onClick={cerrar} disabled={ocupado}>Cancelar</button>
        </div>
      </section>
    </div>
  );
}
