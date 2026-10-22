import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { blancoBajo, iniciarArrastre, ESPERA_TOQUE_MS } from '../arrastre';

function evento(x: number, y: number) {
  return new PointerEvent('pointerdown', { clientX: x, clientY: y, button: 0, bubbles: true });
}

function bajoElPuntero(el: Element | null) {
  vi.spyOn(document, 'elementFromPoint').mockReturnValue(el);
}

function arrastrar(opts: { idrubro?: number; onSoltar?: ReturnType<typeof vi.fn> } = {}) {
  const onSoltar = opts.onSoltar ?? vi.fn();
  iniciarArrastre(evento(100, 100), { idrubro: opts.idrubro ?? 5, nombre: 'Látex', nombreRubro: 'PINTURERÍA', onSoltar });
  window.dispatchEvent(new PointerEvent('pointermove', { buttons: 1, clientX: 140, clientY: 160 }));
  return onSoltar;
}

function soltar() {
  window.dispatchEvent(new PointerEvent('pointerup', { clientX: 140, clientY: 160 }));
}

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { vi.restoreAllMocks(); });

describe('blancoBajo', () => {
  it('reconoce un Quodom del árbol', () => {
    document.body.innerHTML = '<button data-destino="q-1" data-rubro="5"></button>';
    bajoElPuntero(document.querySelector('button'));

    expect(blancoBajo(10, 10)).toEqual({ tipo: 'quodom', idquodom: 'q-1', idrubro: 5 });
  });

  it('reconoce la zona de Quodom nuevo', () => {
    document.body.innerHTML = '<button data-nuevo="5" data-rubro="5"></button>';
    bajoElPuntero(document.querySelector('button'));

    expect(blancoBajo(10, 10)).toEqual({ tipo: 'nuevo', idrubro: 5 });
  });

  it('devuelve null fuera de cualquier destino', () => {
    document.body.innerHTML = '<div id="nada"></div>';
    bajoElPuntero(document.getElementById('nada'));

    expect(blancoBajo(10, 10)).toBeNull();
  });

  it('devuelve null cuando no hay nada bajo el puntero', () => {
    bajoElPuntero(null);

    expect(blancoBajo(10, 10)).toBeNull();
  });
});

