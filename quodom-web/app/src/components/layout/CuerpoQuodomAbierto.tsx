import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Quodom } from '../../api/types';
import { LineasQuodomSidebar } from './LineasQuodomSidebar';
import { bloqueoDeEnvio, conFaltaConcreta, type FaltaAtributo } from '../../quodom/bloqueosEnvio';
import './CuerpoQuodomAbierto.css';

/**
 * Lo que se ve adentro del Quodom abierto del árbol: sus líneas y el pie para
 * cotizarlo. Lo usan el panel de escritorio y la hoja de celular, que antes no
 * lo tenía y mostraba el Quodom abierto vacío.
 *
 * El selector de proveedores no vive acá sino en quien monta el árbol
 * (`onCotizar`): el envío pasa el Quodom a ENVIADO y lo saca del árbol, y
 * dibujado adentro el diálogo se desmontaría a mitad de camino.
 */
export function CuerpoQuodomAbierto({ q, tieneDireccion, onCambio, onCotizar }: {
  q: Quodom;
  tieneDireccion: boolean;
  onCambio: () => void;
  onCotizar: (q: Quodom) => void;
}) {
  // Qué línea frena el envío, para nombrarla en el motivo. La reporta la lista,
  // que es la única que tiene las líneas.
  const [falta, setFalta] = useState<FaltaAtributo | null>(null);
  // El bloqueo lo decide el resumen (es el que coincide con lo que va a
  // contestar el backend); las líneas sólo le ponen nombre.
  const bloqueo = conFaltaConcreta(bloqueoDeEnvio(q, tieneDireccion), falta);
  return (
    <>
      <LineasQuodomSidebar
        modo="servidor"
        idquodom={q.id}
        onChange={onCambio}
        onFalta={f => setFalta(antes =>
          antes?.producto === f?.producto && antes?.atributo === f?.atributo ? antes : f)}
      />
      <div className="mq-sidebar-enviar">
        {bloqueo ? (
          <p className="mq-sidebar-motivo">
            <span className="mq-sidebar-icono" aria-hidden="true">!</span>
            <span>
              {bloqueo.texto}{' '}
              {bloqueo.motivo === 'direccion'
                ? <Link to="/direcciones/nuevo">{bloqueo.accion}</Link>
                : <span>{bloqueo.accion}</span>}
            </span>
          </p>
        ) : (
          <p className="mq-sidebar-motivo mq-sidebar-motivo-listo">
            <span className="mq-sidebar-icono mq-sidebar-icono-ok" aria-hidden="true">✓</span>
            <span>Listo para pedir presupuesto.</span>
          </p>
        )}
        <button
          type="button"
          className="btn btn-block btn-whatsapp"
          disabled={!!bloqueo}
          onClick={() => { if (!bloqueo) onCotizar(q); }}
        >
          Cotizar por WhatsApp
        </button>
      </div>
    </>
  );
}
