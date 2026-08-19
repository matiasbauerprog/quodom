import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SubcategoriaTabs } from '../SubcategoriaTabs';
import type { Category } from '../../../api/types';

const SUBS = [
  { id: 70, nombrecategoria: 'Gaseosas', idcategoriapadre: 7, imagen: null, refreshImage: null, orden: 1 },
  { id: 71, nombrecategoria: 'Aguas', idcategoriapadre: 7, imagen: null, refreshImage: null, orden: 2 }
] as Category[];

describe('SubcategoriaTabs', () => {
  it('cada tab conserva el rubro en la URL', () => {
    render(<MemoryRouter><SubcategoriaTabs idrubro={7} subs={SUBS} idSeleccionada={70} /></MemoryRouter>);

    expect(screen.getByRole('link', { name: 'Gaseosas' })).toHaveAttribute('href', '/?rubro=7&sub=70');
    expect(screen.getByRole('link', { name: 'Aguas' })).toHaveAttribute('href', '/?rubro=7&sub=71');
  });

  it('marca la subcategoría abierta', () => {
    render(<MemoryRouter><SubcategoriaTabs idrubro={7} subs={SUBS} idSeleccionada={70} /></MemoryRouter>);

    expect(screen.getByRole('link', { name: 'Gaseosas' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Aguas' })).not.toHaveAttribute('aria-current');
  });
});
