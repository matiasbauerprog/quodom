import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { ManijaPanel } from '../ManijaPanel';

const CLAVE = 'quodom.anchoPanel';
const ANCHO_LAYOUT = 1400;

function ancho(): string {
  return document.documentElement.style.getPropertyValue('--ancho-panel');
}

// happy-dom no mide nada: el layout se finge de 1400px, así el tope es 700.
function montar() {
  render(
    <div data-testid="layout">
      <main />
      <ManijaPanel />
      <aside />
    </div>
  );
  const manija = screen.getByRole('separator', { name: /ancho del panel/i });
  return manija;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.style.removeProperty('--ancho-panel');
  delete document.documentElement.dataset.panelCerrado;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    { left: 0, right: ANCHO_LAYOUT, width: ANCHO_LAYOUT, top: 0, bottom: 800, height: 800, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
  );
});

afterEach(() => { vi.restoreAllMocks(); });

describe('ManijaPanel', () => {
  it('sin nada guardado deja el ancho por defecto del CSS', () => {
    montar();
    expect(ancho()).toBe('');
  });

  it('restaura el ancho que el usuario dejó', () => {
    localStorage.setItem(CLAVE, '420');
    montar();
    expect(ancho()).toBe('420px');
  });

  it('ignora un valor guardado que no es un número', () => {
    localStorage.setItem(CLAVE, 'ancho');
    montar();
    expect(ancho()).toBe('');
  });

  it('acota lo guardado a la mitad del layout', () => {
    localStorage.setItem(CLAVE, '9999');
    montar();
    expect(ancho()).toBe('700px');
  });

  it('arrastrar mide desde el borde derecho y guarda al soltar', () => {
    const manija = montar();
    fireEvent.pointerDown(manija, { clientX: 980, button: 0 });
    fireEvent.pointerMove(manija, { clientX: 1000 });
    expect(ancho()).toBe('400px');
    // Mientras se arrastra no se escribe en el storage: serían cientos de escrituras.
    expect(localStorage.getItem(CLAVE)).toBeNull();
    fireEvent.pointerUp(manija, { clientX: 1000 });
    expect(localStorage.getItem(CLAVE)).toBe('400');
  });

  it('mover el mouse sin haber apretado no cambia nada', () => {
    const manija = montar();
    fireEvent.pointerMove(manija, { clientX: 1000 });
    expect(ancho()).toBe('');
  });

  it('con las flechas se ensancha y se angosta, y se guarda', () => {
    localStorage.setItem(CLAVE, '400');
    const manija = montar();
    fireEvent.keyDown(manija, { key: 'ArrowLeft' });
    expect(ancho()).toBe('416px');
    fireEvent.keyDown(manija, { key: 'ArrowRight' });
    fireEvent.keyDown(manija, { key: 'ArrowRight' });
    expect(ancho()).toBe('384px');
    expect(localStorage.getItem(CLAVE)).toBe('384');
    expect(manija).toHaveAttribute('aria-valuenow', '384');
  });

  it('doble clic vuelve al ancho de siempre', () => {
    localStorage.setItem(CLAVE, '500');
    const manija = montar();
    fireEvent.doubleClick(manija);
    expect(ancho()).toBe('');
    expect(localStorage.getItem(CLAVE)).toBeNull();
  });
});

const cerrado = () => document.documentElement.dataset.panelCerrado === 'true';

describe('ManijaPanel: cerrar y volver a abrir', () => {
  it('arrastrar por debajo de 200px cierra el panel y lo recuerda', () => {
    const manija = montar();
    fireEvent.pointerDown(manija, { clientX: 980, button: 0 });
    fireEvent.pointerMove(manija, { clientX: 1250 });
    expect(cerrado()).toBe(true);
    fireEvent.pointerUp(manija, { clientX: 1250 });
    expect(localStorage.getItem('quodom.panelCerrado')).toBe('1');
  });

  it('entre 200 y el mínimo se queda en el mínimo, sin cerrarse', () => {
    const manija = montar();
    fireEvent.pointerDown(manija, { clientX: 980, button: 0 });
    fireEvent.pointerMove(manija, { clientX: 1150 });
    fireEvent.pointerUp(manija, { clientX: 1150 });
    expect(cerrado()).toBe(false);
    expect(ancho()).toBe('300px');
  });

  it('arrastrar desde el borde con el panel cerrado lo vuelve a abrir', () => {
    localStorage.setItem('quodom.panelCerrado', '1');
    const manija = montar();
    expect(cerrado()).toBe(true);
    fireEvent.pointerDown(manija, { clientX: 1398, button: 0 });
    fireEvent.pointerMove(manija, { clientX: 1000 });
    fireEvent.pointerUp(manija, { clientX: 1000 });
    expect(cerrado()).toBe(false);
    expect(ancho()).toBe('400px');
    expect(localStorage.getItem('quodom.panelCerrado')).toBeNull();
  });

  it('un clic en el borde cerrado no lo abre', () => {
    localStorage.setItem('quodom.panelCerrado', '1');
    const manija = montar();
    fireEvent.pointerDown(manija, { clientX: 1399, button: 0 });
    fireEvent.pointerUp(manija, { clientX: 1399 });
    expect(cerrado()).toBe(true);
  });

  it('con teclado: → en el mínimo lo cierra y ← lo abre en el mínimo', () => {
    localStorage.setItem(CLAVE, '300');
    const manija = montar();
    fireEvent.keyDown(manija, { key: 'ArrowRight' });
    expect(cerrado()).toBe(true);
    fireEvent.keyDown(manija, { key: 'ArrowLeft' });
    expect(cerrado()).toBe(false);
    expect(ancho()).toBe('300px');
  });

  it('abrirPanel lo vuelve al ancho original', async () => {
    const { abrirPanel } = await import('../panelLateral');
    localStorage.setItem(CLAVE, '500');
    localStorage.setItem('quodom.panelCerrado', '1');
    montar();
    act(() => abrirPanel());
    expect(cerrado()).toBe(false);
    expect(ancho()).toBe('');
    expect(localStorage.getItem(CLAVE)).toBeNull();
  });

  it('abrirPanel con el panel abierto no le toca el ancho', async () => {
    const { abrirPanel } = await import('../panelLateral');
    localStorage.setItem(CLAVE, '500');
    montar();
    act(() => abrirPanel());
    expect(ancho()).toBe('500px');
  });
});
