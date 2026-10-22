export type Blanco =
  | { tipo: 'quodom'; idquodom: string; idrubro: number }
  | { tipo: 'nuevo'; idrubro: number };

const UMBRAL = 6;
/** Con el dedo, cuánto hay que dejarlo apretado para levantar el producto. */
export const ESPERA_TOQUE_MS = 450;
/** Cuánto se puede mover el dedo sin que deje de ser "quieto". */
export const TOLERANCIA_TOQUE = 8;
/** El fantasma va por encima del dedo: debajo, el dedo lo tapa a él y al destino. */
const SOBRE_EL_DEDO = 48;

// Si hay un producto levantado con el dedo: lo lee el freno del scroll.
let frenando = false;

/**
 * El freno del scroll del arrastre con el dedo, puesto en la lista **al
 * montarla** y no al apoyar el dedo: Safari de iOS decide en el `touchstart` si
 * un `touchmove` se puede frenar, mirando los oyentes que ya existen, así que
 * uno agregado en el `pointerdown` llega tarde y el arrastre scrollea la página.
 * `touch-action` tampoco sirve (se lee al apoyar el dedo, y cambiarlo a mitad
 * termina en `pointercancel`). Frena sólo con un producto levantado: antes, el
 * scroll es del usuario. Devuelve con qué sacarlo.
 */
