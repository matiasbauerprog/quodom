import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Repetido } from '../quodom/repetirPedido';
import { ESTADO_VENTANA, PARAM_VENTANA, hrefVentana } from '../quodom/ventanaQuodom';
import './AvisoRepetido.css';

const DURA_MS = 6000;

/**
 * La prueba de que "Repetir" hizo algo. Va en el `Layout` y no en el panel
 * porque se repite desde la campana, el historial y las notificaciones, y en
 * celular el panel está plegado: el aviso tiene que verse esté donde esté.
 * Lleva al pedido nuevo, que es lo primero que uno quiere mirar.
 */
export function AvisoRepetido() {
  const [ultimo, setUltimo] = useState<Repetido | null>(null);
  const location = useLocation();
  useEffect(() => {
    const oir = (e: Event) => setUltimo((e as CustomEvent<Repetido>).detail);
    window.addEventListener('quodom:repetido', oir);
    return () => window.removeEventListener('quodom:repetido', oir);
  }, []);
  useEffect(() => {
    if (!ultimo) return;
    const t = setTimeout(() => setUltimo(null), DURA_MS);
    return () => clearTimeout(t);
  }, [ultimo]);
  if (!ultimo) return null;
  // Repetir ya abre el pedido nuevo: ahí el link abriría la misma ventana.
  const yaEsta = new URLSearchParams(location.search).get(PARAM_VENTANA) === ultimo.idquodom;

  return (
    <div className="aviso-repetido" role="status">
      <span className="aviso-repetido-ok" aria-hidden="true">✓</span>
      <p className="aviso-repetido-texto">
        Repetiste <strong>{ultimo.nombre}</strong>: el pedido nuevo quedó en armado
        {ultimo.nombrerubro && <> en {ultimo.nombrerubro}</>}.
      </p>
      {!yaEsta && (
        <Link
          className="aviso-repetido-ver"
          to={hrefVentana(location, ultimo.idquodom)}
          state={ESTADO_VENTANA}
          onClick={() => setUltimo(null)}
        >Ver pedido</Link>
      )}
      <button type="button" className="aviso-repetido-cerrar" aria-label="Cerrar aviso" onClick={() => setUltimo(null)}>×</button>
    </div>
  );
}
