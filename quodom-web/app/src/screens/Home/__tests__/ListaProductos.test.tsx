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
  categoriaPadre: 7, imagen: null, refreshImagen: null, atributo1: null, atributo2: null
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
