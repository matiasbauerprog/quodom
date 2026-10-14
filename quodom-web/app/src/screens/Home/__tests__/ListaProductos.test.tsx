import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ListaProductos } from '../ListaProductos';
import { productos } from '../../../api/productos';
import { useAgregarProducto } from '../../../quodom/useAgregarProducto';
import { agregarADestino, crearYAgregar } from '../../../quodom/agregarProducto';

vi.mock('../../../api/productos', () => ({ productos: { porCategoria: vi.fn() } }));
vi.mock('../../../quodom/useAgregarProducto', () => ({ useAgregarProducto: vi.fn() }));
vi.mock('../../../quodom/agregarProducto', () => ({ agregarADestino: vi.fn(), crearYAgregar: vi.fn() }));
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

describe('ListaProductos · mandar a otro Quodom', () => {
  it('cada producto ofrece mandarlo a otro Quodom, con nombre accesible', async () => {
    porCategoria.mockResolvedValue([COCA, BOLSA]);
    render(<ListaProductos idsubcategoria={70} />);

    expect(await screen.findAllByRole('button', { name: /a otro quodom/i })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Agregar Coca Cola 2L a otro Quodom' })).toBeInTheDocument();
  });

  it('el ··· pide el destino del rubro con el atributo elegido, sin agregar', async () => {
    porCategoria.mockResolvedValue([BOLSA]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Bolsa de residuos');
    fireEvent.change(screen.getByRole('combobox', { name: /tipo de bolsa de residuos/i }), {
      target: { value: 'Negra 60 x 90' }
    });

    fireEvent.click(screen.getByRole('button', { name: /bolsa de residuos a otro quodom/i }));

    expect(pedirDestino).toHaveBeenCalledWith(
      expect.objectContaining({ idproducto: 41, cantidad: 1, atributo1: 'Negra 60 x 90' }), 7
    );
    expect(agregar).not.toHaveBeenCalled();
  });
});

describe('ListaProductos · ··· y la sesión', () => {
  it('un invitado no ve el ···: no tiene a dónde elegir', async () => {
    auth.user = null;
    porCategoria.mockResolvedValue([COCA]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Coca Cola 2L');

    expect(screen.queryByRole('button', { name: /a otro quodom/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^agregar coca cola 2l$/i })).toBeInTheDocument();
  });

  it('con sesión sí lo muestra', async () => {
    porCategoria.mockResolvedValue([COCA]);
    render(<ListaProductos idsubcategoria={70} />);

    expect(await screen.findByRole('button', { name: /a otro quodom/i })).toBeInTheDocument();
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

  it('soltar en el vacío tras arrastrar no abre el detalle', async () => {
    const info = await tarjeta();

    arrastrarYSoltar(info);
    fireEvent.click(info);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('un clic común sigue abriendo el detalle', async () => {
    const info = await tarjeta();

    fireEvent.pointerDown(info, { clientX: 100, clientY: 100, button: 0 });
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 101, clientY: 100 }));
    fireEvent.click(info);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('si el clic nunca llega, el bloqueo caduca y no se traga uno posterior', async () => {
    const info = await tarjeta();
    vi.useFakeTimers();

    arrastrarYSoltar(info);
    vi.advanceTimersByTime(500);
    fireEvent.click(info);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
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
