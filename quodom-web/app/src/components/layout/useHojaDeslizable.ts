import { useCallback, useEffect, useRef, useState } from 'react';

/** Desde cuántos px un gesto deja de ser un toque. */
const UMBRAL = 6;
/** px/ms: más rápido que esto, manda la dirección del gesto y no la posición. */
const VELOCIDAD_DECISIVA = 0.5;

/**
 * Cómo termina una hoja soltada a mitad de camino. `desplazamiento` es lo que
 * se movió el dedo (positivo hacia abajo), `velocidad` la del final del gesto
 * y `alto` el de la hoja. Un tirón manda por su dirección; uno lento, por si
 * quedó más de la mitad a la vista. Devuelve si queda abierta.
 */
export function decidirFinal(desplazamiento: number, velocidad: number, alto: number, abierta: boolean): boolean {
  if (Math.abs(velocidad) >= VELOCIDAD_DECISIVA) return velocidad < 0;
  const visible = abierta ? alto - Math.max(0, desplazamiento) : Math.max(0, -desplazamiento);
  return visible > alto / 2;
}

/**
 * Abrir y cerrar la hoja de la barra deslizando el dedo, a mano y con eventos
 * de puntero, como el arrastre de productos: sin dependencias. Los manejadores
 * van en lo que se agarra (la fila de la barra y la manija de la hoja), que
 * llevan `touch-action: none`; el contenido de la hoja scrollea normal.
 *
 * Mientras dura el gesto la hoja sigue al dedo (`desplazamiento`, en px desde
 * su posición de reposo) y está montada aunque arranque cerrada, para verla subir.
 */
export function useHojaDeslizable({ abierta, onCambio, alto }: {
  abierta: boolean;
  onCambio: (abierta: boolean) => void;
  alto: () => number;
}) {
  const [arrastrando, setArrastrando] = useState(false);
  const [desplazamiento, setDesplazamiento] = useState(0);
  // El clic que el navegador manda al final de un gesto no tiene que volver a
  // abrir o cerrar lo que el gesto ya decidió.
  const tragarClic = useRef(false);
  const fin = useRef<(() => void) | null>(null);

  useEffect(() => () => fin.current?.(), []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;
    const y0 = e.clientY;
    let ultimo = { y: y0, t: performance.now() };
    let velocidad = 0;
    let movido = false;
    let dy = 0;

    function mover(ev: PointerEvent) {
      dy = ev.clientY - y0;
      if (!movido) {
        if (Math.abs(dy) < UMBRAL) return;
        movido = true;
        setArrastrando(true);
      }
      const ahora = performance.now();
      const dt = ahora - ultimo.t;
      if (dt > 0) velocidad = (ev.clientY - ultimo.y) / dt;
      ultimo = { y: ev.clientY, t: ahora };
      setDesplazamiento(dy);
    }
    function soltar() {
      limpiar();
      if (!movido) return;
      tragarClic.current = true;
      setTimeout(() => { tragarClic.current = false; }, 400);
      onCambio(decidirFinal(dy, velocidad, alto(), abierta));
    }
    function limpiar() {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', limpiar);
      fin.current = null;
      setArrastrando(false);
      setDesplazamiento(0);
    }
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', limpiar);
    fin.current = limpiar;
  }, [abierta, onCambio, alto]);

  /** Lo llama el `onClick` de lo que se agarra: true si el clic es el final de
   *  un gesto y hay que ignorarlo. */
  const consumirClic = useCallback(() => {
    if (!tragarClic.current) return false;
    tragarClic.current = false;
    return true;
  }, []);

  return { arrastrando, desplazamiento, onPointerDown, consumirClic };
}
