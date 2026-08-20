import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ListaProductos } from '../ListaProductos';
import { productos } from '../../../api/productos';
import { useAgregarProducto } from '../../../quodom/useAgregarProducto';

vi.mock('../../../api/productos', () => ({ productos: { porCategoria: vi.fn() } }));
vi.mock('../../../quodom/useAgregarProducto', () => ({ useAgregarProducto: vi.fn() }));

const porCategoria = productos.porCategoria as unknown as ReturnType<typeof vi.fn>;
const agregar = vi.fn();

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
  vi.mocked(useAgregarProducto).mockReturnValue({
    agregar, agregando: false, error: null, pendiente: null,
    confirmar: vi.fn(), cancelar: vi.fn()
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

    fireEvent.click(screen.getByRole('button', { name: /agregar coca cola 2l/i }));

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
    fireEvent.click(screen.getByRole('button', { name: /agregar bolsa de residuos/i }));

    expect(agregar).toHaveBeenCalledWith(
      expect.objectContaining({ idproducto: 41, atributo1: 'Negra 60 x 90' }), 7
    );
  });

  it('agrega sin atributo si el usuario no elige ninguno', async () => {
    porCategoria.mockResolvedValue([BOLSA]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Bolsa de residuos');

    fireEvent.click(screen.getByRole('button', { name: /agregar bolsa de residuos/i }));

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
    fireEvent.click(screen.getByRole('button', { name: /agregar bolsa de residuos/i }));

    expect(agregar.mock.calls[0][0].atributo1).toBeUndefined();
  });

  it('maneja los dos grupos de un producto que tiene dos', async () => {
    porCategoria.mockResolvedValue([LATEX]);
    render(<ListaProductos idsubcategoria={70} />);
    await screen.findByText('Latex Interior');

    fireEvent.change(screen.getByRole('combobox', { name: /litros de latex interior/i }), { target: { value: '20 L' } });
    fireEvent.change(screen.getByRole('combobox', { name: /marca de latex interior/i }), { target: { value: 'Alba' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar latex interior/i }));

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
    fireEvent.click(screen.getByRole('button', { name: /agregar latex interior/i }));

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
});
