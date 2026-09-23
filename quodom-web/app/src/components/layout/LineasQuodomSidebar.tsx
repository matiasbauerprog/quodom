import { useCallback, useEffect, useState } from 'react';
import { quodomLines } from '../../api/quodom_lines';
import { ApiError } from '../../api/client';
import { getGuestCart, removeGuestLine, updateGuestLineAtributos, updateGuestLineCantidad } from '../../guest/guestQuodom';
import { SelectorAtributo } from '../../screens/Quodom/SelectorAtributo';
import './LineasQuodomSidebar.css';

// Una línea, sin importar si vive en el servidor o en localStorage. El editor
// no necesita saber de dónde salió: sólo su nombre, su cantidad y qué atributo
// le falta para estar completa.
type Linea = {
  key: string;
  nombre: string;
  cantidad: number;
  idproducto: number;
  // El nombre del grupo que falta y en qué ranura va: para poder guardarlo hay
  // que saber si es atributo1 o atributo2, no alcanza con el nombre.
  faltaAtributo: string | null;
  slotFaltante: 1 | 2 | null;
};

function faltante(l: { nombreAtributo1?: string | null; atributo1?: string | null; nombreAtributo2?: string | null; atributo2?: string | null }) {
  if (l.nombreAtributo1 && !l.atributo1) return { nombre: l.nombreAtributo1, slot: 1 as const };
  if (l.nombreAtributo2 && !l.atributo2) return { nombre: l.nombreAtributo2, slot: 2 as const };
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
  const [eligiendo, setEligiendo] = useState<{ linea: Linea; index: number; nombre: string; slot: 1 | 2 } | null>(null);

  const clave = props.modo === 'servidor' ? props.idquodom : String(props.idrubro);
  const modo = props.modo;

  useEffect(() => {
    if (modo === 'invitado') {
      const cart = getGuestCart(Number(clave));
      setLineas(cart.lines.map((l, i) => {
        const falta = faltante(l);
        return {
          key: 'g-' + i,
          nombre: l.nombreProducto,
          cantidad: l.cantidad,
          idproducto: l.idproducto,
          faltaAtributo: falta ? falta.nombre : null,
          slotFaltante: falta ? falta.slot : null
        };
      }));
      return;
    }
    let alive = true;
    setLineas(null); setErr(null);
    quodomLines.porQuodom(clave)
      .then(d => {
        if (!alive) return;
        setLineas(d.map(l => {
          const falta = faltante(l);
          return {
            key: String(l.id),
            nombre: l.nombreProducto,
            cantidad: l.cantidad,
            idproducto: l.idproducto,
            faltaAtributo: falta ? falta.nombre : null,
            slotFaltante: falta ? falta.slot : null
          };
        }));
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

  // Elegir el atributo que falta sin salir del sidebar: hasta ahora la línea
  // avisaba "Falta elegir LITROS" y para resolverlo había que abrir el detalle
  // del Quodom. Es el mismo selector que usa esa pantalla.
  function guardarAtributo(valor: string) {
    if (!eligiendo) return;
    const { linea, index, slot } = eligiendo;
    const patch = slot === 1 ? { atributo1: valor } : { atributo2: valor };
    setEligiendo(null);
    if (modo === 'invitado') mutar(() => updateGuestLineAtributos(Number(clave), index, patch));
    else mutar(() => quodomLines.update(Number(linea.key), patch));
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
              {l.faltaAtributo && l.slotFaltante && (
                <button
                  type="button"
                  className="lqs-falta"
                  disabled={busy}
                  onClick={() => setEligiendo({ linea: l, index: i, nombre: l.faltaAtributo!, slot: l.slotFaltante! })}
                >
                  Elegir {l.faltaAtributo}
                </button>
              )}
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

      {eligiendo && (
        <SelectorAtributo
          idproducto={eligiendo.linea.idproducto}
          nombreatributo={eligiendo.nombre}
          valorActual={null}
          onSelect={guardarAtributo}
          onClose={() => setEligiendo(null)}
        />
      )}
    </>
  );
}
