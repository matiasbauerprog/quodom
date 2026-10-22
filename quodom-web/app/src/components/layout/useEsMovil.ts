import { useEffect, useState } from 'react';

/** El corte entre móvil y escritorio. Es el mismo número que los media queries
 *  de CSS (`max-width: 1024px` / `min-width: 1025px`), que no pueden leer una variable. */
export const MEDIA_MOVIL = '(max-width: 1024px)';

function consultar(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(MEDIA_MOVIL) : null;
}

/**
 * Si la pantalla es la versión móvil. Para lo que no alcanza con CSS: montar o
 * no un destino de arrastre, que escondido con CSS seguiría en el DOM y
 * duplicaría el del panel de escritorio. Sin `matchMedia` (tests) es móvil.
 */
export function useEsMovil(): boolean {
  const [movil, setMovil] = useState(() => consultar()?.matches ?? true);
  useEffect(() => {
    const mq = consultar();
    if (!mq) return;
    const cambio = () => setMovil(mq.matches);
    cambio();
    mq.addEventListener('change', cambio);
    return () => mq.removeEventListener('change', cambio);
  }, []);
  return movil;
}
