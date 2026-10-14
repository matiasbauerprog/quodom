import { Link } from 'react-router-dom';
import type { Category } from '../../api/types';
import './SubcategoriaTabs.css';

/**
 * El lugar que van a ocupar las tabs mientras llegan. Antes acá iba un spinner
 * centrado: la fila colapsaba a nada y volvía a aparecer, y ese salto —más el
 * de la grilla de productos, que hacía lo mismo— se leía como que la página se
 * recargaba entera cada vez que se cambiaba de rubro.
 */
export function SubcategoriaTabsEsqueleto() {
  return (
    <div className="subtabs" aria-hidden="true">
      {[78, 104, 88, 116, 82].map((ancho, i) => (
        <span key={i} className="subtab subtab-esqueleto esqueleto" style={{ width: ancho }} />
      ))}
    </div>
  );
}

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
