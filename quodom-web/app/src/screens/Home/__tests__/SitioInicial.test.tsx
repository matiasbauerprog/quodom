import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom';
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
vi.mock('../../ModoIA/PanelConversacion', () => ({ PanelConversacion: () => <p>panel chat</p> }));
// Subir un archivo está apagado en el home; vuelve junto con su bloque en
// SitioInicial.tsx y el describe comentado al final de este archivo.
// vi.mock('../../ListaIA/PanelLista', () => ({ PanelLista: () => <p>panel lista</p> }));

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
    expect(screen.getByRole('searchbox', { name: /buscar productos/i })).toBeInTheDocument();
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

  it('con un rubro elegido esconde el wordmark pero deja el buscador', async () => {
    montar('/?rubro=7');

    await screen.findByText('Coca Cola 2L');
    expect(screen.queryByText('QUODOM')).toBeNull();
    // Verlo desaparecer al entrar a un rubro se lee como que se perdió.
    expect(screen.getByRole('searchbox', { name: /buscar productos/i })).toBeInTheDocument();
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

describe('SitioInicial (botón Modo IA)', () => {
  it('muestra el botón en el home raíz', async () => {
    montar('/');
    await screen.findByRole('link', { name: /bebidas/i });

    expect(screen.getByRole('button', { name: /modo ia/i })).toBeInTheDocument();
  });

  it('no muestra el botón con un rubro elegido', async () => {
    montar('/?rubro=7&sub=70');
    await screen.findByText('Coca Cola 2L');

    expect(screen.queryByRole('button', { name: /modo ia/i })).toBeNull();
  });

  it('tocarlo reemplaza el catálogo por la conversación', async () => {
    montar('/');
    await screen.findByRole('link', { name: /bebidas/i });

    fireEvent.click(screen.getByRole('button', { name: /modo ia/i }));

    expect(await screen.findByText('panel chat')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /bebidas/i })).toBeNull();
  });

  // El botón es la única forma de cerrar: la pantalla de chat con su flecha de
  // volver ya no existe, así que si el botón dejara de verse al abrirlo el
  // usuario quedaría encerrado en la conversación.
  it('sigue visible con la conversación abierta y tocarlo devuelve el catálogo', async () => {
    montar('/');
    await screen.findByRole('link', { name: /bebidas/i });

    fireEvent.click(screen.getByRole('button', { name: /modo ia/i }));
    await screen.findByText('panel chat');

    const boton = screen.getByRole('button', { name: /modo ia/i });
    expect(boton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(boton);

    expect(await screen.findByRole('link', { name: /bebidas/i })).toBeInTheDocument();
    expect(screen.queryByText('panel chat')).toBeNull();
  });

  it('el wordmark se esconde con la conversación abierta', async () => {
    montar('/');
    await screen.findByRole('link', { name: /bebidas/i });
    expect(screen.getByText('QUODOM')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /modo ia/i }));

    await screen.findByText('panel chat');
    expect(screen.queryByText('QUODOM')).toBeNull();
  });

  it('el botón Atrás a un rubro sin remount cierra el panel y devuelve el catálogo', async () => {
    // Mismo componente de ruta ('/') para las dos entradas del historial: al
    // volver con navigate(-1) sólo cambian los search params, sin remount,
    // igual que hace el navegador real con el botón Atrás.
    const router = createMemoryRouter(
      [{ path: '/', element: <SitioInicial /> }],
      { initialEntries: ['/?rubro=7&sub=70', '/'], initialIndex: 1 }
    );
    render(<RouterProvider router={router} />);
    await screen.findByRole('link', { name: /bebidas/i });

    fireEvent.click(screen.getByRole('button', { name: /modo ia/i }));
    await screen.findByText('panel chat');

    await act(async () => { router.navigate(-1); });

    expect(await screen.findByText('Coca Cola 2L')).toBeInTheDocument();
    expect(screen.queryByText('panel chat')).toBeNull();
    expect(screen.queryByRole('button', { name: /modo ia/i })).toBeNull();
  });
});

// Subir un archivo está apagado por pedido del usuario (2026-08-23): en el home
// quedó sólo el botón de conversar. Estos tests vuelven junto con el bloque
// comentado de SitioInicial.tsx y el mock de PanelLista de más arriba; el resto
// de esa función — el endpoint, el matcheo, elegir entre productos parecidos y
// sus cuatro componentes — sigue vivo y con sus tests corriendo.
//
// describe('SitioInicial (panel de subir lista)', () => {
//   it('abrir el panel de lista reemplaza el catálogo', async () => {
//     montar('/');
//     await screen.findByRole('link', { name: /bebidas/i });
//
//     fireEvent.click(screen.getByRole('button', { name: /subí tu lista/i }));
//
//     expect(await screen.findByText('panel lista')).toBeInTheDocument();
//     expect(screen.queryByRole('link', { name: /bebidas/i })).toBeNull();
//   });
// });
