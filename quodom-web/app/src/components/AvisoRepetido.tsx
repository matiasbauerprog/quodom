import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Repetido } from '../quodom/repetirPedido';
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

  return (
    <div className="aviso-repetido" role="status">
      <span className="aviso-repetido-ok" aria-hidden="true">✓</span>
      <p className="aviso-repetido-texto">
        Repetiste <strong>{ultimo.nombre}</strong>: el pedido nuevo quedó en armado
        {ultimo.nombrerubro && <> en {ultimo.nombrerubro}</>}.
      </p>
      <Link
        className="aviso-repetido-ver"
        to={'/quodom?id=' + encodeURIComponent(ultimo.idquodom)}
        onClick={() => setUltimo(null)}
      >Ver pedido</Link>
      <button type="button" className="aviso-repetido-cerrar" aria-label="Cerrar aviso" onClick={() => setUltimo(null)}>×</button>
    </div>
  );
}
