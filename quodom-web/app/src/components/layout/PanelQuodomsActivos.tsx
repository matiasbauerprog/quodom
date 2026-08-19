import { Link } from 'react-router-dom';
import type { Quodom } from '../../api/types';
import { nombreRubro } from '../../quodom/rubros';
import './PanelQuodomsActivos.css';

export type ItemActivo = {
  key: string;
  to: string;
  nombreRubro: string;
  descripcion: string;
  cantproductos: number;
  // Un carrito que todavía sólo existe en localStorage.
  sinGuardar?: boolean;
};

export function PanelQuodomsActivos({ items, onNavegar }: { items: ItemActivo[]; onNavegar: () => void }) {
  return (
    <ul className="pqa-list" aria-label="Quodoms activos">
      {items.map(it => (
        <li key={it.key} className="pqa-item">
          <Link to={it.to} className="pqa-link" onClick={onNavegar}>
            <span className="pqa-rubro">{it.nombreRubro}</span>
            {it.sinGuardar && <span className="pqa-sin-guardar">sin guardar</span>}
            <span className="pqa-desc">{it.descripcion}</span>
            <span className="pqa-cant">{it.cantproductos}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function quodomsAItems(list: Quodom[]): ItemActivo[] {
  return list
    .filter(q => q.estado === 'CREADO')
    .map(q => ({
      key: q.id,
      to: '/quodom?id=' + encodeURIComponent(q.id),
      nombreRubro: q.nombrerubro || nombreRubro(q.idrubro),
      descripcion: q.descripcion,
      cantproductos: q.cantproductos ?? 0
    }));
}
