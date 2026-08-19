import { Link } from 'react-router-dom';
import type { Category } from '../../api/types';
import { RubroIcon } from '../../components/icons/RubroIcon';

// Los rubros son links y no botones a propósito: cada selección queda en el
// historial, así que el Atrás del navegador funciona sin código, y andan el
// clic derecho y "abrir en pestaña nueva".
export function RubroSelector({ rubros, idSeleccionado }: { rubros: Category[]; idSeleccionado: number | null }) {
  return (
    <div className="cat-grid">
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
