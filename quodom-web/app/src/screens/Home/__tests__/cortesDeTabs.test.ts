import { describe, it, expect } from 'vitest';
import { cortesDeTabs } from '../cortesDeTabs';

// Cuatro pestañas de 80px con 8px entre ellas, en una fila de 300px de ancho.
const TABS = [0, 88, 176, 264].map(inicio => ({ inicio, fin: inicio + 80 }));

describe('cortesDeTabs', () => {
  it('si todas entran, no corta nada', () => {
    expect(cortesDeTabs(TABS.slice(0, 3), 0, 300)).toEqual({ izq: 0, der: null });
  });

  // La que queda partida contra el borde derecho no se muestra: se corta antes
  // de ella, y el lugar queda para la flecha.
  it('oculta la que queda cortada a la derecha', () => {
    expect(cortesDeTabs(TABS, 0, 300)).toEqual({ izq: 0, der: 264 });
  });

  // Si la cortada asoma poco, la flecha no entra: se oculta también la anterior.
  it('reserva lugar para la flecha', () => {
    expect(cortesDeTabs(TABS, 0, 260, 28)).toEqual({ izq: 0, der: 176 });
  });

  it('deslizada, oculta también la que quedó cortada a la izquierda', () => {
    // Desplazada 40px: la primera (0–80) asoma de 0 a 40.
    expect(cortesDeTabs(TABS, 40, 320)).toEqual({ izq: 40, der: null });
  });

  it('una que arranca justo en el borde izquierdo no cuenta como cortada', () => {
    expect(cortesDeTabs(TABS, 88, 300)).toEqual({ izq: 0, der: null });
  });
});
