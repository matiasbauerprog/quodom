import { useEffect, useState } from 'react';
import { quodomLines } from '../../api/quodom_lines';
import { Loader } from '../../components/Loader';
import './SelectorAtributo.css';

export function SelectorAtributo({
  idproducto, nombreatributo, valorActual, onSelect, onClose
}: {
  idproducto: number;
  nombreatributo: string;
  valorActual: string | null | undefined;
  onSelect: (valor: string) => void;
  onClose: () => void;
}) {
  const [opts, setOpts] = useState<string[] | null>(null);
  useEffect(() => {
    quodomLines.atributos(idproducto, nombreatributo)
      .then(list => setOpts(list.map(o => o.valoratributo)))
      .catch(() => setOpts([]));
  }, [idproducto, nombreatributo]);
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card card hoja" onClick={e => e.stopPropagation()}>
        <h3>{nombreatributo}</h3>
        {!opts && <Loader />}
        {opts && opts.length === 0 && <p>No hay valores disponibles.</p>}
        {opts && opts.length > 0 && (
          <ul className="attr-options">
            {opts.map(o => (
              <li key={o}>
                <button className={'btn ' + (o === valorActual ? '' : 'btn-ghost') + ' btn-block'} onClick={() => onSelect(o)}>{o}</button>
              </li>
            ))}
          </ul>
        )}
        <button className="btn btn-ghost btn-block" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
