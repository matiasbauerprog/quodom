import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AvisoLogin } from '../AvisoLogin';

describe('AvisoLogin', () => {
  it('se anuncia como alerta y linkea al login', () => {
    render(<MemoryRouter><AvisoLogin /></MemoryRouter>);

    expect(screen.getByRole('alert')).toHaveTextContent(/necesitás iniciar sesión/i);
    expect(screen.getByRole('link', { name: /iniciar sesión/i })).toHaveAttribute('href', '/login');
  });
});
