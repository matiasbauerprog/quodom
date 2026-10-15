import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DialogoMapa } from '../DialogoMapa';
import { cargarMapa, SinClaveDeMapa } from '../mapaGoogle';
import { lugares } from '../../api/lugares';
import { ApiError } from '../../api/client';

vi.mock('../mapaGoogle', async () => {
  const real = await vi.importActual<typeof import('../mapaGoogle')>('../mapaGoogle');
  return { cargarMapa: vi.fn(), SinClaveDeMapa: real.SinClaveDeMapa };
});
vi.mock('../../api/lugares', () => ({ lugares: { punto: vi.fn() } }));

const punto = lugares.punto as unknown as ReturnType<typeof vi.fn>;

const DIR = {
  placeid: '', calle: 'Ídolo', numero: '3720', localidad: 'Villa Ballester',
  partido: 'General San Martín', idprovincia: 1, cp: 'B1653',
  direccion: 'Ídolo 3720, Villa Ballester', lat: -34.5468, lng: -58.5562
};

/**
 * Un SDK de Google falso con lo justo: guarda los handlers para poder disparar
 * `dragend` y el clic del mapa desde el test, que es lo único que mueve el pin.
 */
function sdkFalso() {
  const handlers: Record<string, (e?: unknown) => void> = {};
  let pos = { lat: 0, lng: 0 };

  const marcador = {
    setPosition: (p: { lat: number; lng: number }) => { pos = p; },
    getPosition: () => ({ lat: () => pos.lat, lng: () => pos.lng }),
    addListener: (ev: string, fn: () => void) => { handlers['m:' + ev] = fn; return { remove: () => {} }; },
    setMap: () => {}
  };
  const mapa = {
    setCenter: () => {},
    getCenter: () => ({ lat: () => pos.lat, lng: () => pos.lng }),
    addListener: (ev: string, fn: (e?: unknown) => void) => { handlers['map:' + ev] = fn; return { remove: () => {} }; }
  };

  return {
    api: {
      Map: function () { return mapa; } as unknown as never,
      Marker: function (opts: { position: { lat: number; lng: number } }) { pos = opts.position; return marcador; } as unknown as never
    },
    arrastrarA(p: { lat: number; lng: number }) { pos = p; handlers['m:dragend']?.(); },
    clicEn(p: { lat: number; lng: number }) {
      handlers['map:click']?.({ latLng: { lat: () => p.lat, lng: () => p.lng } });
    },
    clicRoto() {
      handlers['map:click']?.({ latLng: { lat: () => undefined, lng: () => undefined } });
    }
  };
}

