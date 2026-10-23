import { useEffect, useState } from 'react';
import type { RamaRubro } from './ArbolQuodoms';
import type { Agregado } from '../../quodom/agregarProducto';
import { nombreRubro } from '../../quodom/rubros';

/**
 * Says what went in and where, for a few seconds. Shared by the desktop panel
 * (floating under its header) and the mobile bottom bar (above it); `className`
 * replaces the class, so each place styles it (the desktop one only exists
 * inside the desktop media query).
 *
 * Closed, adding something — with +, the destination dialog or a drop — left
 * no trace on screen at all; open, the new line shows up in the tree but among
 * several rubros and Quodoms it doesn't register on its own (user's call).
 */
export function AvisoAgregado({ ramas, className = 'mq-sidebar-agregado' }: { ramas: RamaRubro[]; className?: string }) {
  // Varios seguidos al mismo destino (una selección de varios, o varios + a
  // la vez) se cuentan: nombrar sólo el último hacía parecer que había entrado uno.
  const [ultimo, setUltimo] = useState<(Agregado & { cantidad: number }) | null>(null);
  useEffect(() => {
    const oir = (e: Event) => {
      const nuevo = (e as CustomEvent<Agregado>).detail;
      setUltimo(antes => {
        const mismo = antes && antes.idrubro === nuevo.idrubro && antes.idquodom === nuevo.idquodom;
        return { ...nuevo, cantidad: mismo ? antes.cantidad + 1 : 1 };
      });
    };
    window.addEventListener('quodom:agregado', oir);
    return () => window.removeEventListener('quodom:agregado', oir);
  }, []);
  useEffect(() => {
    if (!ultimo) return;
    const t = setTimeout(() => setUltimo(null), 3500);
    return () => clearTimeout(t);
  }, [ultimo]);
  if (!ultimo) return null;

  const q = ramas.find(r => r.idrubro === ultimo.idrubro)?.quodoms.find(x => x.id === ultimo.idquodom);
  const destino = q
    ? q.descripcion || q.nro
    : ultimo.idquodom === null
      ? 'tu carrito de ' + nombreRubro(ultimo.idrubro)
      : 'tu Quodom de ' + nombreRubro(ultimo.idrubro);
  const varios = ultimo.cantidad > 1;
  const que = varios ? ultimo.cantidad + ' productos' : ultimo.nombre;
  return (
    <p className={className} role="status" aria-label={(varios ? 'Agregados: ' : 'Agregado: ') + que + ' a ' + destino}>
      <span className={className + '-ok'} aria-hidden="true">✓</span>
      <span><strong>{que}</strong> {varios ? 'agregados' : 'agregado'} a {destino}</span>
    </p>
  );
}
