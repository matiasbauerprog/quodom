import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CampoDireccionMapa } from '../CampoDireccionMapa';
import { lugares } from '../../api/lugares';

vi.mock('../../api/lugares', () => ({
  lugares: { sugerencias: vi.fn(), direccion: vi.fn() }
}));

const MITRE = {
  placeid: 'ChIJ-1', calle: 'Bartolomé Mitre', numero: '450', localidad: 'San Isidro',
  partido: 'San Isidro', idprovincia: 1, cp: 'B1642', lat: -34.47, lng: -58.5,
  direccion: 'Mitre 450, San Isidro'
};

beforeEach(() => {
  vi.mocked(lugares.sugerencias).mockReset();
  vi.mocked(lugares.direccion).mockReset();
});

const campo = () => screen.getByLabelText(/buscá tu dirección/i);

describe('CampoDireccionMapa', () => {
  it('sugiere al tipear y entrega la dirección elegida', async () => {
    vi.mocked(lugares.sugerencias).mockResolvedValue({
      sugerencias: [{ placeid: 'ChIJ-1', texto: 'Mitre 450, San Isidro' }]
    });
    vi.mocked(lugares.direccion).mockResolvedValue(MITRE);
    const onElegir = vi.fn();

    render(<CampoDireccionMapa onElegir={onElegir} />);
    fireEvent.change(campo(), { target: { value: 'mitre 450' } });

    fireEvent.click(await screen.findByRole('option', { name: /Mitre 450, San Isidro/ }));

    await waitFor(() => expect(onElegir).toHaveBeenCalledWith(MITRE));
  });

  // Review Focus 2, del lado del cliente: el debounce es lo que evita una
  // consulta paga por tecla.
  it('no consulta con menos de 3 caracteres', async () => {
    render(<CampoDireccionMapa onElegir={vi.fn()} />);

    fireEvent.change(campo(), { target: { value: 'mi' } });

    await new Promise(r => setTimeout(r, 450));
    expect(lugares.sugerencias).not.toHaveBeenCalled();
  });

  it('agrupa las teclas en una sola consulta', async () => {
    vi.mocked(lugares.sugerencias).mockResolvedValue({ sugerencias: [] });

    render(<CampoDireccionMapa onElegir={vi.fn()} />);
    fireEvent.change(campo(), { target: { value: 'mit' } });
    fireEvent.change(campo(), { target: { value: 'mitre' } });
    fireEvent.change(campo(), { target: { value: 'mitre 4' } });

    await waitFor(() => expect(lugares.sugerencias).toHaveBeenCalledTimes(1));
    expect(lugares.sugerencias).toHaveBeenCalledWith('mitre 4', expect.any(String));
  });

  // Review Focus 3 y 4: si el buscador no anda, el usuario tiene que poder
  // seguir. El aviso lo dice y no bloquea nada.
  it('si el buscador falla lo avisa sin romper el formulario', async () => {
    vi.mocked(lugares.sugerencias).mockRejectedValue(new Error('503'));

    render(<CampoDireccionMapa onElegir={vi.fn()} />);
    fireEvent.change(campo(), { target: { value: 'mitre 450' } });

    expect(await screen.findByText(/no pudimos buscar/i)).toBeInTheDocument();
    expect(campo()).toHaveValue('mitre 450');
  });

  it('usa el mismo token de sesión para toda la tanda de tecleo', async () => {
    vi.mocked(lugares.sugerencias).mockResolvedValue({ sugerencias: [] });

    render(<CampoDireccionMapa onElegir={vi.fn()} />);
    fireEvent.change(campo(), { target: { value: 'mitre' } });
    await waitFor(() => expect(lugares.sugerencias).toHaveBeenCalledTimes(1));
    fireEvent.change(campo(), { target: { value: 'mitre 450' } });
    await waitFor(() => expect(lugares.sugerencias).toHaveBeenCalledTimes(2));

    const [, s1] = vi.mocked(lugares.sugerencias).mock.calls[0];
    const [, s2] = vi.mocked(lugares.sugerencias).mock.calls[1];
    expect(s1).toBe(s2);
  });
});
