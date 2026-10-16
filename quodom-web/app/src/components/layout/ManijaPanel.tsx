import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import './ManijaPanel.css';

const CLAVE = 'quodom.anchoPanel';
const VARIABLE = '--ancho-panel';
const MINIMO = 300;
const PASO = 16;

// The CSS clamps the same range (Layout.css), so a window that shrinks after
// the width was saved never squeezes the catalog: this only has to keep the
// stored number sane.
function acotar(px: number, anchoLayout: number): number {
  const maximo = Math.max(MINIMO, Math.floor(anchoLayout / 2));
  return Math.round(Math.min(maximo, Math.max(MINIMO, px)));
}

function leer(): number | null {
  try {
    const n = Number(localStorage.getItem(CLAVE));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function aplicar(px: number | null): void {
  const raiz = document.documentElement.style;
  if (px === null) raiz.removeProperty(VARIABLE);
  else raiz.setProperty(VARIABLE, px + 'px');
}

/**
 * The border between the catalog and the right panel, dragged to resize it.
 * Desktop only (the panel doesn't exist below 1025px). The width lives in a CSS
 * variable on <html> and is written directly while dragging: going through
 * React state would re-render the whole Layout, panel included, on every
 * pointermove.
 */
export function ManijaPanel() {
  const ref = useRef<HTMLDivElement>(null);
  const arrastrando = useRef(false);
  const [ancho, setAncho] = useState<number | null>(null);

  function layout() {
    return ref.current!.parentElement!.getBoundingClientRect();
  }

  function fijar(px: number | null, guardar: boolean): void {
    const valor = px === null ? null : acotar(px, layout().width);
    aplicar(valor);
    setAncho(valor);
    if (!guardar) return;
    try {
      if (valor === null) localStorage.removeItem(CLAVE);
      else localStorage.setItem(CLAVE, String(valor));
    } catch {}
  }

  useEffect(() => {
    const guardado = leer();
    if (guardado !== null) fijar(guardado, false);
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
    fijar(layout().right - e.clientX, false);
  }

  function soltar(): boolean {
    if (!arrastrando.current) return false;
    arrastrando.current = false;
    document.body.classList.remove('redimensionando');
    return true;
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (soltar()) fijar(layout().right - e.clientX, true);
  }

  // A cancelled pointer carries no reliable position (often clientX 0, which
  // would read as "as wide as possible"): keep what was on screen.
  function onPointerCancel() {
    if (soltar() && ancho !== null) fijar(ancho, true);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // The panel is on the right: moving the border left widens it.
    const delta = e.key === 'ArrowLeft' ? PASO : e.key === 'ArrowRight' ? -PASO : 0;
    if (!delta) return;
    e.preventDefault();
    fijar(actual() + delta, true);
  }

  return (
    <div
      ref={ref}
      className="manija-panel"
      role="separator"
      aria-orientation="vertical"
      aria-label="Ancho del panel Mis Quodoms"
      aria-valuemin={MINIMO}
      aria-valuenow={ancho ?? undefined}
      title="Arrastrá para cambiar el ancho · doble clic para volver al original"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={() => fijar(null, true)}
      onKeyDown={onKeyDown}
    />
  );
}
