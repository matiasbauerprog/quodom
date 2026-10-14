import type { ReactNode } from 'react';
import './TarjetaDestino.css';

/**
 * El Quodom que recibe lo que se agrega, como tarjeta blanca sobre el panel
 * oscuro; los otros del rubro quedan oscuros y compactos.
 *
 * Antes el destino se insinuaba con un verde tenue y no lo decía en ningún
 * lado: tres niveles (rubro, Quodom, producto) eran filas casi del mismo gris
 * y había que deducir cuál recibía el próximo `+`. El contraste hace el trabajo
 * que hacía la deducción, y el chip lo dice con palabras.
 *
 * `data-destino`/`data-rubro` van en la raíz y no en la cabecera: la tarjeta
 * abierta mide varias veces el alto de su cabecera, así que con los atributos
 * ahí arriba soltar un producto sobre las líneas no encontraba destino.
 */
export function TarjetaDestino({ nombre, chip, cuenta, onActivar, expandido, dataDestino, dataRubro, children }: {
  nombre: string;
  chip?: { texto: string; tono: 'ok' | 'alerta' };
  cuenta?: string;
  onActivar: () => void;
  /** Falta cuando la cabecera no pliega nada, sino que lleva a otra pantalla. */
  expandido?: boolean;
  dataDestino?: string;
  dataRubro?: number;
  children?: ReactNode;
}) {
  return (
    <article className="tq" data-destino={dataDestino} data-rubro={dataRubro}>
      <button
        type="button"
        className="tq-cab"
        aria-expanded={expandido}
        onClick={onActivar}
      >
        <span className="tq-titulo">
          <span className="tq-radio" aria-hidden="true" />
          <span className="tq-nombre">{nombre}</span>
          <span className="tq-chevron" aria-hidden="true">{expandido ? '⌃' : '→'}</span>
        </span>
        {(chip || cuenta) && (
          <span className="tq-meta">
            {chip && <span className={'tq-chip tq-chip-' + chip.tono}>{chip.texto}</span>}
            {cuenta && <span className="tq-cuenta">{cuenta}</span>}
          </span>
        )}
      </button>
      {children}
    </article>
  );
}
