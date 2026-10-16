import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import {
  MINIMO, UMBRAL_CIERRE, anchoGuardado, panelCerrado, previsualizar, guardarPanel
} from './panelLateral';
import './ManijaPanel.css';

const PASO = 16;

type Estado = number | 'cerrado';

// The CSS clamps the same range (Layout.css), so a window that shrinks after
// the width was saved never squeezes the catalog: this only has to keep the
// stored number sane.
function acotar(px: number, anchoLayout: number): number {
  const maximo = Math.max(MINIMO, Math.floor(anchoLayout / 2));
  return Math.round(Math.min(maximo, Math.max(MINIMO, px)));
}

/**
 * The border between the catalog and the right panel, dragged to resize it or,
 * past UMBRAL_CIERRE, to close it. Closed, it stays at the right edge of the
 * screen so the panel can be dragged back out. Desktop only. Everything visual
 * goes through `panelLateral` straight to <html>: going through React state
 * would re-render the whole Layout, panel included, on every pointermove.
 */
export function ManijaPanel() {
  const ref = useRef<HTMLDivElement>(null);
  const arrastrando = useRef(false);
  const [ancho, setAncho] = useState<number | null>(null);
  const [cerrado, setCerrado] = useState(false);

  function layout() {
    return ref.current!.parentElement!.getBoundingClientRect();
  }

  // Where a drag or key leaves the panel: closed below the threshold, else the
  // width clamped to the allowed range.
  function resolver(px: number): Estado {
    return px < UMBRAL_CIERRE ? 'cerrado' : acotar(px, layout().width);
  }

  function mostrar(estado: Estado | null, guardar: boolean) {
    if (guardar) guardarPanel(estado);
    else previsualizar(estado);
    setCerrado(estado === 'cerrado');
    if (estado !== 'cerrado') setAncho(estado);
  }

  useEffect(() => {
    const sincronizar = () => {
      const guardado = anchoGuardado();
      const valor = guardado === null ? null : acotar(guardado, layout().width);
      previsualizar(valor);
      setAncho(valor);
      const estaCerrado = panelCerrado();
      if (estaCerrado) previsualizar('cerrado');
      setCerrado(estaCerrado);
    };
    sincronizar();
    window.addEventListener('panel:cambio', sincronizar);
    return () => window.removeEventListener('panel:cambio', sincronizar);
  }, []);

  // Without a saved width the CSS default (30%) rules, so the starting point
  // for the keyboard is whatever the panel measures now.
  function actual(): number {
    if (ancho !== null) return ancho;
    const panel = ref.current!.nextElementSibling as HTMLElement | null;
    return panel?.offsetWidth || layout().width * 0.3;
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    arrastrando.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    document.body.classList.add('redimensionando');
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!arrastrando.current) return;
    mostrar(resolver(layout().right - e.clientX), false);
  }

  function soltar(): boolean {
    if (!arrastrando.current) return false;
    arrastrando.current = false;
    document.body.classList.remove('redimensionando');
    return true;
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (soltar()) mostrar(resolver(layout().right - e.clientX), true);
  }

  // A cancelled pointer carries no reliable position (often clientX 0, which
  // would read as "as wide as possible"): go back to what was saved.
  function onPointerCancel() {
    if (soltar()) window.dispatchEvent(new Event('panel:cambio'));
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // The panel is on the right: moving the border left widens it.
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      mostrar(cerrado ? MINIMO : resolver(actual() + PASO), true);
    } else if (e.key === 'ArrowRight' && !cerrado) {
      e.preventDefault();
      const angosto = actual() - PASO;
      mostrar(actual() <= MINIMO ? 'cerrado' : acotar(angosto, layout().width), true);
    }
  }

  return (
    <div
      ref={ref}
      className="manija-panel"
      role="separator"
      aria-orientation="vertical"
      aria-label="Ancho del panel Mis Quodoms"
      aria-valuemin={MINIMO}
      aria-valuenow={cerrado ? 0 : ancho ?? undefined}
      aria-valuetext={cerrado ? 'Panel cerrado' : undefined}
      title={cerrado
        ? 'Arrastrá hacia la izquierda para abrir Mis Quodoms'
        : 'Arrastrá para cambiar el ancho, hasta el borde para cerrarlo · doble clic para volver al original'}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={() => mostrar(null, true)}
      onKeyDown={onKeyDown}
    />
  );
}
