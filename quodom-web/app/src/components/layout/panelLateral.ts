import { useEffect, useState } from 'react';

/**
 * Width and open/closed state of the right panel (desktop only). It lives on
 * <html> — a CSS variable for the width and `data-panel-cerrado` for closed —
 * so the drag can update it on every pointermove without a React render, and
 * persists per browser in localStorage.
 *
 * `panel:cambio` tells the handle that someone else (the "Mis Quodoms" tab, a
 * repeat) changed it.
 */
export const MINIMO = 300;
/** Dragging the panel narrower than this closes it. */
export const UMBRAL_CIERRE = 200;

const CLAVE_ANCHO = 'quodom.anchoPanel';
const CLAVE_CERRADO = 'quodom.panelCerrado';
const VARIABLE = '--ancho-panel';

function leer(clave: string): string | null {
  try { return localStorage.getItem(clave); } catch { return null; }
}

function escribir(clave: string, valor: string | null): void {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch {}
}

export function anchoGuardado(): number | null {
  const n = Number(leer(CLAVE_ANCHO));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function panelCerrado(): boolean {
  return leer(CLAVE_CERRADO) === '1';
}

/** What the screen shows, without saving: used while dragging. */
export function previsualizar(estado: number | null | 'cerrado'): void {
  const raiz = document.documentElement;
  if (estado === 'cerrado') {
    raiz.dataset.panelCerrado = 'true';
    return;
  }
  delete raiz.dataset.panelCerrado;
  if (estado === null) raiz.style.removeProperty(VARIABLE);
  else raiz.style.setProperty(VARIABLE, estado + 'px');
}

/** Shows and saves it. `null` is open at the default width (30%). */
export function guardarPanel(estado: number | null | 'cerrado'): void {
  previsualizar(estado);
  if (estado === 'cerrado') {
    escribir(CLAVE_CERRADO, '1');
  } else {
    escribir(CLAVE_CERRADO, null);
    escribir(CLAVE_ANCHO, estado === null ? null : String(estado));
  }
  window.dispatchEvent(new Event('panel:cambio'));
}

/**
 * Opens a closed panel at the default width; an open one is left alone, so a
 * repeat doesn't undo the width the user picked.
 */
export function abrirPanel(): void {
  if (panelCerrado()) guardarPanel(null);
}

/** Whether the panel is closed, re-read whenever it changes. */
export function usePanelCerrado(): boolean {
  const [cerrado, setCerrado] = useState(panelCerrado);
  useEffect(() => {
    const releer = () => setCerrado(panelCerrado());
    window.addEventListener('panel:cambio', releer);
    return () => window.removeEventListener('panel:cambio', releer);
  }, []);
  return cerrado;
}
