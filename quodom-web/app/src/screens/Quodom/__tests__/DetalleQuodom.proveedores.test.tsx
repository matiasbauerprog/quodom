import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DetalleQuodom } from '../DetalleQuodom';
import { useAuth } from '../../../auth/AuthContext';
import { quodom } from '../../../api/quodom';
import { quodomLines } from '../../../api/quodom_lines';
import { proveedores } from '../../../api/proveedores';
import { users } from '../../../api/users';

vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../api/quodom', () => ({
  quodom: {
    misQuodom: vi.fn(), porId: vi.fn(), update: vi.fn(), whatsapp: vi.fn(),
    activosPorRubro: vi.fn(), create: vi.fn(), eliminar: vi.fn()
  }
}));
vi.mock('../../../api/quodom_lines', () => ({
  quodomLines: { porQuodom: vi.fn(), update: vi.fn(), eliminar: vi.fn(), add: vi.fn(), atributos: vi.fn() }
}));
vi.mock('../../../api/proveedores', () => ({ proveedores: { delQuodom: vi.fn(), noEnviado: vi.fn() } }));
vi.mock('../../../api/categorias', () => ({ categorias: { raiz: vi.fn() } }));
vi.mock('../../../api/users', () => ({ users: { getDirecciones: vi.fn() } }));
const abrirWhatsapp = vi.hoisted(() => vi.fn());
vi.mock('../../../utils/whatsapp', () => ({ openWhatsappLink: abrirWhatsapp }));

const USUARIO = { id: 'u1', username: 'ana', email: 'ana@test.com', nombre: 'Ana' };

const LE_BLEU = {
  placeid: 'p1', nombre: 'Pinturerías Le Bleu', rating: 4.9, resenas: 190,
  distanciakm: 0.4, telefono: '+541166687854', telefonovisible: '011 6668-7854',
  sintelefono: false, esfijo: false, sinwhatsapp: false, direccion: 'Almte Brown 3185',
  contactadoen: null
};
const OTRO = {
  placeid: 'p2', nombre: 'Pinturería Del Barrio', rating: 4.1, resenas: 22,
  distanciakm: 1.1, telefono: '+541155550000', telefonovisible: '011 5555-0000',
  sintelefono: false, esfijo: false, sinwhatsapp: false, direccion: 'Mitre 100',
  contactadoen: null
};

// La fecha va relativa a ahora: una fija envejece y el renglón del contactado
// empieza a decir otra cosa sin que nadie toque el código.
function haceUnaHora(): string {
  return new Date(Date.now() - 60 * 60 * 1000).toISOString();
}

const LINEA = {
  id: 11, idquodom: 'q-7', idproducto: 302, cantidad: 2,
  nombreProducto: 'Latex Interior Blanco Mate'
};

function montar({ estado }: { estado: 'CREADO' | 'ENVIADO' }) {
  vi.mocked(quodom.porId).mockResolvedValue({
    id: 'q-7', nro: 'QD-7', descripcion: 'Pintura del frente', estado, idrubro: 1
  } as never);
  return render(
    <MemoryRouter initialEntries={['/quodom?id=q-7']}><DetalleQuodom /></MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ user: USUARIO } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(quodomLines.porQuodom).mockResolvedValue([LINEA] as never);
  // La pantalla pregunta si el usuario tiene dirección para saber si puede
  // enviar; sin respuesta el efecto rompe el render.
  vi.mocked(users.getDirecciones).mockResolvedValue([{ id: 1 } as never]);
  vi.mocked(proveedores.delQuodom).mockResolvedValue({
    proveedores: [{ ...LE_BLEU, contactadoen: haceUnaHora() }, OTRO],
    preciso: true, desde: 'Brown 3185', atribucion: 'Resultados de Google'
  });
});

// Un Quodom enviado no termina en "enviado": el comprador le manda a uno, no le
// contestan, y le manda a otro. Para eso tiene que ver a quién ya le mandó, y
// eso sólo lo sabe el servidor.
describe('DetalleQuodom: los proveedores de un Quodom enviado', () => {
  it('un Quodom enviado muestra a cuántos proveedores les mandó', async () => {
    montar({ estado: 'ENVIADO' });

    expect(await screen.findByText(/1 de 2/i)).toBeInTheDocument();
    expect(screen.getByText('Pinturerías Le Bleu')).toBeInTheDocument();
    expect(screen.getByText('Pinturería Del Barrio')).toBeInTheDocument();
  });

  it('deja mandarle a los que faltan', async () => {
    vi.mocked(quodom.whatsapp).mockResolvedValue({ res: true, link: 'https://wa.me/541155550000?text=hola' });

    montar({ estado: 'ENVIADO' });

    fireEvent.click(await screen.findByRole('button', { name: /enviar por whatsapp/i }));

    await waitFor(() => expect(quodom.whatsapp).toHaveBeenCalledWith('q-7', { proveedor: 'p2', tel: '+541155550000' }));
    await waitFor(() => expect(abrirWhatsapp).toHaveBeenCalledWith('https://wa.me/541155550000?text=hola'));
  });

  // El renglón del contactado es el mismo del selector, con sus tres estados de
  // teléfono y su "no se envió": si se copiara, las dos copias se despegarían.
  it('al contactado le muestra la fecha y le deja deshacer el envío', async () => {
    vi.mocked(proveedores.noEnviado).mockResolvedValue({ res: true });

    montar({ estado: 'ENVIADO' });

    expect(await screen.findByText(/ya le mandaste/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /no se envió/i }));
    fireEvent.click(await screen.findByRole('button', { name: /no tiene whatsapp/i }));

    await waitFor(() => expect(proveedores.noEnviado).toHaveBeenCalledWith('q-7', 'p1', 'sin_whatsapp'));
    // Vuelve a estar disponible, y la cuenta lo acompaña.
    expect(await screen.findByText(/0 de 2/i)).toBeInTheDocument();
  });

  it('un Quodom en armado no muestra la sección', async () => {
    montar({ estado: 'CREADO' });

    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(/proveedores contactados/i)).toBeNull();
    // Y no gasta una búsqueda paga a Google en una pantalla que no la pidió.
    expect(proveedores.delQuodom).not.toHaveBeenCalled();
  });

  // Los términos de Google exigen la atribución donde se muestran sus datos, y
  // esto es una segunda pantalla que los muestra.
  it('muestra la atribución de Google', async () => {
    montar({ estado: 'ENVIADO' });

    expect(await screen.findByText('Resultados de Google')).toBeInTheDocument();
  });

  // Google puede fallar o cortar por el tope de 10/min. Acá no hay nada que
  // enviar de urgencia, así que alcanza con decirlo y no romper la pantalla.
  it('si la búsqueda falla lo dice y el Quodom sigue a la vista', async () => {
    vi.mocked(proveedores.delQuodom).mockRejectedValue(new Error('Estás buscando proveedores muy seguido.'));

    montar({ estado: 'ENVIADO' });

    expect(await screen.findByText(/no pudimos buscar proveedores/i)).toBeInTheDocument();
    expect(screen.getByText('Latex Interior Blanco Mate')).toBeInTheDocument();
  });
});
