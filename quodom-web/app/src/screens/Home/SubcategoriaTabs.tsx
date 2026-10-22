import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Category } from '../../api/types';
import { cortesDeTabs } from './cortesDeTabs';
import './SubcategoriaTabs.css';

/**
 * El lugar que van a ocupar las tabs mientras llegan. Antes acá iba un spinner
 * centrado: la fila colapsaba a nada y volvía a aparecer, y ese salto —más el
 * de la grilla de productos, que hacía lo mismo— se leía como que la página se
 * recargaba entera cada vez que se cambiaba de rubro.
 */
export function SubcategoriaTabsEsqueleto() {
  return (
    <div className="subtabs" aria-hidden="true">
      {[78, 104, 88, 116, 82].map((ancho, i) => (
        <span key={i} className="subtab subtab-esqueleto esqueleto" style={{ width: ancho }} />
      ))}
    </div>
  );
}

/** Lo que se deja libre a la derecha para la flecha de "hay más". */
const RESERVA_FLECHA = 36;
/** Cuánto asoma la sombra de una pestaña fuera de su caja. */
const SOMBRA = 6;

export function SubcategoriaTabs({ idrubro, subs, idSeleccionada }: { idrubro: number; subs: Category[]; idSeleccionada: number | null }) {
  // Deslizarlas está bien; ver una partida a la mitad no (lo pidió el usuario).
  // La que queda contra un borde se oculta con una máscara, y a la derecha su
  // lugar lo ocupa una flecha que avisa que hay más y las desliza.
  const fila = useRef<HTMLElement>(null);
  const [corte, setCorte] = useState<{ izq: number; der: number | null }>({ izq: 0, der: null });

  const medir = useCallback(() => {
    const el = fila.current;
    if (!el) return;
    const tabs = Array.from(el.querySelectorAll<HTMLElement>('.subtab'))
      .map(t => ({ inicio: t.offsetLeft, fin: t.offsetLeft + t.offsetWidth }));
    const crudo = cortesDeTabs(tabs, el.scrollLeft, el.clientWidth, RESERVA_FLECHA);
    // La sombra de la píldora asoma unos px fuera de ella: se corta con margen
    // para que de la oculta no quede ni el borde.
    const nuevo = {
      izq: crudo.izq > 0 ? crudo.izq + SOMBRA : 0,
      der: crudo.der === null ? null : Math.max(0, crudo.der - SOMBRA)
    };
    setCorte(c => (c.izq === nuevo.izq && c.der === nuevo.der ? c : nuevo));
  }, []);

  useEffect(() => {
    const el = fila.current;
    if (!el) return;
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir);
    ro?.observe(el);
    return () => { el.removeEventListener('scroll', medir); ro?.disconnect(); };
  }, [medir, subs]);

  const conMascara = corte.izq > 0 || corte.der !== null;
  const mascara = 'linear-gradient(to right, transparent ' + corte.izq + 'px, #000 ' + corte.izq + 'px, #000 '
    + (corte.der === null ? '100%' : corte.der + 'px') + ', transparent ' + (corte.der === null ? '100%' : corte.der + 'px') + ')';

  return (
    <div className="subtabs-marco">
      <nav
        ref={fila}
        className="subtabs"
        aria-label="Subcategorías"
        style={conMascara ? { maskImage: mascara, WebkitMaskImage: mascara } : undefined}
      >
        {subs.map(s => {
          const elegida = s.id === idSeleccionada;
          return (
            <Link
              key={s.id}
              to={'/?rubro=' + idrubro + '&sub=' + s.id}
              className={'subtab' + (elegida ? ' subtab-sel' : '')}
              aria-current={elegida ? 'page' : undefined}
            >
              {s.nombrecategoria}
            </Link>
          );
        })}
      </nav>
      {corte.der !== null && (
        <button
          type="button"
          className="subtabs-mas"
          aria-label="Ver más subcategorías"
          onClick={() => fila.current?.scrollBy({ left: corte.der ?? 0, behavior: 'smooth' })}
        >›</button>
      )}
    </div>
  );
}
