import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ArbolQuodoms, type RamaRubro } from '../ArbolQuodoms';
import { abiertoDe, abrirQuodom } from '../../../quodom/quodomAbierto';
import type { Quodom } from '../../../api/types';

function q(id: string, descripcion: string, idrubro: number, estado = 'CREADO'): Quodom {
  return { id, descripcion, estado, nro: 'QD-' + id, idrubro, cantproductos: 2, porccompletado: 100 } as unknown as Quodom;
}

const RAMAS: RamaRubro[] = [
  { idrubro: 5, nombre: 'PINTURERÍA', quodoms: [q('p1', 'Casa', 5), q('p2', 'Depto', 5)] },
  { idrubro: 1, nombre: 'LIMPIEZA', quodoms: [q('l1', 'Oficina', 1)] },
  { idrubro: 7, nombre: 'BEBIDAS', quodoms: [] }
];

function montar(ramas = RAMAS, onCambio = vi.fn()) {
  render(<MemoryRouter><ArbolQuodoms ramas={ramas} onCambio={onCambio} /></MemoryRouter>);
  return onCambio;
}

beforeEach(() => { localStorage.clear(); });

describe('ArbolQuodoms', () => {
  it('muestra un rubro por rama con su cantidad', () => {
    montar();

    expect(screen.getByRole('button', { name: /PINTURERÍA/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /LIMPIEZA/ })).toBeInTheDocument();
  });

  it('muestra los Quodoms de un rubro desplegado', () => {
    montar();

    expect(screen.getByRole('button', { name: /Casa/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Depto/ })).toBeInTheDocument();
  });

  it('plegar un rubro esconde sus Quodoms', () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: /PINTURERÍA/ }));

    expect(screen.queryByRole('button', { name: /Casa/ })).toBeNull();
  });

  it('tocar un Quodom lo abre y lo deja marcado', () => {
    const onCambio = montar();

    fireEvent.click(screen.getByRole('button', { name: /Casa/ }));

    expect(abiertoDe(5)).toBe('p1');
    expect(screen.getByRole('button', { name: /Casa/ })).toHaveAttribute('aria-expanded', 'true');
    expect(onCambio).toHaveBeenCalled();
  });

  it('abrir otro del mismo rubro cierra el anterior', () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: /Casa/ }));
    fireEvent.click(screen.getByRole('button', { name: /Depto/ }));

    expect(screen.getByRole('button', { name: /Casa/ })).toHaveAttribute('aria-expanded', 'false');
    expect(abiertoDe(5)).toBe('p2');
  });

  it('cada rubro conserva el suyo', () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: /Casa/ }));
    fireEvent.click(screen.getByRole('button', { name: /Oficina/ }));

    expect(abiertoDe(5)).toBe('p1');
    expect(abiertoDe(1)).toBe('l1');
  });

  it('volver a tocar el abierto lo cierra', () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: /Casa/ }));
    fireEvent.click(screen.getByRole('button', { name: /Casa/ }));

    expect(abiertoDe(5)).toBeNull();
  });

  it('un rubro sin Quodoms lo dice, y sigue estando', () => {
    montar();

    expect(screen.getByText(/ningún quodom en armado/i)).toBeInTheDocument();
  });

  it('un Quodom que ya estaba abierto arranca marcado', () => {
    abrirQuodom(1, 'l1');
    montar();

    expect(screen.getByRole('button', { name: /Oficina/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /Casa/ })).toHaveAttribute('aria-expanded', 'false');
  });

  // El arrastre busca sus destinos en el DOM por estos dos atributos; si se pierden,
  // nada más falla y arrastrar deja de funcionar sin avisar.
  it('cada Quodom lleva los datos que el arrastre usa para encontrarlo', () => {
    montar();

    const casa = screen.getByRole('button', { name: /Casa/ });
    expect(casa).toHaveAttribute('data-destino', 'p1');
    expect(casa).toHaveAttribute('data-rubro', '5');
    const oficina = screen.getByRole('button', { name: /Oficina/ });
    expect(oficina).toHaveAttribute('data-destino', 'l1');
    expect(oficina).toHaveAttribute('data-rubro', '1');
  });
});

describe('ArbolQuodoms · soltar un producto', () => {
  // Es lo que hace que un rubro sin Quodoms sea un destino válido. Está siempre en
  // el DOM y la hoja de estilos lo muestra sólo mientras se arrastra.
  it('cada rubro desplegado ofrece una zona para soltar en un Quodom nuevo', () => {
    montar();

    const zonas = Array.from(document.querySelectorAll('[data-nuevo]'));
    expect(zonas.map(z => z.getAttribute('data-nuevo'))).toEqual(['5', '1', '7']);
    expect(zonas[2]).toHaveAttribute('data-rubro', '7');
    expect(zonas[2]).toHaveTextContent('Soltar en un Quodom nuevo');
  });

  it('un rubro plegado no tiene zonas para soltar', () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: /PINTURERÍA/ }));

    expect(document.querySelector('[data-nuevo="5"]')).toBeNull();
  });

  it('las cabeceras llevan el dato con el que el arrastre las reconoce', () => {
    montar();

    expect(screen.getByRole('button', { name: /PINTURERÍA/ })).toHaveAttribute('data-rubro-cab', '5');
  });

  it('arrastrar sobre un rubro plegado lo despliega', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /PINTURERÍA/ }));
    expect(screen.queryByRole('button', { name: /Casa/ })).toBeNull();

    act(() => { window.dispatchEvent(new CustomEvent('arrastre:sobre-rubro', { detail: { idrubro: 5 } })); });

    expect(screen.getByRole('button', { name: /Casa/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PINTURERÍA/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('arrastrar sobre un rubro ya desplegado no lo pliega', () => {
    montar();

    act(() => { window.dispatchEvent(new CustomEvent('arrastre:sobre-rubro', { detail: { idrubro: 5 } })); });

    expect(screen.getByRole('button', { name: /Casa/ })).toBeInTheDocument();
  });

  it('arrastrar sobre un rubro sólo despliega ese rubro', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /PINTURERÍA/ }));
    fireEvent.click(screen.getByRole('button', { name: /LIMPIEZA/ }));

    act(() => { window.dispatchEvent(new CustomEvent('arrastre:sobre-rubro', { detail: { idrubro: 5 } })); });

    expect(screen.getByRole('button', { name: /Casa/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Oficina/ })).toBeNull();
  });
});
