import { useEffect, useState } from 'react';
import { productos } from '../../api/productos';
import type { Product } from '../../api/types';
import { ApiError } from '../../api/client';
import { ErrorState } from '../../components/ErrorState';
import { ProductImage } from '../../components/ProductImage';
import { IconoMas } from '../../components/icons/IconoMas';
import { useAuth } from '../../auth/AuthContext';
import { useAgregarProducto } from '../../quodom/useAgregarProducto';
import { DialogoDestino } from '../../quodom/DialogoDestino';
import { nombreRubro } from '../../quodom/rubros';
import { agregarADestino, crearYAgregar } from '../../quodom/agregarProducto';
import { iniciarArrastre, type Blanco } from '../../quodom/arrastre';
import { DetalleProducto } from './DetalleProducto';
import './ListaProductos.css';

/**
 * La grilla fantasma mientras cargan los productos. Misma forma y misma
 * cantidad que las tarjetas de verdad: el spinner que había antes colapsaba la
 * grilla a una línea, y ese salto en cada cambio de subcategoría o de rubro se
 * leía como que la página se recargaba entera.
 */
function GrillaEsqueleto() {
  return (
    <ul className="prod-list" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => (
        <li key={i} className="prod-item prod-item-esqueleto">
          <span className="prod-media esqueleto" />
          <span className="prod-linea esqueleto" />
          <span className="prod-linea prod-linea-corta esqueleto" />
        </li>
      ))}
    </ul>
  );
}

// Lo elegido por producto, sin persistir: es un borrador de la tarjeta hasta
// que se agrega la línea.
type Eleccion = { atributo1?: string; atributo2?: string };

export function ListaProductos({ idsubcategoria }: { idsubcategoria: number }) {
  const [prods, setProds] = useState<Product[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [elegido, setElegido] = useState<Record<number, Eleccion>>({});
  const [nonce, setNonce] = useState(0);
  const [errSoltar, setErrSoltar] = useState<string | null>(null);
  const { user } = useAuth();
  const { agregar: agregarLinea, agregando, error: errAgregar, destino, elegir: elegirDestino, pedirDestino, crear, cancelar } = useAgregarProducto();

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

  // Si la lista desaparece con el arrastre a medias, el fantasma y los oyentes
  // no tienen dueño: se le avisa al arrastre que termine sin soltar.
  useEffect(() => () => { window.dispatchEvent(new Event('arrastre:abortar')); }, []);

  function elegir(idproducto: number, slot: 1 | 2, valor: string) {
    setElegido(prev => {
      const actual = { ...(prev[idproducto] ?? {}) };
      const campo = slot === 1 ? 'atributo1' : 'atributo2';
      // La opción vacía es "no elegirlo": borra en vez de guardar ''.
      if (valor) actual[campo] = valor; else delete actual[campo];
      return { ...prev, [idproducto]: actual };
    });
  }

  function lineaDe(p: Product) {
    const { atributo1, atributo2 } = elegido[p.id] ?? {};
    return {
      idproducto: p.id,
      nombreProducto: p.nombreproducto,
      cantidad: 1,
      ...(atributo1 ? { atributo1 } : {}),
      ...(atributo2 ? { atributo2 } : {})
    };
  }

  // Mismo borrador de la tarjeta, pero sin tocar el Quodom abierto: pregunta a cuál.
  function agregarEnOtro(p: Product) {
    pedirDestino(lineaDe(p), p.categoriaPadre);
  }

  // La ficha del producto por el que está preguntando el diálogo. Acá el clic en
  // el producto abre ese diálogo, así que es el único lugar donde se puede ver
  // qué es el producto antes de mandarlo a algún lado. Con varias líneas
  // encoladas (varios "+" sin destino) no hay un producto que mostrar.
  function fichaDelDestino() {
    if (!destino || destino.items.length !== 1) return null;
    const linea = destino.items[0].line;
    const p = prods?.find(x => x.id === linea.idproducto);
    if (!p) return null;
    const conValor = (grupo?: string | null, valor?: string | null) =>
      grupo ? (valor ? grupo + ': ' + valor : grupo) : null;
    return {
      id: p.id,
      nombre: p.nombreproducto,
      descripcion: p.descripcion,
      atributos: [conValor(p.atributo1, linea.atributo1), conValor(p.atributo2, linea.atributo2)]
    };
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

  // Soltar la tarjeta en el árbol. El rubro ya lo validó el arrastre (otro rubro no
  // llega acá); lo que puede fallar es el servidor, y eso se muestra.
  async function soltarEn(p: Product, blanco: Blanco) {
    setErrSoltar(null);
    try {
      if (blanco.tipo === 'quodom') await agregarADestino(lineaDe(p), blanco.idrubro, blanco.idquodom);
      else await crearYAgregar(lineaDe(p), blanco.idrubro, 'Nuevo Quodom de ' + nombreRubro(blanco.idrubro));
    } catch (e) {
      setErrSoltar(e instanceof ApiError ? e.message : 'No se pudo agregar el producto.');
    }
  }

  function agarrar(ev: React.PointerEvent, p: Product) {
    // Sin sesión no hay Quodoms en el árbol a dónde soltar. Y un clic que nace en
    // un botón es del botón (+, los selectores): si no, dejarían de funcionar.
    if (!user) return;
    // La excepción es `.prod-info`: es un botón (abre el detalle) pero también casi
    // toda la tarjeta, y el umbral del arrastre deja pasar el clic.
    const boton = (ev.target as HTMLElement).closest('button, select, a, input');
    if (boton && !boton.classList.contains('prod-info')) return;
    iniciarArrastre(ev.nativeEvent, {
      idrubro: p.categoriaPadre,
      nombre: p.nombreproducto,
      nombreRubro: nombreRubro(p.categoriaPadre),
      onSoltar: blanco => { void soltarEn(p, blanco); }
    });
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
      {errSoltar && <p className="prods-add-error" role="alert">{errSoltar}</p>}
      {!err && !prods && <GrillaEsqueleto />}
      {prods && prods.length === 0 && <p className="prods-empty">No hay productos en esta subcategoría.</p>}
      {prods && prods.length > 0 && (
        <ul className="prod-list">
          {prods.map(p => (
            <li key={p.id} className="prod-item" onPointerDown={ev => agarrar(ev, p)} onDragStart={ev => ev.preventDefault()}>
              {/* Tocar el producto abre lo mismo que abría el "···": a qué Quodom
                  del rubro va. Un invitado no tiene nada que elegir —un carrito
                  por rubro—, así que para él el clic abre la ficha del producto.

                  Etiqueta explícita: sin ella el nombre accesible sale repetido,
                  porque adentro están el alt de la imagen y el texto. */}
              <button
                className="prod-info"
                aria-label={(user ? 'Elegir el Quodom de ' : 'Ver ') + p.nombreproducto}
                onClick={() => (user ? agregarEnOtro(p) : setSelected(p))}
              >
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
                <div className="prod-botones">
                  <button className="prod-add" aria-label={'Agregar ' + p.nombreproducto} disabled={agregando} onClick={() => agregar(p)}>
                    <IconoMas />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <DetalleProducto
          product={selected}
          onClose={() => setSelected(null)}
          onAdd={() => { agregar(selected); setSelected(null); }}
        />
      )}
      {destino && (
        <DialogoDestino
        nombreRubro={nombreRubro(destino.idrubro)}
        candidatos={destino.candidatos}
        producto={fichaDelDestino()}
        onElegir={elegirDestino}
        onCrear={crear}
          onCancelar={cancelar}
          ocupado={agregando}
          error={errAgregar}
        />
      )}
    </div>
  );
}
