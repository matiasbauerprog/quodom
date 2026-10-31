import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

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
 * Un gesto que empieza en el **contenido** de la hoja abierta: ¿lo toma la hoja
 * o es scroll? Se decide una vez, con el primer movimiento que pasa el umbral
 * (`null` mientras no lo pasa). Lo toma la hoja sólo si la lista estaba arriba
 * de todo al apoyar el dedo y el gesto va hacia abajo y más vertical que
 * horizontal: es la regla de las hojas nativas, y sin ella deslizar para leer
 * la lista la cerraría.
 */
export function quienTomaElGesto(scrollTopAlEmpezar: number, dx: number, dy: number): 'hoja' | 'scroll' | null {
  if (scrollTopAlEmpezar > 0) return 'scroll';
  if (Math.abs(dx) < UMBRAL && Math.abs(dy) < UMBRAL) return null;
  return dy > 0 && Math.abs(dy) > Math.abs(dx) ? 'hoja' : 'scroll';
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
export function useHojaDeslizable({ abierta, onCambio, alto, cuerpo }: {
  abierta: boolean;
  onCambio: (abierta: boolean) => void;
  alto: () => number;
  /** El contenido que scrollea: con la hoja abierta, bajarlo desde arriba de
   *  todo también la cierra (lo pidió el usuario, 2026-10-31: agarrarla sólo de
   *  la manija era apuntarle a una rayita). Lo que lleva `data-hoja-agarre` ya
   *  tiene sus propios manejadores de puntero y se saltea. */
  cuerpo?: RefObject<HTMLElement>;
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

  // Con eventos táctiles y no de puntero: en un contenido que scrollea, el
  // navegador se queda con el gesto y manda `pointercancel` apenas el dedo se
  // mueve. `touchmove` no pasivo es lo único que deja frenar ese scroll.
  useEffect(() => {
    const el = cuerpo?.current;
    if (!el || !abierta) return;
    let estado: 'hoja' | 'scroll' | null = 'scroll';
    let x0 = 0, y0 = 0, scrollInicial = 0, dy = 0, velocidad = 0;
    let ultimo = { y: 0, t: 0 };

    const empezar = (e: TouchEvent) => {
      const t = e.touches[0];
      const agarre = e.target instanceof Element && e.target.closest('[data-hoja-agarre]');
      if (e.touches.length !== 1 || !t || agarre) { estado = 'scroll'; return; }
      x0 = t.clientX; y0 = t.clientY; dy = 0; velocidad = 0;
      scrollInicial = el.scrollTop;
      ultimo = { y: t.clientY, t: performance.now() };
      estado = null;
    };
    const mover = (e: TouchEvent) => {
      if (estado === 'scroll') return;
      const t = e.touches[0];
      if (!t) return;
      dy = t.clientY - y0;
      if (estado === null) {
        estado = quienTomaElGesto(scrollInicial, t.clientX - x0, dy);
        if (estado !== 'hoja') return;
        setArrastrando(true);
      }
      e.preventDefault();
      const ahora = performance.now();
      const dt = ahora - ultimo.t;
      if (dt > 0) velocidad = (t.clientY - ultimo.y) / dt;
      ultimo = { y: t.clientY, t: ahora };
      setDesplazamiento(dy);
    };
    const terminar = (e: TouchEvent) => {
      const eraHoja = estado === 'hoja';
      estado = 'scroll';
      if (!eraHoja) return;
      setArrastrando(false);
      setDesplazamiento(0);
      tragarClic.current = true;
      setTimeout(() => { tragarClic.current = false; }, 400);
      // Cancelado (el sistema se llevó el toque), la hoja vuelve a donde estaba.
      if (e.type === 'touchend') onCambio(decidirFinal(dy, velocidad, alto(), true));
    };
    el.addEventListener('touchstart', empezar, { passive: true });
    el.addEventListener('touchmove', mover, { passive: false });
    el.addEventListener('touchend', terminar);
    el.addEventListener('touchcancel', terminar);
    return () => {
      el.removeEventListener('touchstart', empezar);
      el.removeEventListener('touchmove', mover);
      el.removeEventListener('touchend', terminar);
      el.removeEventListener('touchcancel', terminar);
    };
  }, [abierta, onCambio, alto, cuerpo]);

  /** Lo llama el `onClick` de lo que se agarra: true si el clic es el final de
   *  un gesto y hay que ignorarlo. */
  const consumirClic = useCallback(() => {
    if (!tragarClic.current) return false;
    tragarClic.current = false;
    return true;
  }, []);

  return { arrastrando, desplazamiento, onPointerDown, consumirClic };
}
