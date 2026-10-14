import { useEffect, useState } from 'react';

export type ArrastreActivo = { idrubro: number; nombre: string; nombreRubro: string };

/**
 * Qué producto se está arrastrando, para que el panel pueda nombrarlo y apagar
 * los rubros donde no se puede soltar.
 *
 * Son eventos de `window` y no un contexto de React porque `arrastre.ts` no
 * vive en el árbol de componentes: lo arranca una tarjeta del catálogo y lo
 * escuchan el sidebar y la barra inferior, que cuelgan del `Layout`. El estado
 * arranca en `null` y vuelve a `null` por cualquier salida del arrastre,
 * incluidas las que no son soltar (Escape, `pointercancel`, perder el foco).
 */
export function useArrastreActivo(): ArrastreActivo | null {
  const [activo, setActivo] = useState<ArrastreActivo | null>(null);

  useEffect(() => {
    const inicio = (e: Event) => setActivo((e as CustomEvent<ArrastreActivo>).detail);
    const fin = () => setActivo(null);
    window.addEventListener('arrastre:inicio', inicio);
    window.addEventListener('arrastre:fin', fin);
    return () => {
      window.removeEventListener('arrastre:inicio', inicio);
      window.removeEventListener('arrastre:fin', fin);
    };
  }, []);

  return activo;
}
