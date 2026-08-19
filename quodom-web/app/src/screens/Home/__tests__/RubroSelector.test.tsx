import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RubroSelector } from '../RubroSelector';
import type { Category } from '../../../api/types';

const RUBROS = [
  { id: 7, nombrecategoria: 'Bebidas', idcategoriapadre: 0, imagen: null, refreshImage: null, orden: 1 },
  { id: 1, nombrecategoria: 'Limpieza', idcategoriapadre: 0, imagen: null, refreshImage: null, orden: 2 }
] as Category[];

describe('RubroSelector', () => {
  it('sin selección cada rubro linkea a su propia query', () => {
    render(<MemoryRouter><RubroSelector rubros={RUBROS} idSeleccionado={null} /></MemoryRouter>);

    expect(screen.getByRole('link', { name: /bebidas/i })).toHaveAttribute('href', '/?rubro=7');
    expect(screen.getByRole('link', { name: /limpieza/i })).toHaveAttribute('href', '/?rubro=1');
  });

  it('marca el rubro elegido y lo convierte en el link para deseleccionar', () => {
    render(<MemoryRouter><RubroSelector rubros={RUBROS} idSeleccionado={7} /></MemoryRouter>);

    const elegido = screen.getByRole('link', { name: /bebidas/i });
    expect(elegido).toHaveAttribute('aria-current', 'page');
    // Volver a tocarlo vuelve al home completo.
    expect(elegido).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /limpieza/i })).not.toHaveAttribute('aria-current');
  });
});
