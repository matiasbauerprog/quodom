import { useEffect, useRef, useState, type ReactNode } from 'react';
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
 *
 * Con `onRenombrar`, un lápiz al lado del nombre lo vuelve editable en el
 * lugar (lo pidió el usuario: cambiarlo obligaba a abrir el detalle). El lápiz
 * va **afuera** del botón de la cabecera: un campo no puede vivir adentro de un
 * botón, y tocar el nombre tiene que seguir plegando como siempre.
 */
export function TarjetaDestino({ nombre, chip, cuenta, onActivar, expandido, dataDestino, dataRubro, onRenombrar, children }: {
  nombre: string;
  chip?: { texto: string; tono: 'ok' | 'alerta' };
  cuenta?: string;
  onActivar: () => void;
  /** Falta cuando la cabecera no pliega nada, sino que lleva a otra pantalla. */
  expandido?: boolean;
  dataDestino?: string;
  dataRubro?: number;
  onRenombrar?: (nuevo: string) => Promise<void> | void;
  children?: ReactNode;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(nombre);
  const [err, setErr] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  // Escape cancela, y el blur que sigue al desmontar el campo no tiene que
  // guardar lo que se acaba de descartar.
  const descartado = useRef(false);

  useEffect(() => {
    if (!editando) return;
    campo.current?.focus();
    campo.current?.select();
  }, [editando]);

  function empezar() {
    setValor(nombre); setErr(null);
    descartado.current = false;
    setEditando(true);
  }

  async function terminar() {
    if (descartado.current) return;
    descartado.current = true;
    const limpio = valor.trim();
    if (!limpio || limpio === nombre || !onRenombrar) { setEditando(false); return; }
    try {
      await onRenombrar(limpio);
      setEditando(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo cambiar el nombre.');
      descartado.current = false;
      campo.current?.focus();
    }
  }

  const meta = (chip || cuenta) ? (
    <span className="tq-meta">
      {chip && <span className={'tq-chip tq-chip-' + chip.tono}>{chip.texto}</span>}
      {cuenta && <span className="tq-cuenta">{cuenta}</span>}
    </span>
  ) : null;

  return (
    <article className="tq" data-destino={dataDestino} data-rubro={dataRubro}>
      {editando ? (
        <div className="tq-cab tq-cab-editando">
          <span className="tq-titulo">
            <span className="tq-radio" aria-hidden="true" />
            <input
              ref={campo}
              className="tq-nombre-input"
              aria-label="Nombre del Quodom"
              value={valor}
              maxLength={255}
              onChange={e => setValor(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); terminar(); }
                if (e.key === 'Escape') { e.stopPropagation(); descartado.current = true; setEditando(false); }
              }}
              onBlur={terminar}
            />
          </span>
          {err && <span className="tq-err" role="alert">{err}</span>}
          {/* Se queda mientras se edita: sin esto la tarjeta saltaba de alto. */}
          {!err && meta}
        </div>
      ) : (
        <div className="tq-cab-fila">
          <button
            type="button"
            className="tq-cab"
            aria-expanded={expandido}
            onClick={onActivar}
          >
            <span className="tq-titulo">
              <span className="tq-radio" aria-hidden="true" />
              <span className="tq-nombre">{nombre}</span>
              {onRenombrar && <span className="tq-lapiz-lugar" aria-hidden="true" />}
              <span className="tq-chevron" aria-hidden="true">{expandido ? '⌃' : '→'}</span>
            </span>
            {meta}
          </button>
          {onRenombrar && (
            <button
              type="button"
              className="tq-lapiz"
              aria-label="Cambiar el nombre"
              title="Cambiar el nombre"
              onClick={empezar}
            >✎</button>
          )}
        </div>
      )}
      {children}
    </article>
  );
}
