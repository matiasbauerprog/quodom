import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { RedirectRubro, RedirectSubcategoria } from '../RedirectCategoria';
import { categorias } from '../../../api/categorias';

vi.mock('../../../api/categorias', () => ({ categorias: { porId: vi.fn() } }));

const porId = categorias.porId as unknown as ReturnType<typeof vi.fn>;

function Espia() {
  const l = useLocation();
  return <div data-testid="url">{l.pathname + l.search}</div>;
}

function montar(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/" element={<Espia />} />
        <Route path="/categoria/:id" element={<RedirectRubro />} />
        <Route path="/subcategoria/:id" element={<RedirectSubcategoria />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => { porId.mockReset(); });

describe('redirects de las rutas viejas', () => {
  it('/categoria/:id lleva al home con ese rubro', async () => {
    montar('/categoria/7');
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/?rubro=7'));
  });

  it('/subcategoria/:id resuelve su rubro padre y lleva a los dos params', async () => {
    porId.mockResolvedValue({ id: 70, nombrecategoria: 'Gaseosas', idcategoriapadre: 7, imagen: null, refreshImage: null, orden: 1 });

    montar('/subcategoria/70');

    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/?rubro=7&sub=70'));
    expect(porId).toHaveBeenCalledWith(70);
  });

  it('si no se puede resolver el padre, cae al home', async () => {
    porId.mockRejectedValue(new Error('404'));

    montar('/subcategoria/70');

    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/'));
  });
});
