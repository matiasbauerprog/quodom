export type Blanco =
  | { tipo: 'quodom'; idquodom: string; idrubro: number }
  | { tipo: 'nuevo'; idrubro: number };

const UMBRAL = 6;

/**
 * Qué destino del árbol hay bajo el puntero, si hay alguno.
 *
 * Se resuelve por hit-test y no por eventos de los destinos, porque el elemento
 * que sigue al cursor tiene `pointer-events: none` y nunca los recibiría.
 */
export function blancoBajo(x: number, y: number): Blanco | null {
  const el = document.elementFromPoint(x, y);
  const destino = el?.closest<HTMLElement>('[data-destino], [data-nuevo]');
  if (!destino) return null;
  const idrubro = Number(destino.getAttribute('data-rubro'));
  if (!Number.isInteger(idrubro)) return null;
  const nuevo = destino.getAttribute('data-nuevo');
  if (nuevo !== null) return { tipo: 'nuevo', idrubro };
  return { tipo: 'quodom', idquodom: destino.getAttribute('data-destino')!, idrubro };
}

/**
 * Arrastre con eventos de puntero, no con el de HTML: `dragstart` congela una
 * imagen de la tarjeta al empezar y no deja animarla después, así que el efecto
 * de achicarse al entrar en el destino es imposible con esa API.
 */
export function iniciarArrastre(ev: PointerEvent, opts: {
  idrubro: number;
  nombre: string;
  nombreRubro: string;
  onSoltar: (blanco: Blanco) => void;
}): void {
  if (ev.button !== 0) return;
  const x0 = ev.clientX;
  const y0 = ev.clientY;
  let vivo = false;
  let fantasma: HTMLDivElement | null = null;
  let interior: HTMLDivElement | null = null;
  let rubroAvisado: string | null = null;

  function limpiarResaltados() {
    document.querySelectorAll('.arrastre-encima, .arrastre-rechaza')
      .forEach(e => e.classList.remove('arrastre-encima', 'arrastre-rechaza'));
  }

  function levantar() {
    vivo = true;
    document.body.classList.add('arrastrando');
    fantasma = document.createElement('div');
    fantasma.className = 'arrastre-fantasma';
    interior = document.createElement('div');
    interior.className = 'arrastre-interior';
    const rubro = document.createElement('span');
    rubro.className = 'arrastre-rubro';
    rubro.textContent = opts.nombreRubro;
    const nombre = document.createElement('span');
    nombre.textContent = opts.nombre;
    interior.append(rubro, nombre);
    fantasma.appendChild(interior);
    document.body.appendChild(fantasma);
  }

  // Un rubro plegado no tiene Quodoms montados, o sea que no tiene dónde soltar.
  // Se avisa una sola vez por pasada; el árbol decide qué hace con el aviso.
  function avisarCabecera(el: Element | null | undefined) {
    const cab = el?.closest<HTMLElement>('[data-rubro-cab]')?.getAttribute('data-rubro-cab') ?? null;
    if (cab === rubroAvisado) return;
    rubroAvisado = cab;
    if (cab !== null) {
      window.dispatchEvent(new CustomEvent('arrastre:sobre-rubro', { detail: { idrubro: Number(cab) } }));
    }
  }

  function mover(e: PointerEvent) {
    if (!vivo) {
      if (Math.abs(e.clientX - x0) < UMBRAL && Math.abs(e.clientY - y0) < UMBRAL) return;
      levantar();
    }
    fantasma!.style.left = e.clientX + 'px';
    fantasma!.style.top = e.clientY + 'px';

    limpiarResaltados();
    interior!.classList.remove('entrando');
    const bajo = document.elementFromPoint(e.clientX, e.clientY);
    avisarCabecera(bajo);
    const blanco = blancoBajo(e.clientX, e.clientY);
    const destino = bajo?.closest<HTMLElement>('[data-destino], [data-nuevo]');
    if (!blanco || !destino) return;
    if (blanco.idrubro === opts.idrubro) {
      destino.classList.add('arrastre-encima');
      interior!.classList.add('entrando');
    } else {
      destino.classList.add('arrastre-rechaza');
    }
  }

  // Tras un arrastre el navegador puede disparar un clic sobre el elemento donde
  // empezó el gesto (la tarjeta es un botón que abre el detalle): se traga uno solo,
  // y el bloqueo caduca por sí mismo para no comerse un clic ajeno más tarde.
  function tragarClic() {
    const tragar = (c: Event) => { c.preventDefault(); c.stopPropagation(); quitar(); };
    const timer = setTimeout(() => quitar(), 100);
    function quitar() {
      clearTimeout(timer);
      window.removeEventListener('click', tragar, true);
    }
    window.addEventListener('click', tragar, true);
  }

  function terminar(e: PointerEvent) {
    window.removeEventListener('pointermove', mover);
    window.removeEventListener('pointerup', terminar);
    window.removeEventListener('pointercancel', terminar);
    if (!vivo) return;
    document.body.classList.remove('arrastrando');
    fantasma?.remove();
    limpiarResaltados();
    // Cancelar (el sistema interrumpe el gesto) no es soltar: sin esto se agregaría
    // el producto donde el puntero haya quedado.
    if (e.type === 'pointercancel') return;
    tragarClic();
    const blanco = blancoBajo(e.clientX, e.clientY);
    // Soltar en el vacío, o sobre un Quodom de otro rubro, no hace nada y no es
    // un error: el usuario ya vio el borde rojo mientras arrastraba.
    if (blanco && blanco.idrubro === opts.idrubro) opts.onSoltar(blanco);
  }

  window.addEventListener('pointermove', mover);
  window.addEventListener('pointerup', terminar);
  window.addEventListener('pointercancel', terminar);
}