describe('iniciarArrastre', () => {
  it('no hace nada si el puntero no se movió lo suficiente', () => {
    const onSoltar = vi.fn();
    iniciarArrastre(evento(100, 100), { idrubro: 5, nombre: 'Látex', nombreRubro: 'PINTURERÍA', onSoltar });

    window.dispatchEvent(new PointerEvent('pointermove', { buttons: 1, clientX: 102, clientY: 101 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 102, clientY: 101 }));

    expect(onSoltar).not.toHaveBeenCalled();
    expect(document.querySelector('.arrastre-fantasma')).toBeNull();
  });

  it('levanta el fantasma al pasar el umbral y lo saca al soltar', () => {
    bajoElPuntero(null);
    arrastrar();
    expect(document.querySelector('.arrastre-fantasma')).not.toBeNull();
    expect(document.querySelector('.arrastre-fantasma .arrastre-interior')).not.toBeNull();
    expect(document.body.classList.contains('arrastrando')).toBe(true);

    soltar();
    expect(document.querySelector('.arrastre-fantasma')).toBeNull();
    expect(document.body.classList.contains('arrastrando')).toBe(false);
  });

  it('soltar sobre un Quodom del mismo rubro avisa con ese destino', () => {
    document.body.innerHTML = '<button data-destino="q-1" data-rubro="5"></button>';
    bajoElPuntero(document.querySelector('button'));
    const onSoltar = arrastrar({ idrubro: 5 });

    soltar();

    expect(onSoltar).toHaveBeenCalledWith({ tipo: 'quodom', idquodom: 'q-1', idrubro: 5 });
  });

  it('soltar en la zona de Quodom nuevo del mismo rubro lo pide', () => {
    document.body.innerHTML = '<button data-nuevo="5" data-rubro="5"></button>';
    bajoElPuntero(document.querySelector('button'));
    const onSoltar = arrastrar({ idrubro: 5 });

    soltar();

    expect(onSoltar).toHaveBeenCalledWith({ tipo: 'nuevo', idrubro: 5 });
  });

  it('un Quodom de otro rubro se marca como rechazo y soltar no hace nada', () => {
    document.body.innerHTML = '<button data-destino="q-9" data-rubro="1"></button>';
    const boton = document.querySelector('button')!;
    bajoElPuntero(boton);
    const onSoltar = arrastrar({ idrubro: 5 });

    expect(boton.classList.contains('arrastre-rechaza')).toBe(true);
    expect(boton.classList.contains('arrastre-encima')).toBe(false);

    expect(() => soltar()).not.toThrow();
    expect(onSoltar).not.toHaveBeenCalled();
    expect(boton.classList.contains('arrastre-rechaza')).toBe(false);
  });

  it('un Quodom del mismo rubro se marca como válido', () => {
    document.body.innerHTML = '<button data-destino="q-1" data-rubro="5"></button>';
    const boton = document.querySelector('button')!;
    bajoElPuntero(boton);
    arrastrar({ idrubro: 5 });

    expect(boton.classList.contains('arrastre-encima')).toBe(true);
    expect(document.querySelector('.arrastre-interior')!.classList.contains('entrando')).toBe(true);
    soltar();
  });

  it('soltar en el vacío no hace nada ni falla', () => {
    document.body.innerHTML = '<div id="nada"></div>';
    bajoElPuntero(document.getElementById('nada'));
    const onSoltar = arrastrar();

    expect(() => soltar()).not.toThrow();
    expect(onSoltar).not.toHaveBeenCalled();
  });

  it('soltar sobre la cabecera de un rubro no hace nada', () => {
    document.body.innerHTML = '<button data-rubro-cab="5" data-rubro="5"></button>';
    bajoElPuntero(document.querySelector('button'));
    const onSoltar = arrastrar();

    soltar();

    expect(onSoltar).not.toHaveBeenCalled();
  });

  it('pasar sobre la cabecera de un rubro avisa para que se despliegue', () => {
    document.body.innerHTML = '<button data-rubro-cab="5"></button>';
    bajoElPuntero(document.querySelector('button'));
    const oyente = vi.fn();
    window.addEventListener('arrastre:sobre-rubro', oyente);
    arrastrar();

    window.removeEventListener('arrastre:sobre-rubro', oyente);
    soltar();
    expect(oyente).toHaveBeenCalledTimes(1);
    expect((oyente.mock.calls[0][0] as CustomEvent).detail).toEqual({ idrubro: 5 });
  });

  // Un oyente que quedó instalado sigue marcando destinos y, peor, vuelve a soltar.
  it('después de soltar los oyentes se fueron: ni marcan destinos ni sueltan de nuevo', () => {
    document.body.innerHTML = '<button data-destino="q-1" data-rubro="5"></button>';
    const boton = document.querySelector('button')!;
    bajoElPuntero(boton);
    const onSoltar = arrastrar({ idrubro: 5 });
    soltar();
    expect(onSoltar).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new PointerEvent('pointermove', { buttons: 1, clientX: 300, clientY: 300 }));
    soltar();

    expect(boton.classList.contains('arrastre-encima')).toBe(false);
    expect(onSoltar).toHaveBeenCalledTimes(1);
  });

  it('pointercancel aborta: saca el fantasma y no suelta aunque haya un destino debajo', () => {
    document.body.innerHTML = '<button data-destino="q-1" data-rubro="5"></button>';
    bajoElPuntero(document.querySelector('button'));
    const onSoltar = arrastrar({ idrubro: 5 });

    window.dispatchEvent(new PointerEvent('pointercancel', { clientX: 140, clientY: 160 }));

    expect(onSoltar).not.toHaveBeenCalled();
    expect(document.querySelector('.arrastre-fantasma')).toBeNull();
    expect(document.body.classList.contains('arrastrando')).toBe(false);
  });

  describe('un pointerup que nunca llega', () => {
    function destinoValido() {
      document.body.innerHTML = '<button data-destino="q-1" data-rubro="5"></button>';
      bajoElPuntero(document.querySelector('button'));
    }

    function estaLimpio() {
      return document.querySelector('.arrastre-fantasma') === null
        && !document.body.classList.contains('arrastrando')
        && document.querySelector('.arrastre-encima') === null;
    }

    it('un movimiento sin botón apretado aborta el arrastre', () => {
      destinoValido();
      const onSoltar = arrastrar({ idrubro: 5 });

      window.dispatchEvent(new PointerEvent('pointermove', { buttons: 0, clientX: 150, clientY: 170 }));

      expect(estaLimpio()).toBe(true);
      // El clic siguiente, en cualquier lado, ya no puede soltar nada.
      soltar();
      expect(onSoltar).not.toHaveBeenCalled();
    });

    it('perder el foco de la ventana aborta el arrastre', () => {
      destinoValido();
      const onSoltar = arrastrar({ idrubro: 5 });

      window.dispatchEvent(new Event('blur'));

      expect(estaLimpio()).toBe(true);
      soltar();
      expect(onSoltar).not.toHaveBeenCalled();
    });

    it('Escape aborta el arrastre', () => {
      destinoValido();
      const onSoltar = arrastrar({ idrubro: 5 });

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(estaLimpio()).toBe(true);
      soltar();
      expect(onSoltar).not.toHaveBeenCalled();
    });

    it('abortar no deja un bloqueo de clic que se coma el siguiente', async () => {
      // Deja caducar los bloqueos de los soltados de tests anteriores.
      await new Promise(r => setTimeout(r, 150));
      destinoValido();
      arrastrar({ idrubro: 5 });
      window.dispatchEvent(new Event('blur'));
      const alClic = vi.fn();
      document.body.addEventListener('click', alClic);

      document.body.click();

      expect(alClic).toHaveBeenCalledTimes(1);
      document.body.removeEventListener('click', alClic);
    });
  });
});

