import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, Outlet } from 'react-router-dom';
import { VolverArriba } from '../VolverArriba';

// Historial abría scrolleado, con el título cortado: heredaba el scroll del
// catálogo. Pero elegir una subcategoría o abrir la ventana de un Quodom sólo
// cambia la búsqueda, y eso no puede mandar a nadie arriba.
function montar(inicial: string) {
  const router = createMemoryRouter(
    [{ element: <><VolverArriba /><Outlet /></>, children: [{ path: '*', element: <p>pantalla</p> }] }],
    { initialEntries: [inicial] }
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('VolverArriba', () => {
  let scrollTo: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    scrollTo = vi.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('cambiar de pantalla vuelve arriba', async () => {
    const router = montar('/');
    scrollTo.mockClear();
    await act(() => router.navigate('/perfil'));

    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('cambiar sólo la búsqueda no', async () => {
    const router = montar('/?rubro=5');
    scrollTo.mockClear();
    await act(() => router.navigate('/?rubro=5&sub=35'));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('volver atrás no, que el navegador restaura dónde estaba', async () => {
    const router = montar('/');
    await act(() => router.navigate('/perfil'));
    scrollTo.mockClear();
    await act(() => router.navigate(-1));

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
