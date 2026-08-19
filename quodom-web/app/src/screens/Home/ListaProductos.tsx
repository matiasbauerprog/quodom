import { useEffect, useState } from 'react';
import { productos } from '../../api/productos';
import type { Product } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { ProductImage } from '../../components/ProductImage';
import { useAgregarProducto } from '../../quodom/useAgregarProducto';
import { DialogoNuevoRubro } from '../../quodom/DialogoNuevoRubro';
import { nombreRubro } from '../../quodom/rubros';
import { DetalleProducto } from './DetalleProducto';
import './ListaProductos.css';

export function ListaProductos({ idsubcategoria }: { idsubcategoria: number }) {
  const [prods, setProds] = useState<Product[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [nonce, setNonce] = useState(0);
  const { agregar: agregarLinea, agregando, error: errAgregar, pendiente, confirmar, cancelar } = useAgregarProducto();

  useEffect(() => {
    let alive = true;
    setProds(null); setErr(null); setSelected(null);
    productos.porCategoria(idsubcategoria)
      .then(d => { if (alive) setProds(d); })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error.'); });
    // El guard descarta la respuesta de una subcategoría que el usuario ya
    // abandonó: sin esto una tab lenta pisa la lista de la tab siguiente.
    return () => { alive = false; };
  }, [idsubcategoria, nonce]);

  function agregar(p: Product) {
    // categoriaPadre es el rubro del producto, y el rubro es lo que decide en
    // qué Quodom entra la línea (spec 2026-08-18).
    agregarLinea(
      { idproducto: p.id, nombreProducto: p.nombreproducto, cantidad: 1, nombreAtributo1: p.atributo1 ?? undefined, nombreAtributo2: p.atributo2 ?? undefined },
      p.categoriaPadre
    );
  }

  return (
    <div className="prods">
      {err && <ErrorState message={err} onRetry={() => setNonce(n => n + 1)} />}
      {errAgregar && <p className="prods-add-error" role="alert">{errAgregar}</p>}
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
              <button className="prod-add" aria-label={'Agregar ' + p.nombreproducto} disabled={agregando} onClick={() => agregar(p)}>+</button>
            </li>
          ))}
        </ul>
      )}
      {selected && <DetalleProducto product={selected} onClose={() => setSelected(null)} onAdd={() => { agregar(selected); setSelected(null); }} />}
      {pendiente && (
        <DialogoNuevoRubro
          nombreRubro={nombreRubro(pendiente.idrubro)}
          onConfirmar={confirmar}
          onCancelar={cancelar}
          ocupado={agregando}
        />
      )}
    </div>
  );
}