describe('soltar con el DOM que cambia bajo el puntero', () => {
  it('resuelve el destino antes de limpiar: la zona "Quodom nuevo" sólo existe mientras `arrastrando`', () => {
    document.body.innerHTML = '<button data-nuevo="5" data-rubro="5" id="nuevo"></button>';
    const nuevo = document.getElementById('nuevo')!;
    // Como el CSS real: sin `arrastrando` la zona está oculta y no hay nada bajo el puntero.
    vi.spyOn(document, 'elementFromPoint').mockImplementation(
      () => (document.body.classList.contains('arrastrando') ? nuevo : null));
    const onSoltar = arrastrar();

    soltar();

    expect(onSoltar).toHaveBeenCalledTimes(1);
    expect(onSoltar).toHaveBeenCalledWith({ tipo: 'nuevo', idrubro: 5 });
    expect(document.body.classList.contains('arrastrando')).toBe(false);
  });

  it('limpia igual cuando el destino es de otro rubro', () => {
    document.body.innerHTML = '<button data-nuevo="9" data-rubro="9" id="nuevo"></button>';
    const nuevo = document.getElementById('nuevo')!;
    vi.spyOn(document, 'elementFromPoint').mockImplementation(
      () => (document.body.classList.contains('arrastrando') ? nuevo : null));
    const onSoltar = arrastrar();

    soltar();

    expect(onSoltar).not.toHaveBeenCalled();
    expect(document.body.classList.contains('arrastrando')).toBe(false);
    expect(document.querySelector('.arrastre-fantasma')).toBeNull();
  });
});

