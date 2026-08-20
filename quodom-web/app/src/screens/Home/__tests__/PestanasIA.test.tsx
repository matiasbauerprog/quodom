import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PestanasIA } from '../PestanasIA';

describe('PestanasIA', () => {
  it('muestra las dos pestañas, ninguna activa', () => {
    render(<PestanasIA activo={null} onElegir={vi.fn()} />);

    expect(screen.getByRole('button', { name: /conversando/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /subí tu lista/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('marca la pestaña activa', () => {
    render(<PestanasIA activo="chat" onElegir={vi.fn()} />);

    expect(screen.getByRole('button', { name: /conversando/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /subí tu lista/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('elegir una pestaña inactiva la pide', () => {
    const onElegir = vi.fn();
    render(<PestanasIA activo={null} onElegir={onElegir} />);

    fireEvent.click(screen.getByRole('button', { name: /subí tu lista/i }));

    expect(onElegir).toHaveBeenCalledWith('lista');
  });

  it('tocar la pestaña activa la cierra', () => {
    const onElegir = vi.fn();
    render(<PestanasIA activo="chat" onElegir={onElegir} />);

    fireEvent.click(screen.getByRole('button', { name: /conversando/i }));

    expect(onElegir).toHaveBeenCalledWith(null);
  });

  it('tocar la otra pestaña cambia de modo sin cerrar', () => {
    const onElegir = vi.fn();
    render(<PestanasIA activo="chat" onElegir={onElegir} />);

    fireEvent.click(screen.getByRole('button', { name: /subí tu lista/i }));

    expect(onElegir).toHaveBeenCalledWith('lista');
  });
});
