import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppBar } from '../AppBar';

function montar(url: string) {
  return render(<MemoryRouter initialEntries={[url]}><AppBar onOpenDrawer={() => {}} /></MemoryRouter>);
}

// El wordmark grande vive en el home y desaparece al entrar a un rubro. Sin
// esto el usuario quedaba sin marca a la vista y, peor, sin forma de volver:
// el logo chico de la barra es las dos cosas.
describe('AppBar', () => {
  it('no repite la marca en el home, donde el wordmark grande ya está', () => {
    montar('/');
    expect(screen.queryByRole('link', { name: /volver al inicio/i })).toBeNull();
  });

  it('muestra el logo al entrar a un rubro, y vuelve al inicio', () => {
    montar('/?rubro=7');
    const logo = screen.getByRole('link', { name: /volver al inicio/i });
    expect(logo).toHaveTextContent('QUODOM');
    expect(logo).toHaveAttribute('href', '/');
  });

  it('también lo muestra fuera del home', () => {
    montar('/mis-quodoms');
    expect(screen.getByRole('link', { name: /volver al inicio/i })).toBeInTheDocument();
  });

  it('sigue abriendo el menú', () => {
    montar('/');
    expect(screen.getByRole('button', { name: /abrir menú/i })).toBeInTheDocument();
  });
});

// Al abrir el chat el wordmark grande del home se esconde. Si acá tampoco
// aparecía, el usuario quedaba sin marca y, peor, sin forma de volver.
describe('AppBar (con el Modo IA abierto)', () => {
  it('muestra el logo cuando la conversación está abierta', () => {
    montar('/?ia=chat');
    expect(screen.getByRole('link', { name: /volver al inicio/i })).toBeInTheDocument();
  });
});
