import { abiertoDe } from '../../quodom/quodomAbierto';
import type { ArrastreActivo } from '../../quodom/useArrastreActivo';
import type { RamaRubro } from './ArbolQuodoms';

/**
 * The compact drop target: under the tab of the closed desktop panel, and on
 * the mobile bottom bar while dragging. Each place brings its own class (the
 * desktop one only exists inside the desktop media query).
 * It goes to the open Quodom of the product's rubro — the same one `+` would
 * use — or, with none open, to a new one. It's only mounted where the tree is
 * not showing: there the tree has the real targets, and a hidden duplicate
 * would still be in the DOM. Being a `data-destino`/`data-nuevo` like the
 * tree's, the drop goes through the same path and the panel stays closed.
 */
export function DestinoCompacto({ arrastrando, ramas, className = 'mq-sidebar-soltar' }: {
  arrastrando: ArrastreActivo;
  ramas: RamaRubro[];
  className?: string;
}) {
  const { idrubro, nombreRubro } = arrastrando;
  const id = abiertoDe(idrubro);
  const abierto = ramas.find(r => r.idrubro === idrubro)?.quodoms.find(q => q.id === id);
  if (abierto) {
    return (
      <div className={className} data-destino={abierto.id} data-rubro={idrubro}>
        Soltá para sumar a <strong>{abierto.descripcion || abierto.nro}</strong>
      </div>
    );
  }
  return (
    <div className={className} data-nuevo={idrubro} data-rubro={idrubro}>
      Soltá para crear un Quodom de <strong>{nombreRubro}</strong>
    </div>
  );
}