export function frenoDeScroll(el: HTMLElement): () => void {
  const frenar = (e: TouchEvent) => { if (frenando) e.preventDefault(); };
  el.addEventListener('touchmove', frenar, { passive: false });
  return () => el.removeEventListener('touchmove', frenar);
}

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
  /** Con el dedo: se levantó y se soltó sin moverlo. Es un toque lento, no un
   *  soltado en el vacío, y tiene que hacer lo que hace el toque. */
  onToqueLento?: () => void;
  /** La tarjeta que se levanta: se marca mientras el dedo espera y queda como
   *  hueco mientras se arrastra, y de ahí sale la foto del fantasma. */
  origen?: HTMLElement;
}): void {
  if (ev.button !== 0) return;
  // Con el dedo el arrastre arranca dejándolo apretado (ESPERA_TOQUE_MS). Hasta
  // entonces el gesto es del navegador: si el dedo se mueve, es scroll y el
  // arrastre no existe. Cuando era inmediato, como con el mouse, lo único que
  // lograba en celular era comerse el scroll de la lista de productos.
  const dedo = !!ev.pointerType && ev.pointerType !== 'mouse';
  const x0 = ev.clientX;
  const y0 = ev.clientY;
  let vivo = false;
  let espera: ReturnType<typeof setTimeout> | null = null;
  // Levantado sin mover y soltado ahí mismo es un toque lento.
  let movioDespues = false;
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
    opts.origen?.classList.remove('arrastre-cargando');
    opts.origen?.classList.add('arrastre-origen');
    // El panel necesita saber qué se arrastra para nombrarlo y para apagar los
    // rubros donde no se puede soltar. Se avisa al levantar y no al apretar: un
    // clic sin movimiento no es un arrastre y no tiene que mover nada de lugar.
    window.dispatchEvent(new CustomEvent('arrastre:inicio', {
      detail: { idrubro: opts.idrubro, nombre: opts.nombre, nombreRubro: opts.nombreRubro }
    }));
    fantasma = document.createElement('div');
    fantasma.className = 'arrastre-fantasma';
    interior = document.createElement('div');
    interior.className = 'arrastre-interior';
    const rubro = document.createElement('span');
    rubro.className = 'arrastre-rubro';
    rubro.textContent = opts.nombreRubro;
    const nombre = document.createElement('span');
    nombre.textContent = opts.nombre;
    const texto = document.createElement('span');
    texto.className = 'arrastre-texto';
    texto.append(rubro, nombre);
    const src = opts.origen?.querySelector('img')?.getAttribute('src');
    if (src) {
      const foto = document.createElement('img');
      foto.className = 'arrastre-foto';
      foto.src = src;
      foto.alt = '';
      interior.appendChild(foto);
    }
    interior.appendChild(texto);
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

  // Salida común: sirve tanto para soltar como para abortar. Sin quitar los oyentes
  // de `window`, un arrastre al que nunca le llegó el `pointerup` seguiría vivo y el
  // próximo clic en cualquier lado soltaría el producto.
  function limpiar() {
    if (espera !== null) { clearTimeout(espera); espera = null; }
    window.removeEventListener('contextmenu', sinMenu);
    window.removeEventListener('pointermove', mover);
    window.removeEventListener('pointerup', terminar);
    window.removeEventListener('pointercancel', abortar);
    window.removeEventListener('blur', abortar);
    window.removeEventListener('keydown', alTeclear);
    window.removeEventListener('arrastre:abortar', abortar);
    document.body.classList.remove('arrastrando');
    opts.origen?.classList.remove('arrastre-cargando', 'arrastre-origen');
    frenando = false;
    fantasma?.remove();
    limpiarResaltados();
    // Sólo si de verdad se había levantado: sin esto un clic que no llegó al
    // umbral avisaría un fin que nadie empezó.
    if (vivo) window.dispatchEvent(new Event('arrastre:fin'));
    vivo = false;
  }

  function abortar() { limpiar(); }

  // Dejar el dedo apretado abre el menú del navegador (copiar imagen, etc.).
  // Además, Chrome en Android lo dispara a los 400ms y desde ahí ya no manda el
  // clic: si todavía no levantamos, se levanta en el acto, o un toque soltado
  // en ese hueco no haría nada.
  function sinMenu(e: Event) {
    e.preventDefault();
    if (dedo && !vivo && espera !== null) {
      clearTimeout(espera);
      espera = null;
      levantarConDedo();
    }
  }

  function levantarConDedo() {
    levantar();
    frenando = true;
    fantasma!.style.left = x0 + 'px';
    fantasma!.style.top = y0 - SOBRE_EL_DEDO + 'px';
    navigator.vibrate?.(15);
  }

  function alTeclear(e: KeyboardEvent) { if (e.key === 'Escape') abortar(); }

  function mover(e: PointerEvent) {
    if (dedo) {
      if (!vivo) {
        // Movió antes de tiempo: era scroll.
        if (Math.abs(e.clientX - x0) > TOLERANCIA_TOQUE || Math.abs(e.clientY - y0) > TOLERANCIA_TOQUE) abortar();
        return;
      }
      if (Math.abs(e.clientX - x0) > TOLERANCIA_TOQUE || Math.abs(e.clientY - y0) > TOLERANCIA_TOQUE) movioDespues = true;
    } else {
      // Ya no hay botón apretado: el pointerup se perdió (otra ventana, un menú).
      // Sólo con mouse: con el dedo, algunos navegadores mandan `buttons` en 0.
      if (e.buttons === 0) { abortar(); return; }
      if (!vivo) {
        if (Math.abs(e.clientX - x0) < UMBRAL && Math.abs(e.clientY - y0) < UMBRAL) return;
        levantar();
      }
    }
    fantasma!.style.left = e.clientX + 'px';
    fantasma!.style.top = (dedo ? e.clientY - SOBRE_EL_DEDO : e.clientY) + 'px';

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
    const habiaLevantado = vivo;
    // Levantado y soltado sin moverlo: el toque de siempre, hecho despacio.
    if (dedo && habiaLevantado && !movioDespues) {
      limpiar();
      tragarClic();
      opts.onToqueLento?.();
      return;
    }
    // El destino se resuelve ANTES de limpiar: sacar `arrastrando` del body
    // esconde las zonas "Quodom nuevo" y el árbol se reacomoda bajo el puntero.
    const blanco = habiaLevantado ? blancoBajo(e.clientX, e.clientY) : null;
    limpiar();
    if (!habiaLevantado) return;
    tragarClic();
    // Soltar en el vacío, o sobre un Quodom de otro rubro, no hace nada y no es
    // un error: el usuario ya vio el borde rojo mientras arrastraba.
    if (blanco && blanco.idrubro === opts.idrubro) opts.onSoltar(blanco);
  }

  if (dedo) {
    // Mientras el dedo espera, la tarjeta se hunde de a poco: así se ve que
    // dejarlo apretado está haciendo algo antes de que el producto se levante.
    opts.origen?.classList.add('arrastre-cargando');
    espera = setTimeout(() => {
      espera = null;
      levantarConDedo();
    }, ESPERA_TOQUE_MS);
    window.addEventListener('contextmenu', sinMenu);
  }
  window.addEventListener('pointermove', mover);
  window.addEventListener('pointerup', terminar);
  // Cancelar (el sistema interrumpe el gesto) no es soltar: se aborta sin agregar.
  window.addEventListener('pointercancel', abortar);
  window.addEventListener('blur', abortar);
  window.addEventListener('keydown', alTeclear);
  // Quien armó el arrastre puede desaparecer a mitad (se desmonta la pantalla).
  window.addEventListener('arrastre:abortar', abortar);
}
