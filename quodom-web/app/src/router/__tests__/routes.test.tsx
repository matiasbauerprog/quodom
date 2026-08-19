import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { routes } from '../routes';

// El shell y la home se reemplazan por marcadores: lo que se prueba acá es el
// ruteo, no lo que dibuja cada pantalla.
vi.mock('../../components/layout/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <div data-testid="shell">{children}</div>
}));
vi.mock('../../screens/Home/SitioInicial', () => ({ SitioInicial: () => <p>Inicio</p> }));
vi.mock('../../screens/Home/BusquedaScreen', () => ({ BusquedaScreen: () => <p>Búsqueda</p> }));

function renderEn(ruta: string) {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [ruta] })} />);
}

describe('rutas de rescate', () => {
  it('sirve /busqueda dentro del shell', async () => {
    renderEn('/busqueda');

    await waitFor(() => expect(screen.getByText('Búsqueda')).toBeInTheDocument());
    expect(screen.getByTestId('shell')).toBeInTheDocument();
  });

  it('manda cualquier URL desconocida al inicio, dentro del shell', async () => {
    renderEn('/una-ruta-que-no-existe/ni-existio');

    await waitFor(() => expect(screen.getByText('Inicio')).toBeInTheDocument());
    expect(screen.getByTestId('shell')).toBeInTheDocument();
  });

  it('nunca deja ver el 404 en inglés de react-router', async () => {
    renderEn('/otra-cosa');

    await waitFor(() => expect(screen.getByText('Inicio')).toBeInTheDocument());
    expect(screen.queryByText(/Unexpected Application Error/i)).toBeNull();
    expect(screen.queryByText(/404 Not Found/i)).toBeNull();
  });
});
