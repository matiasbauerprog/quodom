import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SitioInicial } from '../SitioInicial';
import { categorias } from '../../../api/categorias';
import { productos } from '../../../api/productos';

vi.mock('../../../api/categorias', () => ({ categorias: { raiz: vi.fn(), subs: vi.fn() } }));
vi.mock('../../../api/productos', () => ({ productos: { porCategoria: vi.fn() } }));
vi.mock('../../../quodom/useAgregarProducto', () => ({
  useAgregarProducto: () => ({
    agregar: vi.fn(), agregando: false, error: null, pendiente: null,
    confirmar: vi.fn(), cancelar: vi.fn()
  })
}));

const raiz = categorias.raiz as unknown as ReturnType<typeof vi.fn>;
const subs = categorias.subs as unknown as ReturnType<typeof vi.fn>;
const porCategoria = productos.porCategoria as unknown as ReturnType<typeof vi.fn>;

const RUBROS = [
  { id: 7, nombrecategoria: 'Bebidas', idcategoriapadre: 0, imagen: null, refreshImage: null, orden: 1 },
  { id: 1, nombrecategoria: 'Limpieza', idcategoriapadre: 0, imagen: null, refreshImage: null, orden: 2 }
];
const SUBS_BEBIDAS = [
  { id: 70, nombrecategoria: 'Gaseosas', idcategoriapadre: 7, imagen: null, refreshImage: null, orden: 1 },
  { id: 71, nombrecategoria: 'Aguas', idcategoriapadre: 7, imagen: null, refreshImage: null, orden: 2 }
];
const COCA = {
  id: 700, nombreproducto: 'Coca Cola 2L', descripcion: null, categoria: 70,
  categoriaPadre: 7, imagen: null, refreshImagen: null, atributo1: null, atributo2: null
};

function montar(url: string) {
  return render(<MemoryRouter initialEntries={[url]}><SitioInicial /></MemoryRouter>);
}

beforeEach(() => {
  raiz.mockReset(); subs.mockReset(); porCategoria.mockReset();
  raiz.mockResolvedValue(RUBROS);
  subs.mockResolvedValue(SUBS_BEBIDAS);
  porCategoria.mockResolvedValue([COCA]);
});

describe('SitioInicial', () => {
  it('sin params muestra sólo los rubros', async () => {
    montar('/');

    expect(await screen.findByRole('link', { name: /bebidas/i })).toBeInTheDocument();
    expect(screen.getByText('QUODOM')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /subcategorías/i })).toBeNull();
    // La búsqueda se dio de baja: no queda ningún input en el home.
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(subs).not.toHaveBeenCalled();
    expect(porCategoria).not.toHaveBeenCalled();
  });

  it('tocar una tab cambia la lista de productos', async () => {
    montar('/?rubro=7&sub=70');
    await screen.findByText('Coca Cola 2L');

    porCategoria.mockResolvedValue([
      { ...COCA, id: 701, nombreproducto: 'Agua mineral 500ml', categoria: 71 }
    ]);
    fireEvent.click(screen.getByRole('link', { name: 'Aguas' }));

    expect(await screen.findByText('Agua mineral 500ml')).toBeInTheDocument();
    expect(porCategoria).toHaveBeenLastCalledWith(71);
    expect(screen.getByRole('link', { name: 'Aguas' })).toHaveAttribute('aria-current', 'page');
  });

  it('con un rubro abre su primera subcategoría y lista sus productos', async () => {
    montar('/?rubro=7');

    expect(await screen.findByText('Coca Cola 2L')).toBeInTheDocument();
    expect(subs).toHaveBeenCalledWith(7);
    // Se normaliza a la primera sub: nunca queda un hueco vacío bajo las tabs.
    expect(porCategoria).toHaveBeenCalledWith(70);
    expect(screen.getByRole('link', { name: 'Gaseosas' })).toHaveAttribute('aria-current', 'page');
  });

  it('entrar directo a rubro y sub pinta todo sin pasar por el home vacío', async () => {
    montar('/?rubro=7&sub=71');

    await waitFor(() => expect(porCategoria).toHaveBeenCalledWith(71));
    expect(screen.getByRole('link', { name: 'Aguas' })).toHaveAttribute('aria-current', 'page');
  });

  it('con un rubro elegido esconde el wordmark', async () => {
    montar('/?rubro=7');

    await screen.findByText('Coca Cola 2L');
    expect(screen.queryByText('QUODOM')).toBeNull();
  });

  it('un rubro inexistente vuelve al home sin mostrar error', async () => {
    montar('/?rubro=999');

    expect(await screen.findByText('QUODOM')).toBeInTheDocument();
    expect(subs).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('una sub que no es del rubro cae en la primera del rubro', async () => {
    montar('/?rubro=7&sub=999');

    await waitFor(() => expect(porCategoria).toHaveBeenCalledWith(70));
    expect(porCategoria).not.toHaveBeenCalledWith(999);
  });
});