describe('DialogoMapa', () => {
  beforeEach(() => { punto.mockReset(); vi.mocked(cargarMapa).mockReset(); });

  // Sin clave la ventana tiene que decirlo y **no bloquear**: la carga a mano
  // es el único camino que queda, igual que con el autocompletado.
  it('sin clave de mapa lo dice y ofrece cargar a mano', async () => {
    vi.mocked(cargarMapa).mockRejectedValue(new SinClaveDeMapa());

    render(<DialogoMapa onElegir={vi.fn()} onCerrar={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/a mano/i);
    // Y nunca una consulta paga con el mapa caído.
    expect(punto).not.toHaveBeenCalled();
  });

  it('si el mapa no carga por otra razón también deja seguir a mano', async () => {
    vi.mocked(cargarMapa).mockRejectedValue(new Error('red caída'));

    render(<DialogoMapa onElegir={vi.fn()} onCerrar={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/a mano/i);
  });

  it('sin punto no se puede confirmar', async () => {
    const sdk = sdkFalso();
    vi.mocked(cargarMapa).mockResolvedValue(sdk.api);

    render(<DialogoMapa onElegir={vi.fn()} onCerrar={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /usar esta ubicaci/i })).toBeDisabled());
    expect(screen.getByText(/para poner el pin/i)).toBeInTheDocument();
  });

  it('con un punto previo busca su dirección y la muestra', async () => {
    const sdk = sdkFalso();
    vi.mocked(cargarMapa).mockResolvedValue(sdk.api);
    punto.mockResolvedValue(DIR);

    render(<DialogoMapa lat={-34.5468} lng={-58.5562} onElegir={vi.fn()} onCerrar={vi.fn()} />);

    expect(await screen.findByText(/Ídolo 3720/)).toBeInTheDocument();
    expect(punto).toHaveBeenCalledWith(-34.5468, -58.5562);
  });

  // Lo que se guarda es el punto del PIN, no el que Google emparejó: en una
  // esquina, unos metros son la casa de al lado.
  it('confirma el punto del pin y no el que devolvió Google', async () => {
    const sdk = sdkFalso();
    vi.mocked(cargarMapa).mockResolvedValue(sdk.api);
    punto.mockResolvedValue({ ...DIR, lat: -34.9999, lng: -58.9999 });
    const onElegir = vi.fn();

    render(<DialogoMapa lat={-34.5468} lng={-58.5562} onElegir={onElegir} onCerrar={vi.fn()} />);
    await screen.findByText(/Ídolo 3720/);

    fireEvent.click(screen.getByRole('button', { name: /usar esta ubicaci/i }));

    expect(onElegir).toHaveBeenCalledWith(expect.objectContaining({
      calle: 'Ídolo', lat: -34.5468, lng: -58.5562
    }));
  });

  it('arrastrar el pin consulta la dirección del punto nuevo', async () => {
    const sdk = sdkFalso();
    vi.mocked(cargarMapa).mockResolvedValue(sdk.api);
    punto.mockResolvedValue(DIR);

    render(<DialogoMapa lat={-34.5468} lng={-58.5562} onElegir={vi.fn()} onCerrar={vi.fn()} />);
    await screen.findByText(/Ídolo 3720/);
    punto.mockResolvedValue({ ...DIR, calle: 'Otra', direccion: 'Otra 100' });

    sdk.arrastrarA({ lat: -34.55, lng: -58.56 });

    expect(await screen.findByText(/Otra 100/)).toBeInTheDocument();
    expect(punto).toHaveBeenLastCalledWith(-34.55, -58.56);
  });

  // En celular arrastrar un pin chico es incómodo: tocar donde va es el gesto.
  it('tocar el mapa pone el pin ahí', async () => {
    const sdk = sdkFalso();
    vi.mocked(cargarMapa).mockResolvedValue(sdk.api);
    punto.mockResolvedValue(DIR);
    const onElegir = vi.fn();

    render(<DialogoMapa onElegir={onElegir} onCerrar={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /usar esta ubicaci/i })).toBeDisabled());

    sdk.clicEn({ lat: -34.60, lng: -58.40 });

    await waitFor(() => expect(screen.getByRole('button', { name: /usar esta ubicaci/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /usar esta ubicaci/i }));
    expect(onElegir).toHaveBeenCalledWith(expect.objectContaining({ lat: -34.60, lng: -58.40 }));
  });

  // El punto es lo que el usuario vino a arreglar: que no se pueda leer su
  // dirección no puede impedirle guardarlo.
  it('si no se puede leer la dirección, el punto se confirma igual', async () => {
    const sdk = sdkFalso();
    vi.mocked(cargarMapa).mockResolvedValue(sdk.api);
    punto.mockRejectedValue(new ApiError('No hay ninguna dirección en ese punto. Mové el pin a una calle.', 404));
    const onElegir = vi.fn();

    render(<DialogoMapa lat={-34.5} lng={-58.5} onElegir={onElegir} onCerrar={vi.fn()} />);

    expect(await screen.findByText(/mov[eé] el pin/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /usar esta ubicaci/i }));

    expect(onElegir).toHaveBeenCalledWith(expect.objectContaining({ lat: -34.5, lng: -58.5, calle: '' }));
  });


  // MEDIDO con el usuario: la consulta salia como
  // `/lugares/punto?lat=undefined&lng=undefined` y el servidor la rechazaba con
  // "Faltan datos o hay datos invalidos: lat, lng". Eso encadenaba el segundo
  // sintoma: sin direccion leida, confirmar aplicaba el camino de respaldo con
  // los campos vacios, y los campos del formulario no se llenaban solos.
  //
  // Una coordenada que no es un numero finito no puede gastar una consulta
  // paga ni mostrarle al comprador el error de un validador.
  it('no consulta cuando la coordenada no es un numero', async () => {
    const sdk = sdkFalso();
    vi.mocked(cargarMapa).mockResolvedValue(sdk.api);

    render(<DialogoMapa onElegir={vi.fn()} onCerrar={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /usar esta ubicaci/i })).toBeDisabled());

    sdk.clicRoto();

    await waitFor(() => expect(punto).not.toHaveBeenCalled());
    // Y el pin no queda puesto: no hay punto que confirmar.
    expect(screen.getByRole('button', { name: /usar esta ubicaci/i })).toBeDisabled();
  });

  it('cierra con Escape y con Cancelar', async () => {
    const sdk = sdkFalso();
    vi.mocked(cargarMapa).mockResolvedValue(sdk.api);
    const onCerrar = vi.fn();

    render(<DialogoMapa onElegir={vi.fn()} onCerrar={onCerrar} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCerrar).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCerrar).toHaveBeenCalledTimes(2);
  });
});
