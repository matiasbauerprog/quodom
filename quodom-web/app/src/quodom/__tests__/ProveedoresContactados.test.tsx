import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProveedoresContactados } from '../ProveedoresContactados';
import { proveedores } from '../../api/proveedores';
import { ApiError } from '../../api/client';

vi.mock('../../api/proveedores', () => ({ proveedores: { delQuodom: vi.fn(), noEnviado: vi.fn() } }));
vi.mock('../../api/quodom', () => ({ quodom: { whatsapp: vi.fn() } }));
vi.mock('../../utils/whatsapp', () => ({ openWhatsappLink: vi.fn() }));

const LE_BLEU = {
  placeid: 'p1', nombre: 'Pinturerías Le Bleu', rating: 4.9, resenas: 190,
  distanciakm: 0.4, telefono: '+541166687854', telefonovisible: '011 6668-7854',
  sintelefono: false, sinwhatsapp: false, sindatos: false,
  direccion: 'Almte Brown 3185', contactadoen: null
};

// Un contactado que la búsqueda de hoy no devolvió: de Google sólo se archiva
// el place_id, así que llega sin nombre, sin distancia y sin teléfono.
const OLVIDADO = {
  placeid: 'p-devoto', nombre: '', rating: null, resenas: 0,
  distanciakm: null, telefono: null, telefonovisible: null,
  sintelefono: false, sinwhatsapp: false, sindatos: true,
  direccion: '', contactadoen: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
};

function respuesta(extra: Record<string, unknown> = {}) {
  return {
    proveedores: [LE_BLEU], preciso: true, desde: 'Almte Brown 3185',
    atribucion: 'Resultados de Google', ...extra
  };
}

// El aviso del punto aproximado linkea a /direcciones con el router.
function montar() {
  return render(
    <MemoryRouter>
      <ProveedoresContactados idquodom="q1" />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(proveedores.delQuodom).mockReset();
  vi.mocked(proveedores.noEnviado).mockReset();
});

describe('ProveedoresContactados', () => {
  // El historial existe para contestar "a quién le mandé". Un contactado que
  // hoy no volvió a salir en la búsqueda no puede caerse del renglón: el
  // comprador le escribe de nuevo, o concluye que nunca le escribió.
  it('muestra al contactado que hoy no vino, con su fecha y el link a Maps', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({ proveedores: [OLVIDADO] }));

    montar();

    expect(await screen.findByText(/ya contactaste/i)).toBeInTheDocument();
    expect(screen.getByText(/ya le mandaste este quodom/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /maps/i }))
      .toHaveAttribute('href', expect.stringContaining('p-devoto'));
    // Y sin número: no vino de Google, así que no hay desde dónde medirlo, y
    // un "0,4 km" acá sería una distancia medida desde otra parte.
    expect(screen.queryByText(/km/)).toBeNull();
  });

  // La promesa central del feature: la pantalla nunca muestra una distancia
  // medida desde otro lugar que el que nombra. El diálogo lo hacía y el
  // historial, que consume la MISMA respuesta, no renderizaba ni `desde` ni el
  // aviso de `preciso`. El comprador cuya calle Google no tiene leía
  // "JB Artículos de Limpieza — 0,4 km" y entendía cuatro cuadras: son 0,4 km
  // del centro de Villa Ballester, que puede estar a 3 km de su casa.
  it('dice desde dónde midió', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta());

    montar();

    expect(await screen.findByText(/cerca de Almte Brown 3185/i)).toBeInTheDocument();
  });

  it('con el punto aproximado avisa que midió desde la localidad', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({ preciso: false, desde: 'Villa Ballester' }));

    montar();

    expect(await screen.findByText(/centro de la localidad/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dirección/i })).toHaveAttribute('href', '/direcciones');
    expect(screen.getByText(/cerca de Villa Ballester/i)).toBeInTheDocument();
  });

  // Acá el Quodom ya salió, así que el aviso no puede ofrecer "enviar sin
  // elegir proveedor": lo único que corresponde es decir que el mapa no
  // contesta, sin el texto de diagnóstico del servidor.
  it('una falla de Google no le muestra al comprador el texto del servidor', async () => {
    vi.mocked(proveedores.delQuodom).mockRejectedValue(
      new ApiError('places: HTTP 503 {"error":{"code":503}}', 503));

    montar();

    expect(await screen.findByText(/no pudimos consultar el mapa/i)).toBeInTheDocument();
    expect(screen.queryByText(/places: HTTP/i)).toBeNull();
    expect(screen.queryByText(/enviar sin elegir/i)).toBeNull();
  });

  it('la cuenta sale de la unión y no de los cinco de hoy', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({ proveedores: [LE_BLEU, OLVIDADO] }));

    montar();

    expect(await screen.findByText('Le mandaste a 1 de 2.')).toBeInTheDocument();
  });
});
