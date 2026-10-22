import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ListaProductos } from '../ListaProductos';
import { productos } from '../../../api/productos';
import { useAgregarProducto } from '../../../quodom/useAgregarProducto';
import { agregarADestino, crearYAgregar } from '../../../quodom/agregarProducto';
import { ESPERA_TOQUE_MS } from '../../../quodom/arrastre';

vi.mock('../../../api/productos', () => ({ productos: { porCategoria: vi.fn() } }));
vi.mock('../../../quodom/useAgregarProducto', () => ({ useAgregarProducto: vi.fn() }));
vi.mock('../../../quodom/agregarProducto', () => ({ agregarADestino: vi.fn(), crearYAgregar: vi.fn() }));
// El cartel del + nombra el Quodom abierto: los nombres salen de esta lista.
vi.mock('../../../api/quodom', () => ({ quodom: { misQuodom: vi.fn(() => Promise.resolve([
  { id: 'q-7', descripcion: 'Bebidas oficina', estado: 'CREADO', nro: 'QD-7', idrubro: 7 }
])) } }));
const auth = vi.hoisted(() => ({ user: { id: 'u-1' } as { id: string } | null }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));

const porCategoria = productos.porCategoria as unknown as ReturnType<typeof vi.fn>;
const agregar = vi.fn();
const pedirDestino = vi.fn();

const COCA = {
  id: 700, nombreproducto: 'Coca Cola 2L', descripcion: null, categoria: 70,
  categoriaPadre: 7, imagen: null, refreshImagen: null, atributo1: null, atributo2: null,
  valoresAtributo1: [], valoresAtributo2: []
};

const BOLSA = {
  id: 41, nombreproducto: 'Bolsa de residuos', descripcion: null, categoria: 70,
  categoriaPadre: 7, imagen: null, refreshImagen: null, atributo1: 'TIPO', atributo2: null,
  valoresAtributo1: ['Negra 60 x 90', 'Cristal 50 x 70'], valoresAtributo2: []
};

const LATEX = {
  id: 137, nombreproducto: 'Latex Interior', descripcion: null, categoria: 70,
  categoriaPadre: 7, imagen: null, refreshImagen: null, atributo1: 'LITROS', atributo2: 'MARCA',
  valoresAtributo1: ['4 L', '20 L'], valoresAtributo2: ['Alba']
};

beforeEach(() => {
  porCategoria.mockReset();
  agregar.mockReset();
  pedirDestino.mockReset();
  auth.user = { id: 'u-1' };
  vi.mocked(useAgregarProducto).mockReturnValue({
    agregar, agregando: false, error: null, destino: null,
    elegir: vi.fn(), crear: vi.fn(), cancelar: vi.fn(), pedirDestino
  } as unknown as ReturnType<typeof useAgregarProducto>);
});

