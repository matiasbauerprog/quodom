import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { productos } from '../../api/productos';
import type { Product } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { AppBarBack } from '../../components/layout/AppBarBack';
import { ProductImage } from '../../components/ProductImage';
import { addGuestLine } from '../../guest/guestQuodom';
import { DetalleProducto } from './DetalleProducto';
import './ProductosPorCategoria.css';

export function ProductosPorCategoria() {
  const { id = '' } = useParams();
  const idCat = Number(id);
  const [prods, setProds] = useState<Product[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setProds(null); setErr(null);
    productos.porCategoria(idCat)
      .then(d => { if (alive) setProds(d); })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error.'); });
    return () => { alive = false; };
  }, [idCat, nonce]);

  function agregar(p: Product) {
    addGuestLine({ idproducto: p.id, nombreProducto: p.nombreproducto, cantidad: 1, nombreAtributo1: p.atributo1 ?? undefined, nombreAtributo2: p.atributo2 ?? undefined });
    window.dispatchEvent(new Event('quodom:changed'));
  }

  return (
    <>
      <AppBarBack title="Productos" />
      <section className="container prods">
        {err && <ErrorState message={err} onRetry={() => setNonce(n => n + 1)} />}
        {!err && !prods && <Loader />}
        {prods && prods.length === 0 && <p className="prods-empty">No hay productos en esta subcategoría.</p>}
        {prods && prods.length > 0 && (
          <ul className="prod-list">
            {prods.map(p => (
              <li key={p.id} className="prod-item">
                <button className="prod-info" onClick={() => setSelected(p)}>
                  <ProductImage idproducto={p.id} alt={p.nombreproducto} size="md" />
                  <span className="prod-name">{p.nombreproducto}</span>
                </button>
                <button className="prod-add" aria-label={'Agregar ' + p.nombreproducto} onClick={() => agregar(p)}>+</button>
              </li>
            ))}
          </ul>
        )}
        {selected && <DetalleProducto product={selected} onClose={() => setSelected(null)} onAdd={() => { agregar(selected); setSelected(null); }} />}
      </section>
    </>
  );
}
