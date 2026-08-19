import { Link } from 'react-router-dom';
import type { Category } from '../../api/types';
import './SubcategoriaTabs.css';

export function SubcategoriaTabs({ idrubro, subs, idSeleccionada }: { idrubro: number; subs: Category[]; idSeleccionada: number | null }) {
  return (
    <nav className="subtabs" aria-label="Subcategorías">
      {subs.map(s => {
        const elegida = s.id === idSeleccionada;
        return (
          <Link
            key={s.id}
            to={'/?rubro=' + idrubro + '&sub=' + s.id}
            className={'subtab' + (elegida ? ' subtab-sel' : '')}
            aria-current={elegida ? 'page' : undefined}
          >
            {s.nombrecategoria}
          </Link>
        );
      })}
    </nav>
  );
}
