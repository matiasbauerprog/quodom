import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Category } from '../../api/types';
import { RubroIcon } from '../../components/icons/RubroIcon';

// Los rubros son links y no botones a propósito: cada selección queda en el
// historial, así que el Atrás del navegador funciona sin código, y andan el
// clic derecho y "abrir en pestaña nueva".
export function RubroSelector({ rubros, idSeleccionado }: { rubros: Category[]; idSeleccionado: number | null }) {
  // En celular, adentro de un rubro, los rubros son una fila que se desliza de
  // costado: el elegido puede quedar fuera de vista, y es el que dice dónde está
  // uno. En escritorio la grilla entra entera y esto no mueve nada.
  const grilla = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sel = grilla.current?.querySelector<HTMLElement>('.cat-card-sel');
    sel?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
  }, [idSeleccionado, rubros]);
  return (
    <div className="cat-grid" ref={grilla}>
      {rubros.map(c => {
        const elegido = c.id === idSeleccionado;
        return (
          <Link
            key={c.id}
            to={elegido ? '/' : '/?rubro=' + c.id}
            className={'cat-card' + (elegido ? ' cat-card-sel' : '')}
            aria-current={elegido ? 'page' : undefined}
          >
            <RubroIcon id={c.id} size={72} />
            <span className="cat-card-name">{c.nombrecategoria}</span>
          </Link>
        );
      })}
    </div>
  );
}
