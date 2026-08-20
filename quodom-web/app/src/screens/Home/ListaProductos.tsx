import { useEffect, useState } from 'react';
import { productos } from '../../api/productos';
import type { Product } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { ProductImage } from '../../components/ProductImage';
import { IconoMas } from '../../components/icons/IconoMas';
import { useAgregarProducto } from '../../quodom/useAgregarProducto';
import { DialogoNuevoRubro } from '../../quodom/DialogoNuevoRubro';
import { nombreRubro } from '../../quodom/rubros';
import { DetalleProducto } from './DetalleProducto';
import './ListaProductos.css';

// Lo elegido por producto, sin persistir: es un borrador de la tarjeta hasta
// que se agrega la línea.
type Eleccion = { atributo1?: string; atributo2?: string };

export function ListaProductos({ idsubcategoria }: { idsubcategoria: number }) {
  const [prods, setProds] = useState<Product[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [elegido, setElegido] = useState<Record<number, Eleccion>>({});
  const [nonce, setNonce] = useState(0);
  const { agregar: agregarLinea, agregando, error: errAgregar, pendiente, confirmar, cancelar } = useAgregarProducto();

  useEffect(() => {
    let alive = true;
    setProds(null); setErr(null); setSelected(null); setElegido({});
    productos.porCategoria(idsubcategoria)
      .then(d => { if (alive) setProds(d); })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error.'); });
    // El guard descarta la respuesta de una subcategoría que el usuario ya
    // abandonó: sin esto una tab lenta pisa la lista de la tab siguiente.
    return () => { alive = false; };
  }, [idsubcategoria, nonce]);

  function elegir(idproducto: number, slot: 1 | 2, valor: string) {
    setElegido(prev => {
      const actual = { ...(prev[idproducto] ?? {}) };
      const campo = slot === 1 ? 'atributo1' : 'atributo2';
      // La opción vacía es "no elegirlo": borra en vez de guardar ''.
      if (valor) actual[campo] = valor; else delete actual[campo];
      return { ...prev, [idproducto]: actual };
    });
  }

  function agregar(p: Product) {
    // categoriaPadre es el rubro del producto, y el rubro es lo que decide en
    // qué Quodom entra la línea (spec 2026-08-18). Los atributos son
    // opcionales: sin elegir, la línea va sin ellos y se completa después
    // desde el detalle del Quodom.
    const { atributo1, atributo2 } = elegido[p.id] ?? {};
    agregarLinea(
      {
        idproducto: p.id,
        nombreProducto: p.nombreproducto,
        cantidad: 1,
        ...(atributo1 ? { atributo1 } : {}),
        ...(atributo2 ? { atributo2 } : {})
      },
      p.categoriaPadre
    );
  }

  function selector(p: Product, slot: 1 | 2) {
    const nombre = slot === 1 ? p.atributo1 : p.atributo2;
    const valores = slot === 1 ? p.valoresAtributo1 : p.valoresAtributo2;
    if (!nombre || !valores || valores.length === 0) return null;
    const valor = (slot === 1 ? elegido[p.id]?.atributo1 : elegido[p.id]?.atributo2) ?? '';
    return (
      <select
        className={'prod-attr' + (valor ? '' : ' prod-attr-vacio')}
        aria-label={nombre + ' de ' + p.nombreproducto}
        value={valor}
        onChange={e => elegir(p.id, slot, e.target.value)}
      >
        <option value="">{nombre}</option>
        {valores.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
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
                <span className="prod-media">
                  <ProductImage idproducto={p.id} alt={p.nombreproducto} size="md" />
                </span>
                <span className="prod-name">{p.nombreproducto}</span>
              </button>
              <div className="prod-foot">
                <div className="prod-attrs">
                  {selector(p, 1)}
                  {selector(p, 2)}
                </div>
                <button className="prod-add" aria-label={'Agregar ' + p.nombreproducto} disabled={agregando} onClick={() => agregar(p)}>
                  <IconoMas />
                </button>
              </div>
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
