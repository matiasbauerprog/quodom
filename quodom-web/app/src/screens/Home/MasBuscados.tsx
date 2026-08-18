import { useEffect, useRef, useState } from 'react';
import { productos } from '../../api/productos';
import type { Product } from '../../api/types';
import { ProductImage } from '../../components/ProductImage';
import { useAgregarProducto } from '../../quodom/useAgregarProducto';
import './MasBuscados.css';

const POPULAR_IDS = [1, 20, 60, 137, 191, 447];

export function MasBuscados() {
  const [items, setItems] = useState<Product[]>([]);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState(0);
  const { agregar: agregarLinea, agregando, error: errAgregar } = useAgregarProducto();

  useEffect(() => {
    let alive = true;
    Promise.allSettled(POPULAR_IDS.map(id => productos.porId(id)))
      .then(results => {
        if (!alive) return;
        const ok = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<Product>).value);
        setItems(ok);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => {
      const cardWidth = el.querySelector('.mb-card')?.clientWidth ?? 1;
      setPage(Math.round(el.scrollLeft / (cardWidth + 12)));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [items.length]);

  function agregar(p: Product) {
    if (agregando) return;
    agregarLinea({ idproducto: p.id, nombreProducto: p.nombreproducto, cantidad: 1, nombreAtributo1: p.atributo1 ?? undefined, nombreAtributo2: p.atributo2 ?? undefined });
  }

  if (items.length === 0) return null;

  return (
    <section className="mb-section" aria-label="Mas buscados">
      <div className="mb-heading">
        <span className="mb-heading-line" aria-hidden="true" />
        <span className="mb-heading-text">Mas buscados</span>
        <span className="mb-heading-line" aria-hidden="true" />
      </div>
      {errAgregar && <p className="mb-add-error" role="alert">{errAgregar}</p>}
      <div className="mb-track" ref={trackRef}>
        {items.map(p => (
          <article key={p.id} className="mb-card card hoja" onClick={() => agregar(p)} role="button" tabIndex={0}>
            <div className="mb-card-img">
              <ProductImage idproducto={p.id} alt={p.nombreproducto} size="md" />
            </div>
            <div className="mb-card-text">
              <div className="mb-card-title">{p.nombreproducto}</div>
              {p.descripcion && <div className="mb-card-subtitle">{p.descripcion}</div>}
            </div>
          </article>
        ))}
      </div>
      <div className="mb-dots" aria-hidden="true">
        {Array.from({ length: Math.max(1, Math.ceil(items.length / 3)) }).map((_, i) => (
          <span key={i} className={'mb-dot' + (i === Math.floor(page / 3) ? ' mb-dot-active' : '')} />
        ))}
      </div>
    </section>
  );
}
