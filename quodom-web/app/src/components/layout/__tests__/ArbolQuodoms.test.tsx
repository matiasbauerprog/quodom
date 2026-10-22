import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { ArbolQuodoms, type RamaRubro } from '../ArbolQuodoms';
import { abiertoDe, abrirQuodom } from '../../../quodom/quodomAbierto';
import { ramasDeQuodoms } from '../../../quodom/ramas';
import type { Quodom } from '../../../api/types';
import { quodom as quodomApi } from '../../../api/quodom';

vi.mock('../../../api/quodom', () => ({ quodom: { update: vi.fn(), create: vi.fn() } }));

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

// Cambiar de rubro sin remontar el árbol: es lo que hace el catálogo al tocar
// otro rubro, y lo que el árbol tiene que acompañar.
function Conmutador({ ramas = RAMAS }: { ramas?: RamaRubro[] }) {
  const [, setParams] = useSearchParams();
  return (
    <>
      <button onClick={() => setParams({ rubro: '1' })}>ir a limpieza</button>
      <button onClick={() => setParams({ rubro: '5' })}>ir a pinturería</button>
      <ArbolQuodoms ramas={ramas} onCambio={vi.fn()} />
    </>
  );
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

  it('desplegar un rubro plegado lo muestra sin ningún Quodom abierto', () => {
    abrirQuodom(5, 'p1');
    montar();

    fireEvent.click(screen.getByRole('button', { name: /PINTURERÍA/ }));
    fireEvent.click(screen.getByRole('button', { name: /PINTURERÍA/ }));

    expect(abiertoDe(5)).toBeNull();
    expect(screen.getByRole('button', { name: /Casa/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('plegar un rubro no le cierra el Quodom abierto', () => {
    abrirQuodom(5, 'p1');
    montar();

    fireEvent.click(screen.getByRole('button', { name: /PINTURERÍA/ }));

    expect(abiertoDe(5)).toBe('p1');
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

});

// Entrar a un rubro deja el panel contestando por ese rubro: el resto plegado,
// y a la vista lo que hay en el que se está mirando.
describe('ArbolQuodoms · entrar a un rubro lo acomoda', () => {
  it('pliega los otros rubros', () => {
    montar(RAMAS, vi.fn(), '/?rubro=1');

    expect(screen.getByRole('button', { name: /Oficina/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Casa/ })).toBeNull();
    expect(screen.getByRole('button', { name: /PINTURERÍA/ })).toHaveAttribute('aria-expanded', 'false');
  });

  // Con un solo Quodom, "cuál es el destino" no tiene alternativa: preguntarlo
  // sería preguntar algo con una sola respuesta.
  it('con un solo Quodom lo abre, y se ven sus productos', () => {
    montar(RAMAS, vi.fn(), '/?rubro=1');

    expect(abiertoDe(1)).toBe('l1');
    expect(document.querySelector('[data-destino="l1"]')).toHaveTextContent('Recibe lo que agregás');
  });

  // Con varios, elegir por el usuario mandaría la compra a uno que él no eligió.
  it('con varios Quodoms no abre ninguno: los muestra y el usuario decide', () => {
    montar(RAMAS, vi.fn(), '/?rubro=5');

    expect(abiertoDe(5)).toBeNull();
    expect(screen.getByRole('button', { name: /Casa/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Depto/ })).toBeInTheDocument();
  });

  it('con varios, respeta el que ya estaba abierto', () => {
    abrirQuodom(5, 'p2');
    montar(RAMAS, vi.fn(), '/?rubro=5');

    expect(abiertoDe(5)).toBe('p2');
  });

  // El acomodo corre en el cambio de rubro y no en cada render: si corriera
  // siempre, cerrar el único Quodom a mano lo volvería a abrir en el acto.
  it('cerrar a mano el único Quodom no lo reabre', () => {
    montar(RAMAS, vi.fn(), '/?rubro=1');

    fireEvent.click(screen.getByRole('button', { name: /Oficina/ }));

    expect(abiertoDe(1)).toBeNull();
  });

  it('cambiar de rubro acomoda el nuevo y pliega el anterior', () => {
    render(<MemoryRouter initialEntries={['/?rubro=5']}><Conmutador /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Casa/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ir a limpieza/ }));

    expect(abiertoDe(1)).toBe('l1');
    expect(screen.queryByRole('button', { name: /Casa/ })).toBeNull();
  });

  // `ramas` vacío es "todavía no cargó": acomodar ahí daría por hecho que el
  // rubro no tiene Quodoms, y no se volvería a intentar cuando lleguen.
  it('no acomoda nada mientras la lista no cargó', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/?rubro=1']}><ArbolQuodoms ramas={[]} onCambio={vi.fn()} /></MemoryRouter>
    );
    expect(abiertoDe(1)).toBeNull();

    rerender(
      <MemoryRouter initialEntries={['/?rubro=1']}><ArbolQuodoms ramas={RAMAS} onCambio={vi.fn()} /></MemoryRouter>
    );

    expect(abiertoDe(1)).toBe('l1');
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

// Cambiar el nombre obligaba a abrir el detalle: el usuario lo pidió en el panel.
describe('ArbolQuodoms: renombrar desde el panel', () => {
  beforeEach(() => {
    vi.mocked(quodomApi.update).mockReset().mockResolvedValue(true as never);
    abrirQuodom(5, 'p1');
  });

  it('el lápiz vuelve editable el nombre y Enter lo guarda', async () => {
    const cambio = vi.fn();
    window.addEventListener('quodom:changed', cambio);
    montar();

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar el nombre' }));
    const campo = screen.getByRole('textbox', { name: 'Nombre del Quodom' });
    expect(campo).toHaveValue('Casa');
    expect(document.activeElement).toBe(campo);

    fireEvent.change(campo, { target: { value: '  Casa de mamá ' } });
    await act(async () => { fireEvent.keyDown(campo, { key: 'Enter' }); });

    expect(quodomApi.update).toHaveBeenCalledWith('p1', { descripcion: 'Casa de mamá' });
    expect(cambio).toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: 'Nombre del Quodom' })).toBeNull();
    window.removeEventListener('quodom:changed', cambio);
  });

  it('Escape cancela sin guardar', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar el nombre' }));
    const campo = screen.getByRole('textbox', { name: 'Nombre del Quodom' });
    fireEvent.change(campo, { target: { value: 'Otra cosa' } });
    await act(async () => { fireEvent.keyDown(campo, { key: 'Escape' }); });

    expect(quodomApi.update).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Casa/, expanded: true })).toBeInTheDocument();
  });

  it('si el servidor falla lo dice y deja el campo abierto', async () => {
    vi.mocked(quodomApi.update).mockRejectedValue(new Error('x'));
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar el nombre' }));
    const campo = screen.getByRole('textbox', { name: 'Nombre del Quodom' });
    fireEvent.change(campo, { target: { value: 'Casa nueva' } });
    await act(async () => { fireEvent.keyDown(campo, { key: 'Enter' }); });

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cambiar el nombre.');
    expect(screen.getByRole('textbox', { name: 'Nombre del Quodom' })).toHaveValue('Casa nueva');
  });

  it('los Quodoms plegados no muestran el lápiz', () => {
    montar();
    expect(screen.getAllByRole('button', { name: 'Cambiar el nombre' })).toHaveLength(1);
  });
});

