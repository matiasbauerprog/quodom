import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { blancoBajo, iniciarArrastre } from '../arrastre';

function evento(x: number, y: number) {
  return new PointerEvent('pointerdown', { clientX: x, clientY: y, button: 0, bubbles: true });
}

function bajoElPuntero(el: Element | null) {
  vi.spyOn(document, 'elementFromPoint').mockReturnValue(el);
}

function arrastrar(opts: { idrubro?: number; onSoltar?: ReturnType<typeof vi.fn> } = {}) {
  const onSoltar = opts.onSoltar ?? vi.fn();
  iniciarArrastre(evento(100, 100), { idrubro: opts.idrubro ?? 5, nombre: 'Látex', nombreRubro: 'PINTURERÍA', onSoltar });
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: 140, clientY: 160 }));
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

    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 102, clientY: 101 }));
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

  it('después de soltar ya no reacciona a movimientos', () => {
    bajoElPuntero(null);
    arrastrar();
    soltar();

    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 300, clientY: 300 }));

    expect(document.querySelector('.arrastre-fantasma')).toBeNull();
  });
});
