import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Quodom, QuodomLine } from '../../api/types';
import { repetirPedido } from '../../quodom/repetirPedido';
import { useAbrirQuodom } from '../../quodom/ventanaQuodom';
import { quodomLines } from '../../api/quodom_lines';
import { DialogoProveedores } from '../../quodom/DialogoProveedores';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import './DialogoPedido.css';

type Props = {
  quodom: Quodom;
  onCerrar: () => void;
  /** Avisa qué Quodom nuevo salió de repetir, para que la lista lo acuse. */
  onRepetido?: (idquodom: string) => void;
};

function fecha(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-AR');
}

/**
 * Un pedido del historial, de **sólo lectura**.
 *
 * Se abre en una ventana y no navegando porque el historial es para mirar lo
 * que ya pasó: irse de la pantalla para ver un pedido y volver pierde el lugar
 * en la lista, y la pantalla de detalle es la de **editar**, que acá no va.
 *
 * Nada de esto se puede tocar: ni cantidad, ni quitar, ni elegir atributo. Un
 * pedido enviado ya lo recibió un proveedor que va a cotizar sobre lo que le
 * llegó; cambiarlo después dejaría al comprador creyendo que pidió otra cosa.
 *
 * Lo que ofrece un pedido **enviado** son dos caminos que no se pisan:
 *
 * - **Enviar a otro proveedor** no toca el pedido. Sigue `ENVIADO` y en el
 *   historial, y lo único que cambia es que se le suma un contactado. Es el
 *   caso normal: le mandé a uno, no me contestó, le mando a otro.
 * - **Volver a armado** crea un pedido **nuevo** con las mismas líneas y lo
 *   deja abierto en el árbol de su rubro — eso es "volver al sidebar". El
 *   enviado **no se revierte**: revertirlo borraría la notificación y el
 *   historial de algo que sí pasó.
 */
export function DialogoPedido({ quodom, onCerrar, onRepetido }: Props) {
  const navigate = useNavigate();
  const abrirQuodom = useAbrirQuodom();
  const [lineas, setLineas] = useState<QuodomLine[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selector, setSelector] = useState(false);
  const [repitiendo, setRepitiendo] = useState(false);

  const enviado = quodom.estado === 'ENVIADO';

  useEffect(() => {
    let vivo = true;
    setLineas(null); setErr(null);
    quodomLines.porQuodom(quodom.id)
      .then(l => { if (vivo) setLineas(l); })
      .catch(e => {
        if (!vivo) return;
        setErr(e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo leer el pedido.');
      });
    return () => { vivo = false; };
  }, [quodom.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !repitiendo) onCerrar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar, repitiendo]);

  function cerrar() {
    if (repitiendo) return;
    onCerrar();
  }

  async function volverAArmado() {
    if (repitiendo) return;
    setRepitiendo(true); setErr(null);
    try {
      // Queda abierto en su rubro: "volver al sidebar" es, concretamente, ser
      // el Quodom que ese rubro muestra desplegado y que recibe lo que se agrega.
      const id = await repetirPedido(quodom);
      onRepetido?.(id);
      onCerrar();
      abrirQuodom(id, { nombrar: true });
    } catch (e) {
      setErr(e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo repetir el pedido.');
    } finally { setRepitiendo(false); }
  }

  if (selector) {
    return (
      <DialogoProveedores
        idquodom={quodom.id}
        onCerrar={() => setSelector(false)}
      />
    );
  }

  const nombre = quodom.descripcion || quodom.nro;

  return (
    <div className="dpd-backdrop" onClick={cerrar}>
      <section
        className="dpd card hoja"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dpd-titulo"
        onClick={e => e.stopPropagation()}
      >
        <header className="dpd-cab">
          <p className="dpd-rubro">{quodom.nombrerubro}</p>
          <h2 id="dpd-titulo" className="dpd-titulo">{nombre}</h2>
          <p className="dpd-meta">
            {quodom.nro}
            {' · '}
            {enviado
              ? 'Enviado el ' + fecha(quodom.fechaenvio)
              : 'En armado · ' + (quodom.cantproductos ?? 0) + ' productos'}
          </p>
        </header>

        {err && <p className="dpd-err" role="alert">{err}</p>}

        {!err && !lineas && <Loader />}

        {lineas && (
          lineas.length === 0
            ? <p className="dpd-vacio">Este pedido no tiene productos.</p>
            : <ul className="dpd-lineas">
                {lineas.map(l => (
                  <li key={l.id} className="dpd-linea">
                    <span className="dpd-linea-nombre">{l.nombreProducto}</span>
                    <span className="dpd-linea-datos">
                      {l.cantidad}
                      {l.atributo1 && <> · {l.atributo1}</>}
                      {l.atributo2 && <> · {l.atributo2}</>}
                    </span>
                  </li>
                ))}
              </ul>
        )}

        <footer className="dpd-pie">
          {enviado ? (
            <>
              {/* No toca el pedido: le suma un proveedor contactado. */}
              <button type="button" className="btn dpd-otro" onClick={() => setSelector(true)}>
                Enviar a otro proveedor
              </button>
              {/* Crea uno nuevo; el enviado se queda como está. */}
              <button type="button" className="btn btn-ghost" disabled={repitiendo} onClick={volverAArmado}>
                {repitiendo ? 'Copiando…' : 'Volver a armado'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={() => { onCerrar(); navigate('/?rubro=' + quodom.idrubro); }}
            >
              Continuar en el rubro
            </button>
          )}
          <button type="button" className="btn btn-ghost dpd-cerrar" onClick={cerrar} disabled={repitiendo}>
            Cerrar
          </button>
        </footer>
      </section>
    </div>
  );
}
