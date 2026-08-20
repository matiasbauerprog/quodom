import { useCallback, useEffect, useState } from 'react';
import { quodomLines } from '../../api/quodom_lines';
import type { QuodomLine } from '../../api/types';
import { ApiError } from '../../api/client';
import { getGuestCart, removeGuestLine, updateGuestLineCantidad } from '../../guest/guestQuodom';
import './LineasQuodomSidebar.css';

// Una línea, sin importar si vive en el servidor o en localStorage. El editor
// no necesita saber de dónde salió: sólo su nombre, su cantidad y qué atributo
// le falta para estar completa.
type Linea = {
  key: string;
  nombre: string;
  cantidad: number;
  faltaAtributo: string | null;
};

function faltante(l: QuodomLine): string | null {
  if (l.nombreAtributo1 && !l.atributo1) return l.nombreAtributo1;
  if (l.nombreAtributo2 && !l.atributo2) return l.nombreAtributo2;
  return null;
}

type Props =
  | { modo: 'servidor'; idquodom: string; onChange?: () => void }
  | { modo: 'invitado'; idrubro: number; onChange?: () => void };

export function LineasQuodomSidebar(props: Props) {
  const { onChange } = props;
  const [lineas, setLineas] = useState<Linea[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(false);

  const clave = props.modo === 'servidor' ? props.idquodom : String(props.idrubro);
  const modo = props.modo;

  useEffect(() => {
    if (modo === 'invitado') {
      const cart = getGuestCart(Number(clave));
      setLineas(cart.lines.map((l, i) => ({
        key: 'g-' + i,
        nombre: l.nombreProducto,
        cantidad: l.cantidad,
        faltaAtributo: l.nombreAtributo1 && !l.atributo1 ? l.nombreAtributo1
          : l.nombreAtributo2 && !l.atributo2 ? l.nombreAtributo2 : null
      })));
      return;
    }
    let alive = true;
    setLineas(null); setErr(null);
    quodomLines.porQuodom(clave)
      .then(d => {
        if (!alive) return;
        setLineas(d.map(l => ({
          key: String(l.id),
          nombre: l.nombreProducto,
          cantidad: l.cantidad,
          faltaAtributo: faltante(l)
        })));
      })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'No se pudieron cargar los productos.'); });
    return () => { alive = false; };
  }, [modo, clave, nonce]);

  // Las líneas también cambian desde afuera: agregar un producto del catálogo
  // pasa por agregarProducto, que avisa con `quodom:changed`. Sin esto la
  // lista abierta se quedaba con lo que había cuando la desplegaste, mientras
  // el contador de la tarjeta ya mostraba el producto nuevo.
  useEffect(() => {
    const recargar = () => setNonce(n => n + 1);
    window.addEventListener('quodom:changed', recargar);
    // Un carrito de invitado puede cambiar desde otra pestaña.
    window.addEventListener('storage', recargar);
    return () => {
      window.removeEventListener('quodom:changed', recargar);
      window.removeEventListener('storage', recargar);
    };
  }, []);

  // Avisar alcanza para recargar: el efecto de arriba escucha el mismo evento,
  // así que no hace falta subir el nonce por separado.
  const recargar = useCallback(() => {
    window.dispatchEvent(new Event('quodom:changed'));
    onChange?.();
  }, [onChange]);

  async function mutar(fn: () => Promise<unknown> | void) {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      await fn();
      recargar();
    } catch (e) {
      setErr(e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo guardar el cambio.');
    } finally { setBusy(false); }
  }

  function cambiarCantidad(l: Linea, index: number, cantidad: number) {
    if (modo === 'invitado') {
      // updateGuestLineCantidad ya borra la línea cuando la cantidad llega a 0.
      mutar(() => updateGuestLineCantidad(Number(clave), index, cantidad));
      return;
    }
    // El backend no acepta cantidad 0: bajar de 1 es quitar el producto.
    if (cantidad <= 0) mutar(() => quodomLines.eliminar(Number(l.key)));
    else mutar(() => quodomLines.update(Number(l.key), { cantidad }));
  }

  function quitar(l: Linea, index: number) {
    if (modo === 'invitado') mutar(() => removeGuestLine(Number(clave), index));
    else mutar(() => quodomLines.eliminar(Number(l.key)));
  }

  if (err && !lineas) return <p className="lqs-err" role="alert">{err}</p>;
  if (!lineas) return <p className="lqs-cargando">Cargando productos…</p>;
  if (lineas.length === 0) return <p className="lqs-vacio">Todavía no tiene productos.</p>;

  return (
    <>
      {err && <p className="lqs-err" role="alert">{err}</p>}
      <ul className="lqs-lista">
        {lineas.map((l, i) => (
          <li key={l.key} className="lqs-linea">
            <span className="lqs-nombre">
              {l.nombre}
              {l.faltaAtributo && <span className="lqs-falta">Falta elegir {l.faltaAtributo}</span>}
            </span>
            <span className="lqs-controles">
              <button
                type="button"
                className="lqs-btn"
                aria-label={'Restar ' + l.nombre}
                disabled={busy}
                onClick={() => cambiarCantidad(l, i, l.cantidad - 1)}
              >−</button>
              <span className="lqs-cant">{l.cantidad}</span>
              <button
                type="button"
                className="lqs-btn"
                aria-label={'Sumar ' + l.nombre}
                disabled={busy}
                onClick={() => cambiarCantidad(l, i, l.cantidad + 1)}
              >+</button>
              <button
                type="button"
                className="lqs-btn lqs-quitar"
                aria-label={'Quitar ' + l.nombre}
                disabled={busy}
                onClick={() => quitar(l, i)}
              >×</button>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
