import { Link } from 'react-router-dom';
import type { ListaNoEncontrado } from '../../api/lista';

export function NoEncontrados({ items }: { items: ListaNoEncontrado[] }) {
  if (items.length === 0) return null;
  return (
    <section className="ne card hoja" aria-labelledby="ne-titulo">
      <h2 id="ne-titulo" className="ne-titulo">No encontré {items.length === 1 ? 'este ítem' : 'estos ítems'}</h2>
      <ul className="ne-lista">
        {items.map((it, i) => (
          <li key={i} className="ne-item">
            <strong>{it.textoOriginal}</strong>
            {it.motivo ? <span className="ne-motivo">{it.motivo}</span> : null}
          </li>
        ))}
      </ul>
      <p className="ne-ayuda">
        Probá <Link to="/busqueda">buscarlos a mano</Link> por si están con otro nombre.
      </p>
    </section>
  );
}