// La tarjeta que se levanta tiene que verse levantada: antes el único rastro era
// un rectángulo chico que aparecía de golpe y la tarjeta seguía igual, así que
// con el dedo no se notaba cuándo ya se podía arrastrar.
describe('la tarjeta de origen', () => {
  function tarjeta() {
    document.body.innerHTML = '<li id="t"><img src="/img/producto/137" alt="" /></li>';
    return document.getElementById('t')!;
  }
  function conDedo(x = 100, y = 100) {
    return new PointerEvent('pointerdown', { clientX: x, clientY: y, button: 0, pointerType: 'touch', bubbles: true });
  }

  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { window.dispatchEvent(new Event('arrastre:abortar')); vi.useRealTimers(); });

  it('con el dedo apretado se marca como cargando, y al levantar queda como hueco', () => {
    const origen = tarjeta();
    iniciarArrastre(conDedo(), { idrubro: 5, nombre: 'Látex', nombreRubro: 'PINTURERÍA', onSoltar: vi.fn(), origen });
    expect(origen).toHaveClass('arrastre-cargando');

    vi.advanceTimersByTime(ESPERA_TOQUE_MS);
    expect(origen).not.toHaveClass('arrastre-cargando');
    expect(origen).toHaveClass('arrastre-origen');
  });

  it('si el dedo se mueve antes de tiempo, era scroll: no queda marcada', () => {
    const origen = tarjeta();
    iniciarArrastre(conDedo(), { idrubro: 5, nombre: 'Látex', nombreRubro: 'PINTURERÍA', onSoltar: vi.fn(), origen });
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 100, clientY: 140, pointerType: 'touch' }));

    expect(origen).not.toHaveClass('arrastre-cargando');
    expect(origen).not.toHaveClass('arrastre-origen');
  });

  it('al soltar vuelve a la normalidad', () => {
    const origen = tarjeta();
    iniciarArrastre(conDedo(), { idrubro: 5, nombre: 'Látex', nombreRubro: 'PINTURERÍA', onSoltar: vi.fn(), origen });
    vi.advanceTimersByTime(ESPERA_TOQUE_MS);
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 100, clientY: 100, pointerType: 'touch' }));

    expect(origen).not.toHaveClass('arrastre-origen');
  });

  it('el fantasma lleva la foto del producto', () => {
    const origen = tarjeta();
    iniciarArrastre(conDedo(), { idrubro: 5, nombre: 'Látex', nombreRubro: 'PINTURERÍA', onSoltar: vi.fn(), origen });
    vi.advanceTimersByTime(ESPERA_TOQUE_MS);

    const foto = document.querySelector<HTMLImageElement>('.arrastre-fantasma img');
    expect(foto?.getAttribute('src')).toBe('/img/producto/137');
  });

  it('con el mouse no hay espera: se marca al levantar', () => {
    const origen = tarjeta();
    iniciarArrastre(evento(100, 100), { idrubro: 5, nombre: 'Látex', nombreRubro: 'PINTURERÍA', onSoltar: vi.fn(), origen });
    expect(origen).not.toHaveClass('arrastre-cargando');

    window.dispatchEvent(new PointerEvent('pointermove', { buttons: 1, clientX: 140, clientY: 160 }));
    expect(origen).toHaveClass('arrastre-origen');
  });
});

// Dejar el dedo apretado sobre un texto lo selecciona (Android lo marca en
// azul con sus manijas): al levantar el producto, esa selección no es del usuario.
describe('al levantar con el dedo', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { window.dispatchEvent(new Event('arrastre:abortar')); vi.useRealTimers(); });

  it('borra el texto que el navegador haya seleccionado', () => {
    document.body.innerHTML = '<li id="t"><span>Latex Interior Blanco Mate</span></li>';
    const rango = document.createRange();
    rango.selectNodeContents(document.querySelector('span')!);
    window.getSelection()!.addRange(rango);

    iniciarArrastre(new PointerEvent('pointerdown', { clientX: 100, clientY: 100, button: 0, pointerType: 'touch', bubbles: true }),
      { idrubro: 5, nombre: 'Látex', nombreRubro: 'PINTURERÍA', onSoltar: vi.fn(), origen: document.getElementById('t')! });
    vi.advanceTimersByTime(ESPERA_TOQUE_MS);

    expect(window.getSelection()!.toString()).toBe('');
  });
});
