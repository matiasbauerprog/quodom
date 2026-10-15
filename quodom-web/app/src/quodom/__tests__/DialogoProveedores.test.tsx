import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DialogoProveedores } from '../DialogoProveedores';
import { proveedores } from '../../api/proveedores';
import { quodom } from '../../api/quodom';

vi.mock('../../api/proveedores', () => ({ proveedores: { delQuodom: vi.fn(), noEnviado: vi.fn() } }));
vi.mock('../../api/quodom', () => ({ quodom: { whatsapp: vi.fn() } }));
const abrir = vi.hoisted(() => vi.fn());
vi.mock('../../utils/whatsapp', () => ({ openWhatsappLink: abrir }));

const LE_BLEU = {
  placeid: 'p1', nombre: 'Pinturerías Le Bleu', rating: 4.9, resenas: 190,
  distanciakm: 0.4, telefono: '+541166687854', telefonovisible: '011 6668-7854',
  sintelefono: false, esfijo: true, sinwhatsapp: false, direccion: 'Almte Brown 3185',
  contactadoen: null
};
const SIN_TEL = {
  placeid: 'p2', nombre: 'JB Artículos de Limpieza', rating: 4.3, resenas: 3,
  distanciakm: 0.4, telefono: null, telefonovisible: null,
  sintelefono: true, esfijo: false, sinwhatsapp: false, direccion: 'Pacífico Rodríguez 5369',
  contactadoen: null
};

function respuesta(extra = {}) {
  return { proveedores: [LE_BLEU], preciso: true, desde: 'Almte Brown 3185', atribucion: 'Resultados de Google', ...extra };
}

beforeEach(() => {
  vi.mocked(proveedores.delQuodom).mockReset();
  vi.mocked(proveedores.noEnviado).mockReset();
  vi.mocked(quodom.whatsapp).mockReset();
  abrir.mockReset();
});

describe('DialogoProveedores', () => {
  it('muestra cada proveedor con su puntuación y su distancia', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta());

    render(<DialogoProveedores idquodom="q1" onCerrar={vi.fn()} />);

    expect(await screen.findByText('Pinturerías Le Bleu')).toBeInTheDocument();
    expect(screen.getByText(/4,9|4\.9/)).toBeInTheDocument();
    expect(screen.getByText(/0,4 km|0\.4 km/)).toBeInTheDocument();
  });

  it('al elegir uno abre WhatsApp con ese número', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta());
    vi.mocked(quodom.whatsapp).mockResolvedValue({ res: true, link: 'https://wa.me/541166687854?text=hola' });

    render(<DialogoProveedores idquodom="q1" onCerrar={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /whatsapp/i }));

    await waitFor(() => expect(abrir).toHaveBeenCalledWith('https://wa.me/541166687854?text=hola'));
    expect(quodom.whatsapp).toHaveBeenCalledWith('q1', { proveedor: 'p1', tel: '+541166687854' });
  });

  it('al volver, el contactado queda marcado y los demás siguen disponibles', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({
      proveedores: [{ ...LE_BLEU, contactadoen: new Date().toISOString() }, SIN_TEL]
    }));

    render(<DialogoProveedores idquodom="q1" onCerrar={vi.fn()} />);

    expect(await screen.findByText(/ya le mandaste/i)).toBeInTheDocument();
    expect(screen.getByText('JB Artículos de Limpieza')).toBeInTheDocument();
  });

  // Review Focus 2: medido, existen.
  it('un proveedor sin teléfono no ofrece WhatsApp ni llamar, y lo dice', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({ proveedores: [SIN_TEL] }));

    render(<DialogoProveedores idquodom="q1" onCerrar={vi.fn()} />);

    expect(await screen.findByText(/no tiene el teléfono/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /whatsapp/i })).toBeNull();
    expect(screen.getByRole('link', { name: /maps/i })).toBeInTheDocument();
  });

  it('avisa que un fijo puede no tener WhatsApp, sin bloquearlo', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta());

    render(<DialogoProveedores idquodom="q1" onCerrar={vi.fn()} />);

    expect(await screen.findByText(/puede no tener whatsapp/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /whatsapp/i })).toBeEnabled();
  });

  it('cuando el punto es aproximado lo dice', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({ preciso: false, desde: 'Villa Ballester' }));

    render(<DialogoProveedores idquodom="q1" onCerrar={vi.fn()} />);

    expect(await screen.findByText(/centro de la localidad/i)).toBeInTheDocument();
  });

  // Review Focus 1 y 5: sin proveedores, o con Google caído, el usuario TIENE
  // que poder mandar igual. Es el camino que existe hoy.
  it('sin proveedores ofrece enviar sin destinatario', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({ proveedores: [] }));

    render(<DialogoProveedores idquodom="q1" onCerrar={vi.fn()} />);

    expect(await screen.findByRole('button', { name: /enviar sin elegir/i })).toBeInTheDocument();
  });

  it('si la búsqueda falla igual ofrece enviar sin destinatario', async () => {
    vi.mocked(proveedores.delQuodom).mockRejectedValue(new Error('503'));

    render(<DialogoProveedores idquodom="q1" onCerrar={vi.fn()} />);

    expect(await screen.findByRole('button', { name: /enviar sin elegir/i })).toBeInTheDocument();
  });

  it('deshacer un envío lo devuelve a la lista', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({
      proveedores: [{ ...LE_BLEU, contactadoen: new Date().toISOString() }]
    }));
    vi.mocked(proveedores.noEnviado).mockResolvedValue({ res: true });

    render(<DialogoProveedores idquodom="q1" onCerrar={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /no se envió/i }));

    await waitFor(() => expect(proveedores.noEnviado).toHaveBeenCalledWith('q1', 'p1', undefined));
  });
});