// Crear uno nuevo sin salir del panel; antes había que ir a Mis Quodoms.
describe('ArbolQuodoms: crear un Quodom desde el rubro', () => {
  beforeEach(() => {
    vi.mocked(quodomApi.create).mockReset().mockResolvedValue({ res: true, idquodom: 'p3' } as never);
  });

  it('cada rubro desplegado lo ofrece, y uno plegado no', () => {
    montar();
    expect(screen.getAllByRole('button', { name: '+ Nuevo Quodom' })).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: /PINTURERÍA/ }));
    expect(screen.getAllByRole('button', { name: '+ Nuevo Quodom' })).toHaveLength(2);
  });

  it('mientras se arrastra no está: lo reemplaza la zona de soltar', () => {
    montar();
    empezarArrastre(5);
    expect(screen.queryByRole('button', { name: '+ Nuevo Quodom' })).toBeNull();
  });

  it('lo crea en su rubro, lo deja abierto y con el nombre para cambiar', async () => {
    const onCambio = vi.fn();
    const { rerender } = render(<MemoryRouter><ArbolQuodoms ramas={RAMAS} onCambio={onCambio} /></MemoryRouter>);
    const [, enPintura] = screen.getAllByRole('button', { name: '+ Nuevo Quodom' });

    await act(async () => { fireEvent.click(enPintura); });

    expect(quodomApi.create).toHaveBeenCalledWith({ descripcion: 'Nuevo Quodom de Pintura', idrubro: 5 });
    expect(abiertoDe(5)).toBe('p3');
    expect(onCambio).toHaveBeenCalled();

    // La recarga trae el nuevo, que aparece como destino y editando el nombre.
    const conNuevo = RAMAS.map(r => r.idrubro === 5
      ? { ...r, quodoms: [...r.quodoms, q('p3', 'Nuevo Quodom de Pintura', 5)] } : r);
    rerender(<MemoryRouter><ArbolQuodoms ramas={conNuevo} onCambio={onCambio} /></MemoryRouter>);
    expect(screen.getByRole('textbox', { name: 'Nombre del Quodom' })).toHaveValue('Nuevo Quodom de Pintura');
  });

  // En celular, entre que el servidor contesta y la lista se recarga pasaba un
  // rato sin que nada cambiara, y el usuario podía pensar que no había andado.
  it('al tocarlo ya muestra el Quodom que se está creando, aunque el servidor no conteste', () => {
    vi.mocked(quodomApi.create).mockReturnValue(new Promise(() => {}) as never);
    montar();
    const [, enPintura] = screen.getAllByRole('button', { name: '+ Nuevo Quodom' });
    fireEvent.click(enPintura);

    expect(screen.getByRole('status')).toHaveTextContent('Creando Nuevo Quodom de Pintura…');
  });

  it('sigue mostrándolo hasta que llega en la lista', async () => {
    const onCambio = vi.fn();
    const { rerender } = render(<MemoryRouter><ArbolQuodoms ramas={RAMAS} onCambio={onCambio} /></MemoryRouter>);
    const [, enPintura] = screen.getAllByRole('button', { name: '+ Nuevo Quodom' });
    await act(async () => { fireEvent.click(enPintura); });

    // El servidor ya contestó, pero la recarga todavía no trajo el nuevo.
    expect(screen.getByRole('status')).toHaveTextContent('Creando Nuevo Quodom de Pintura…');

    const conNuevo = RAMAS.map(r => r.idrubro === 5
      ? { ...r, quodoms: [...r.quodoms, q('p3', 'Nuevo Quodom de Pintura', 5)] } : r);
    rerender(<MemoryRouter><ArbolQuodoms ramas={conNuevo} onCambio={onCambio} /></MemoryRouter>);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('si el servidor falla lo dice en ese rubro', async () => {
    vi.mocked(quodomApi.create).mockRejectedValue(new Error('x'));
    montar();
    const [, enPintura] = screen.getAllByRole('button', { name: '+ Nuevo Quodom' });
    await act(async () => { fireEvent.click(enPintura); });

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo crear el Quodom.');
    expect(abiertoDe(5)).toBeNull();
  });
});

// En la hoja de celular el último rubro se desplegaba fuera de la vista, y
// "+ Nuevo Quodom" quedaba abajo: había que scrollear para encontrarlo.
describe('ArbolQuodoms: desplegar un rubro lo trae a la vista', () => {
  it('desplegarlo lo lleva a la vista con su pie', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    montar();
    const pintura = screen.getByRole('button', { name: /PINTURERÍA/ });
    fireEvent.click(pintura);          // plegar
    scroll.mockClear();
    fireEvent.click(pintura);          // desplegar

    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ block: 'nearest' }));
    expect(scroll.mock.instances[0] as unknown).toBe(pintura.closest('section'));
  });

  it('plegarlo no mueve nada', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    montar();
    fireEvent.click(screen.getByRole('button', { name: /PINTURERÍA/ }));
    expect(scroll).not.toHaveBeenCalled();
  });
});