describe('ListaProductos', () => {
  it('lista los productos de la subcategoría que recibe', async () => {
    porCategoria.mockResolvedValue([COCA]);
    render(<ListaProductos idsubcategoria={70} />);

    expect(await screen.findByText('Coca Cola 2L')).toBeInTheDocument();
    expect(porCategoria).toHaveBeenCalledWith(70);
  });

  it('recarga cuando cambia la subcategoría', async () => {
    porCategoria.mockResolvedValue([COCA]);
    const { rerender } = render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Coca Cola 2L');

    porCategoria.mockResolvedValue([{ ...COCA, id: 701, nombreproducto: 'Agua 500ml', categoria: 71 }]);
    rerender(<ListaProductos idsubcategoria={71} />);

    expect(await screen.findByText('Agua 500ml')).toBeInTheDocument();
    expect(porCategoria).toHaveBeenLastCalledWith(71);
  });

  it('agrega el producto con su rubro, que es lo que decide a qué Quodom va', async () => {
    porCategoria.mockResolvedValue([COCA]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Coca Cola 2L');

    fireEvent.click(screen.getByRole('button', { name: /^agregar coca cola 2l$/i }));

    expect(agregar).toHaveBeenCalledWith(
      expect.objectContaining({ idproducto: 700, nombreProducto: 'Coca Cola 2L', cantidad: 1 }),
      7
    );
  });

  it('avisa cuando la subcategoría no tiene productos', async () => {
    porCategoria.mockResolvedValue([]);
    render(<ListaProductos idsubcategoria={70} />);

    expect(await screen.findByText(/no hay productos/i)).toBeInTheDocument();
  });

  it('ofrece reintentar cuando la carga falla', async () => {
    porCategoria.mockRejectedValue(new Error('network down'));
    render(<ListaProductos idsubcategoria={70} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument());

    porCategoria.mockResolvedValue([COCA]);
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(await screen.findByText('Coca Cola 2L')).toBeInTheDocument();
  });
});

describe('ListaProductos · atributos en la tarjeta', () => {
  it('no muestra selector para un producto sin atributos', async () => {
    porCategoria.mockResolvedValue([COCA]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Coca Cola 2L');

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('ofrece los valores del atributo, con "no elegir" como opción por defecto', async () => {
    porCategoria.mockResolvedValue([BOLSA]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Bolsa de residuos');

    const select = screen.getByRole('combobox', { name: /tipo de bolsa de residuos/i }) as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(Array.from(select.options).map(o => o.textContent))
      .toEqual(['TIPO', 'Negra 60 x 90', 'Cristal 50 x 70']);
  });

  it('manda el valor elegido al agregar', async () => {
    porCategoria.mockResolvedValue([BOLSA]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Bolsa de residuos');

    fireEvent.change(screen.getByRole('combobox', { name: /tipo de bolsa de residuos/i }), {
      target: { value: 'Negra 60 x 90' }
    });
    fireEvent.click(screen.getByRole('button', { name: /^agregar bolsa de residuos$/i }));

    expect(agregar).toHaveBeenCalledWith(
      expect.objectContaining({ idproducto: 41, atributo1: 'Negra 60 x 90' }), 7
    );
  });

  it('agrega sin atributo si el usuario no elige ninguno', async () => {
    porCategoria.mockResolvedValue([BOLSA]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Bolsa de residuos');

    fireEvent.click(screen.getByRole('button', { name: /^agregar bolsa de residuos$/i }));

    const [linea] = agregar.mock.calls[0];
    expect(linea.atributo1).toBeUndefined();
    expect(linea.atributo2).toBeUndefined();
  });

  it('volver a la opción vacía borra el valor ya elegido', async () => {
    porCategoria.mockResolvedValue([BOLSA]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Bolsa de residuos');

    const select = screen.getByRole('combobox', { name: /tipo de bolsa de residuos/i });
    fireEvent.change(select, { target: { value: 'Negra 60 x 90' } });
    fireEvent.change(select, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /^agregar bolsa de residuos$/i }));

    expect(agregar.mock.calls[0][0].atributo1).toBeUndefined();
  });

  it('maneja los dos grupos de un producto que tiene dos', async () => {
    porCategoria.mockResolvedValue([LATEX]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Latex Interior');

    fireEvent.change(screen.getByRole('combobox', { name: /litros de latex interior/i }), { target: { value: '20 L' } });
    fireEvent.change(screen.getByRole('combobox', { name: /marca de latex interior/i }), { target: { value: 'Alba' } });
    fireEvent.click(screen.getByRole('button', { name: /^agregar latex interior$/i }));

    expect(agregar).toHaveBeenCalledWith(
      expect.objectContaining({ atributo1: '20 L', atributo2: 'Alba' }), 7
    );
  });

  it('lo elegido para un producto no se le pega a otro', async () => {
    porCategoria.mockResolvedValue([BOLSA, LATEX]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Bolsa de residuos');

    fireEvent.change(screen.getByRole('combobox', { name: /tipo de bolsa de residuos/i }), {
      target: { value: 'Negra 60 x 90' }
    });
    fireEvent.click(screen.getByRole('button', { name: /^agregar latex interior$/i }));

    expect(agregar.mock.calls[0][0].atributo1).toBeUndefined();
  });

  it('cambiar de subcategoría limpia lo elegido', async () => {
    porCategoria.mockResolvedValue([BOLSA]);
    const { rerender } = render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Bolsa de residuos');
    fireEvent.change(screen.getByRole('combobox', { name: /tipo de bolsa de residuos/i }), {
      target: { value: 'Negra 60 x 90' }
    });

    rerender(<ListaProductos idsubcategoria={71} />);
    await screen.findByText('Bolsa de residuos');

    expect((screen.getByRole('combobox', { name: /tipo de bolsa de residuos/i }) as HTMLSelectElement).value).toBe('');
  });

  it('el diálogo de destino conecta elegir, crear y el error del hook', () => {
    const elegir = vi.fn(); const crear = vi.fn();
    vi.mocked(useAgregarProducto).mockReturnValue({
      agregar, agregando: false, error: 'Falló', cancelar: vi.fn(), elegir, crear,
      destino: {
        idrubro: 7, items: [],
        candidatos: [{ id: 'q-casa', descripcion: 'Casa', cantproductos: 2, idrubro: 7 }]
      }
    } as unknown as ReturnType<typeof useAgregarProducto>);
    porCategoria.mockResolvedValue([]);
    render(<ListaProductos idsubcategoria={70} />);

    const dialogo = within(screen.getByRole('dialog'));
    fireEvent.click(dialogo.getByRole('button', { name: /casa/i }));
    fireEvent.click(dialogo.getByRole('button', { name: /un quodom nuevo de bebidas/i }));

    expect(elegir).toHaveBeenCalledWith('q-casa');
    expect(crear).toHaveBeenCalledTimes(1);
    expect(dialogo.getByRole('alert')).toHaveTextContent('Falló');
  });
});

// El "···" se fue de la tarjeta: era un control chiquito y críptico para una
// acción deliberada. Lo que abría —a qué Quodom del rubro va el producto— es lo
// que ahora abre el clic en el producto, y la tarjeta queda con el "+" solo.
describe('ListaProductos · mandar a otro Quodom', () => {
  it('la tarjeta ya no tiene el ···', async () => {
    porCategoria.mockResolvedValue([COCA, BOLSA]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Coca Cola 2L');

    expect(screen.queryByRole('button', { name: /a otro quodom/i })).not.toBeInTheDocument();
  });

  it('tocar el producto pide el destino del rubro con el atributo elegido, sin agregar', async () => {
    porCategoria.mockResolvedValue([BOLSA]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Bolsa de residuos');
    fireEvent.change(screen.getByRole('combobox', { name: /tipo de bolsa de residuos/i }), {
      target: { value: 'Negra 60 x 90' }
    });

    fireEvent.click(screen.getByRole('button', { name: /^elegir el quodom de bolsa de residuos$/i }));

    expect(pedirDestino).toHaveBeenCalledWith(
      expect.objectContaining({ idproducto: 41, cantidad: 1, atributo1: 'Negra 60 x 90' }), 7
    );
    expect(agregar).not.toHaveBeenCalled();
  });

  it('no abre la ficha aparte: la ficha va adentro del selector', async () => {
    porCategoria.mockResolvedValue([COCA]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Coca Cola 2L');

    fireEvent.click(screen.getByRole('button', { name: /^elegir el quodom de coca cola 2l$/i }));

    // El diálogo lo monta el hook, que acá está mockeado: lo que se comprueba es
    // que el clic no abre un modal propio de la tarjeta.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // Como el clic ya no abre una ficha aparte, el selector es el único lugar
  // donde se ve qué es el producto antes de mandarlo a algún lado.
  it('el selector muestra la ficha del producto, con el atributo ya elegido', async () => {
    vi.mocked(useAgregarProducto).mockReturnValue({
      agregar, pedirDestino, agregando: false, error: null,
      elegir: vi.fn(), crear: vi.fn(), cancelar: vi.fn(),
      destino: {
        idrubro: 7,
        items: [{ line: { idproducto: 41, nombreProducto: 'Bolsa de residuos', cantidad: 1, atributo1: 'Negra 60 x 90' }, idrubro: 7, candidatos: [] }],
        candidatos: []
      }
    } as unknown as ReturnType<typeof useAgregarProducto>);
    porCategoria.mockResolvedValue([BOLSA]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByRole('combobox', { name: /tipo de bolsa de residuos/i });

    const dialogo = within(screen.getByRole('dialog'));
    expect(dialogo.getByText('Bolsa de residuos')).toBeInTheDocument();
    expect(dialogo.getByText('Negra 60 x 90')).toBeInTheDocument();
  });

  // Varios "+" sin destino abierto encolan líneas: ahí no hay un producto que
  // mostrar, y el diálogo tiene que seguir preguntando igual.
  it('con varias líneas encoladas el selector va sin ficha', async () => {
    vi.mocked(useAgregarProducto).mockReturnValue({
      agregar, pedirDestino, agregando: false, error: null,
      elegir: vi.fn(), crear: vi.fn(), cancelar: vi.fn(),
      destino: {
        idrubro: 7,
        items: [
          { line: { idproducto: 41, nombreProducto: 'Bolsa de residuos', cantidad: 1 }, idrubro: 7, candidatos: [] },
          { line: { idproducto: 700, nombreProducto: 'Coca Cola 2L', cantidad: 1 }, idrubro: 7, candidatos: [] }
        ],
        candidatos: []
      }
    } as unknown as ReturnType<typeof useAgregarProducto>);
    porCategoria.mockResolvedValue([BOLSA, COCA]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Bolsa de residuos');

    const dialogo = within(screen.getByRole('dialog'));
    expect(dialogo.getByRole('heading', { name: /sumar a.*bebidas/i })).toBeInTheDocument();
    expect(dialogo.queryByText(/atributos:/i)).toBeNull();
  });
});

// Un invitado tiene un carrito por rubro: no hay destino que elegir, así que
// para él el clic abre lo único que queda por mostrar, la ficha del producto.
describe('ListaProductos · el clic y la sesión', () => {
  it('un invitado ve la ficha del producto y puede agregar desde ahí', async () => {
    auth.user = null;
    porCategoria.mockResolvedValue([COCA]);
    render(<ListaProductos idsubcategoria={70} />);
    fireEvent.click(await screen.findByRole('button', { name: /^ver coca cola 2l$/i }));

    expect(await screen.findByRole('button', { name: /agregar al quodom/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /a otro quodom/i })).not.toBeInTheDocument();
    expect(pedirDestino).not.toHaveBeenCalled();
  });

  it('con sesión el clic no muestra la ficha: va a elegir el Quodom', async () => {
    porCategoria.mockResolvedValue([COCA]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Coca Cola 2L');

    expect(screen.queryByRole('button', { name: /^ver coca cola 2l$/i })).toBeNull();
    expect(screen.getByRole('button', { name: /^elegir el quodom de coca cola 2l$/i })).toBeInTheDocument();
  });
});

describe('ListaProductos · arrastrar al árbol', () => {
  function bajoElPuntero(html: string) {
    const host = document.createElement('div');
    host.id = 'destinos';
    host.innerHTML = html;
    document.body.appendChild(host);
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(host.firstElementChild);
  }

  function arrastrarTarjeta(origen: Element) {
    fireEvent.pointerDown(origen, { clientX: 100, clientY: 100, button: 0 });
    window.dispatchEvent(new PointerEvent('pointermove', { buttons: 1, clientX: 160, clientY: 160 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 160, clientY: 160 }));
  }

  async function tarjetaDeCoca() {
    porCategoria.mockResolvedValue([COCA]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Coca Cola 2L');
    return document.querySelector('.prod-item')!;
  }

  beforeEach(() => {
    vi.mocked(agregarADestino).mockReset().mockResolvedValue(undefined);
    vi.mocked(crearYAgregar).mockReset().mockResolvedValue('q-nuevo');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    document.getElementById('destinos')?.remove();
  });

  it('soltar la tarjeta sobre un Quodom de su rubro lo agrega ahí', async () => {
    const tarjeta = await tarjetaDeCoca();
    bajoElPuntero('<button data-destino="q-7" data-rubro="7"></button>');

    arrastrarTarjeta(tarjeta.querySelector('.prod-name')!);

    expect(agregarADestino).toHaveBeenCalledWith(
      expect.objectContaining({ idproducto: 700, cantidad: 1 }), 7, 'q-7'
    );
  });

  it('el atributo elegido en la tarjeta viaja con lo que se suelta', async () => {
    porCategoria.mockResolvedValue([BOLSA]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Bolsa de residuos');
    fireEvent.change(screen.getByLabelText(/TIPO de Bolsa/), { target: { value: 'Cristal 50 x 70' } });
    bajoElPuntero('<button data-destino="q-7" data-rubro="7"></button>');

    arrastrarTarjeta(document.querySelector('.prod-name')!);

    expect(agregarADestino).toHaveBeenCalledWith(
      expect.objectContaining({ idproducto: 41, atributo1: 'Cristal 50 x 70' }), 7, 'q-7'
    );
  });

  it('soltar sobre un Quodom de otro rubro no agrega en ningún lado', async () => {
    const tarjeta = await tarjetaDeCoca();
    bajoElPuntero('<button data-destino="q-1" data-rubro="1"></button>');

    arrastrarTarjeta(tarjeta.querySelector('.prod-name')!);

    expect(agregarADestino).not.toHaveBeenCalled();
    expect(crearYAgregar).not.toHaveBeenCalled();
  });

  it('soltar en la zona de Quodom nuevo crea uno con nombre provisional y agrega', async () => {
    const tarjeta = await tarjetaDeCoca();
    bajoElPuntero('<button data-nuevo="7" data-rubro="7"></button>');

    arrastrarTarjeta(tarjeta.querySelector('.prod-name')!);

    expect(crearYAgregar).toHaveBeenCalledWith(
      expect.objectContaining({ idproducto: 700 }), 7, expect.stringMatching(/\S/)
    );
    expect(agregarADestino).not.toHaveBeenCalled();
  });

  it('soltar en el vacío no hace nada', async () => {
    const tarjeta = await tarjetaDeCoca();
    bajoElPuntero('<div></div>');

    arrastrarTarjeta(tarjeta.querySelector('.prod-name')!);

    expect(agregarADestino).not.toHaveBeenCalled();
    expect(crearYAgregar).not.toHaveBeenCalled();
  });

  it('un pointerdown que nace en un botón no arrastra', async () => {
    const tarjeta = await tarjetaDeCoca();
    bajoElPuntero('<button data-destino="q-7" data-rubro="7"></button>');

    arrastrarTarjeta(tarjeta.querySelector('.prod-add')!);

    expect(document.querySelector('.arrastre-fantasma')).toBeNull();
    expect(agregarADestino).not.toHaveBeenCalled();
  });

  it('un invitado no arrastra: no hay Quodoms a dónde soltar', async () => {
    auth.user = null;
    const tarjeta = await tarjetaDeCoca();
    bajoElPuntero('<button data-destino="q-7" data-rubro="7"></button>');

    arrastrarTarjeta(tarjeta.querySelector('.prod-name')!);

    expect(agregarADestino).not.toHaveBeenCalled();
  });

  it('un fallo al soltar se muestra en vez de perderse', async () => {
    vi.mocked(agregarADestino).mockRejectedValue(new Error('boom'));
    const tarjeta = await tarjetaDeCoca();
    bajoElPuntero('<button data-destino="q-7" data-rubro="7"></button>');

    arrastrarTarjeta(tarjeta.querySelector('.prod-name')!);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

// Con el dedo, arrastrar arranca dejándolo apretado: si se mueve antes, es el
// scroll de la lista, que es lo que el gesto se comía cuando era inmediato.
describe('ListaProductos · arrastrar con el dedo', () => {
  async function info() {
    porCategoria.mockResolvedValue([COCA]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Coca Cola 2L');
    return document.querySelector('.prod-info')!;
  }
  function apoyar(el: Element, x = 100, y = 100) {
    fireEvent.pointerDown(el, { clientX: x, clientY: y, button: 0, pointerType: 'touch' });
  }
  const mover = (x: number, y: number) =>
    window.dispatchEvent(new PointerEvent('pointermove', { buttons: 1, clientX: x, clientY: y, pointerType: 'touch' }));
  const soltar = (x: number, y: number) =>
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, pointerType: 'touch' }));

  beforeEach(() => {
    vi.mocked(agregarADestino).mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.dispatchEvent(new Event('arrastre:abortar'));
    document.getElementById('destinos')?.remove();
  });

  it('el dedo que se mueve antes de tiempo es scroll', async () => {
    const el = await info();
    vi.useFakeTimers();
    apoyar(el);
    vi.advanceTimersByTime(100);
    mover(100, 140);
    vi.advanceTimersByTime(1000);

    expect(document.body.classList.contains('arrastrando')).toBe(false);
    expect(document.querySelector('.arrastre-fantasma')).toBeNull();
  });

  it('mantener apretado levanta el producto, por encima del dedo', async () => {
    const el = await info();
    vi.useFakeTimers();
    apoyar(el);
    vi.advanceTimersByTime(450);
    expect(document.body.classList.contains('arrastrando')).toBe(true);

    mover(300, 300);
    const fantasma = document.querySelector<HTMLElement>('.arrastre-fantasma')!;
    expect(fantasma.style.top).toBe(300 - 48 + 'px');
  });

  // Mucha gente toca despacio: que vibre y no haga nada sería romper el toque.
  it('un toque lento sin mover abre el destino como un toque', async () => {
    const el = await info();
    vi.useFakeTimers();
    apoyar(el);
    vi.advanceTimersByTime(500);
    soltar(102, 101);
    fireEvent.click(el);

    expect(pedirDestino).toHaveBeenCalledTimes(1);
    expect(agregarADestino).not.toHaveBeenCalled();
    expect(document.body.classList.contains('arrastrando')).toBe(false);
  });

  it('soltar con el dedo sobre un destino agrega', async () => {
    const el = await info();
    const host = document.createElement('div');
    host.id = 'destinos';
    host.innerHTML = '<button data-destino="q-7" data-rubro="7"></button>';
    document.body.appendChild(host);
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(host.firstElementChild);
    vi.useFakeTimers();
    apoyar(el);
    vi.advanceTimersByTime(450);
    mover(300, 300);
    soltar(300, 300);

    expect(agregarADestino).toHaveBeenCalledWith(expect.objectContaining({ idproducto: 700 }), 7, 'q-7');
  });

  it('pointercancel antes de levantar no levanta ni agrega', async () => {
    const el = await info();
    vi.useFakeTimers();
    apoyar(el);
    window.dispatchEvent(new PointerEvent('pointercancel', { pointerType: 'touch' }));
    vi.advanceTimersByTime(1000);

    expect(document.body.classList.contains('arrastrando')).toBe(false);
    expect(agregarADestino).not.toHaveBeenCalled();
  });

  it('sin sesión el dedo no arrastra', async () => {
    auth.user = null;
    const el = await info();
    vi.useFakeTimers();
    apoyar(el);
    vi.advanceTimersByTime(600);

    expect(document.body.classList.contains('arrastrando')).toBe(false);
  });

  // Safari de iOS decide al apoyar el dedo si un touchmove se puede frenar,
  // mirando los oyentes que ya existen: uno que se agrega en el pointerdown
  // llega tarde y el arrastre termina scrolleando la página.
  it('el freno del scroll está puesto en la lista antes de apoyar el dedo', async () => {
    const agregar = vi.spyOn(HTMLElement.prototype, 'addEventListener');
    await info();

    const lista = document.querySelector('.prod-list');
    const freno = agregar.mock.calls.find((c, i) => c[0] === 'touchmove' && (agregar.mock.instances[i] as unknown) === lista);
    expect(freno?.[2]).toEqual({ passive: false });
  });

  it('el freno sólo frena con el producto levantado', async () => {
    const el = await info();
    const lista = document.querySelector('.prod-list')!;
    expect(fireEvent.touchMove(lista)).toBe(true);
    vi.useFakeTimers();
    apoyar(el);
    vi.advanceTimersByTime(ESPERA_TOQUE_MS);

    expect(fireEvent.touchMove(lista)).toBe(false);
  });

  // Chrome en Android dispara su "mantener apretado" (contextmenu) a los
  // 400ms y desde ahí no manda el clic: si el arrastre levantara después, un
  // toque soltado en ese hueco no haría nada.
  it('el mantener apretado del navegador levanta el producto en el acto', async () => {
    const el = await info();
    vi.useFakeTimers();
    apoyar(el);
    vi.advanceTimersByTime(ESPERA_TOQUE_MS - 50);
    window.dispatchEvent(new Event('contextmenu'));
    expect(document.body.classList.contains('arrastrando')).toBe(true);

    soltar(100, 100);
    expect(pedirDestino).toHaveBeenCalledTimes(1);
  });

  it('con mouse arranca al moverse, como siempre', async () => {
    const el = await info();
    fireEvent.pointerDown(el, { clientX: 100, clientY: 100, button: 0, pointerType: 'mouse' });
    window.dispatchEvent(new PointerEvent('pointermove', { buttons: 1, clientX: 300, clientY: 300 }));

    expect(document.body.classList.contains('arrastrando')).toBe(true);
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 300, clientY: 300 }));
  });
});

describe('ListaProductos · el clic que sigue a un arrastre', () => {
  async function tarjeta() {
    porCategoria.mockResolvedValue([COCA]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Coca Cola 2L');
    return document.querySelector('.prod-info')!;
  }

  function arrastrarYSoltar(origen: Element) {
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(null);
    fireEvent.pointerDown(origen, { clientX: 100, clientY: 100, button: 0 });
    window.dispatchEvent(new PointerEvent('pointermove', { buttons: 1, clientX: 300, clientY: 100 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 300, clientY: 100 }));
  }

  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('soltar en el vacío tras arrastrar no dispara el clic de la tarjeta', async () => {
    const info = await tarjeta();

    arrastrarYSoltar(info);
    fireEvent.click(info);

    expect(pedirDestino).not.toHaveBeenCalled();
  });

  it('un clic común sigue abriendo el selector de destino', async () => {
    const info = await tarjeta();

    fireEvent.pointerDown(info, { clientX: 100, clientY: 100, button: 0 });
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 101, clientY: 100 }));
    fireEvent.click(info);

    expect(pedirDestino).toHaveBeenCalled();
  });

  it('si el clic nunca llega, el bloqueo caduca y no se traga uno posterior', async () => {
    const info = await tarjeta();
    vi.useFakeTimers();

    arrastrarYSoltar(info);
    vi.advanceTimersByTime(500);
    fireEvent.click(info);

    expect(pedirDestino).toHaveBeenCalled();
  });
});

describe('ListaProductos · desmontar en pleno arrastre', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('soltar después de desmontar no deja fantasma y no agrega nada', async () => {
    porCategoria.mockResolvedValue([COCA]);
    const { unmount } = render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Coca Cola 2L');
    document.body.insertAdjacentHTML('beforeend', '<button id="d" data-destino="q-7" data-rubro="7"></button>');
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.getElementById('d'));
    fireEvent.pointerDown(document.querySelector('.prod-name')!, { clientX: 100, clientY: 100, button: 0 });
    window.dispatchEvent(new PointerEvent('pointermove', { buttons: 1, clientX: 160, clientY: 160 }));
    expect(document.querySelector('.arrastre-fantasma')).not.toBeNull();

    unmount();

    expect(document.querySelector('.arrastre-fantasma')).toBeNull();
    expect(document.body.classList.contains('arrastrando')).toBe(false);
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 160, clientY: 160 }));
    expect(agregarADestino).not.toHaveBeenCalled();
    document.getElementById('d')?.remove();
  });
});

// Al pasar el mouse por el +, un cartel dice adónde va: sin él, el + manda al
// Quodom abierto del rubro sin que nada lo nombre.
describe('ListaProductos · el cartel del +', () => {
  beforeEach(() => { localStorage.clear(); });

  it('nombra el Quodom abierto del rubro', async () => {
    localStorage.setItem('quodom.abierto', JSON.stringify({ 7: 'q-7' }));
    porCategoria.mockResolvedValue([COCA]);
    render(<ListaProductos idsubcategoria={70} />);

    const mas = await screen.findByRole('button', { name: 'Agregar Coca Cola 2L' });
    await waitFor(() => expect(mas).toHaveAccessibleDescription('Agregar a Bebidas oficina'));
  });

  it('sin Quodom abierto avisa que va a preguntar', async () => {
    porCategoria.mockResolvedValue([COCA]);
    render(<ListaProductos idsubcategoria={70} />);

    const mas = await screen.findByRole('button', { name: 'Agregar Coca Cola 2L' });
    expect(mas).toHaveAccessibleDescription(/vas a elegir a qué Quodom/i);
  });

  it('un invitado va a su carrito del rubro', async () => {
    auth.user = null;
    porCategoria.mockResolvedValue([COCA]);
    render(<ListaProductos idsubcategoria={70} />);

    const mas = await screen.findByRole('button', { name: 'Agregar Coca Cola 2L' });
    expect(mas).toHaveAccessibleDescription('Agregar a tu carrito de Bebidas');
  });
});
