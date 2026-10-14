import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ArbolQuodoms, type RamaRubro } from '../ArbolQuodoms';
import { abiertoDe, abrirQuodom } from '../../../quodom/quodomAbierto';
import { ramasDeQuodoms } from '../../../quodom/ramas';
import type { Quodom } from '../../../api/types';

function q(id: string, descripcion: string, idrubro: number, estado = 'CREADO'): Quodom {
  return { id, descripcion, estado, nro: 'QD-' + id, idrubro, cantproductos: 2, porccompletado: 100 } as unknown as Quodom;
}

// Las ramas salen de la misma función que usa la app, así el fixture es lo que
// ella de verdad produce (incluido un rubro sin Quodoms, como Bebidas).
const RAMAS: RamaRubro[] = ramasDeQuodoms(
  [q('p1', 'Casa', 5), q('p2', 'Depto', 5), q('l1', 'Oficina', 1)],
  [1, 5, 7]
).map(r => ({ ...r, nombre: { 1: 'LIMPIEZA', 5: 'PINTURERÍA', 7: 'BEBIDAS' }[r.idrubro]! }));

function montar(ramas = RAMAS, onCambio = vi.fn(), url = '/') {
  render(<MemoryRouter initialEntries={[url]}><ArbolQuodoms ramas={ramas} onCambio={onCambio} /></MemoryRouter>);
  return onCambio;
}

// Lo que dispara una tarjeta del catálogo al levantarse del umbral.
function empezarArrastre(idrubro: number) {
  act(() => {
    window.dispatchEvent(new CustomEvent('arrastre:inicio', {
      detail: { idrubro, nombre: 'Rodillo lana 22 cm', nombreRubro: 'Pinturería' }
    }));
  });
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

// El destino se dibuja como tarjeta, y los atributos del arrastre se mudaron de
// la cabecera a la raíz de la tarjeta: la abierta mide varias veces el alto de su
// cabecera, así que soltar sobre las líneas no encontraba destino.
describe('ArbolQuodoms · la tarjeta del destino', () => {
  it('el abierto lleva los datos del arrastre en toda la tarjeta', () => {
    abrirQuodom(5, 'p1');
    montar();

    const tarjeta = document.querySelector('[data-destino="p1"]')!;
    expect(tarjeta).toHaveAttribute('data-rubro', '5');
    // La cabecera es un botón adentro de la tarjeta, no la tarjeta misma.
    expect(tarjeta.tagName).toBe('ARTICLE');
    expect(tarjeta).toHaveTextContent('Recibe lo que agregás');
  });

  it('un rubro con Quodoms pero sin destino lo avisa', () => {
    montar();

    expect(screen.getByText(/sin destino: al agregar algo de PINTURERÍA/i)).toBeInTheDocument();
  });

  it('con un destino abierto ese aviso no está', () => {
    abrirQuodom(5, 'p1');
    montar();

    expect(screen.queryByText(/sin destino: al agregar algo de PINTURERÍA/i)).toBeNull();
  });
});

// El panel tiene que contestar "¿dónde cae lo de esta pantalla?", y con ocho
// rubros el del catálogo podía quedar abajo, fuera de vista.
describe('ArbolQuodoms · el rubro que se está mirando', () => {
  it('sube al tope de la lista', () => {
    montar(RAMAS, vi.fn(), '/?rubro=7');

    const rubros = Array.from(document.querySelectorAll('[data-rubro-cab]'))
      .map(e => e.getAttribute('data-rubro-cab'));
    expect(rubros).toEqual(['7', '1', '5']);
  });

  it('sin rubro en pantalla la lista queda como viene', () => {
    montar();

    const rubros = Array.from(document.querySelectorAll('[data-rubro-cab]'))
      .map(e => e.getAttribute('data-rubro-cab'));
    expect(rubros).toEqual(['1', '5', '7']);
  });
});

describe('ArbolQuodoms · soltar un producto', () => {
  it('sin arrastre no hay ninguna zona para soltar', () => {
    montar();

    expect(document.querySelectorAll('[data-nuevo]')).toHaveLength(0);
  });

  // Es lo que hace que un rubro sin Quodoms sea un destino válido. Sólo aparece
  // en el rubro del producto que se arrastra: en cualquier otro, soltar es un
  // 409 del servidor, así que ofrecerlo era ofrecer un error.
  it('arrastrando, sólo el rubro del producto ofrece crear uno nuevo', () => {
    montar();

    empezarArrastre(5);

    const zonas = Array.from(document.querySelectorAll('[data-nuevo]'));
    expect(zonas.map(z => z.getAttribute('data-nuevo'))).toEqual(['5']);
    expect(zonas[0]).toHaveAttribute('data-rubro', '5');
    expect(zonas[0]).toHaveTextContent('Soltar en un Quodom nuevo');
  });

  it('un rubro sin Quodoms también la ofrece: soltar ahí crea el primero', () => {
    montar();

    empezarArrastre(7);

    expect(document.querySelector('[data-nuevo="7"]')).toHaveAttribute('data-rubro', '7');
  });

  it('al terminar el arrastre la zona se va', () => {
    montar();
    empezarArrastre(5);

    act(() => { window.dispatchEvent(new Event('arrastre:fin')); });

    expect(document.querySelectorAll('[data-nuevo]')).toHaveLength(0);
  });

  it('un rubro plegado no tiene zonas para soltar', () => {
    montar();
    empezarArrastre(5);

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
