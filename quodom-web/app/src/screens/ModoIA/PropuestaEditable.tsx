import { useState } from 'react';
import type { IaProposalItem } from '../../api/ia';

export function PropuestaEditable({
  items: initial,
  onConfirm,
  busy = false
}: {
  items: IaProposalItem[];
  onConfirm: (items: IaProposalItem[]) => void;
  busy?: boolean;
}) {
  const [items, setItems] = useState<IaProposalItem[]>(initial);

  function setCantidad(idx: number, cantidad: number) {
    setItems(items.map((it, i) => i === idx ? { ...it, cantidad: Math.max(1, cantidad) } : it));
  }
  function remove(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  return (
    <article className="mia-proposal">
      <ul className="mia-proposal-list">
        {items.map((it, idx) => (
          <li key={it.idproducto} className="mia-proposal-item">
            <div className="mia-proposal-name">
              <strong>{it.nombreProducto}</strong>
              {it.motivo ? <span className="mia-proposal-motivo">{it.motivo}</span> : null}
            </div>
            <div className="mia-proposal-qty">
              <button type="button" aria-label={'Quitar uno de ' + it.nombreProducto} onClick={() => setCantidad(idx, it.cantidad - 1)}>−</button>
              <input
                type="number"
                min={1}
                aria-label={'Cantidad de ' + it.nombreProducto}
                value={it.cantidad}
                onChange={e => setCantidad(idx, Number(e.target.value) || 1)}
              />
              <button type="button" aria-label={'Sumar uno a ' + it.nombreProducto} onClick={() => setCantidad(idx, it.cantidad + 1)}>+</button>
              <button type="button" aria-label={'Quitar ' + it.nombreProducto} className="mia-proposal-remove" onClick={() => remove(idx)}>×</button>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn-exito"
        disabled={busy || items.length === 0}
        onClick={() => onConfirm(items)}
      >
        {busy ? 'Agregando…' : 'Agregar al Quodom'}
      </button>
    </article>
  );
}
